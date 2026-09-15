"""Nextbike daemon: poll official Nextbike live feed and persist stations, bikes & trips."""

import argparse
import asyncio
import json
import logging
import signal
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx
import psycopg
from config import Settings
from normalize import parse_nextbike_response
from storage import ingest_nextbike_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
LOG = logging.getLogger("nextbike-collector")


def write_health(path: Path, status: str, details: dict):
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(
                {"status": status, "updated_at": datetime.now(UTC).isoformat(), **details},
                indent=2,
            )
        )
        tmp.replace(path)
    except Exception as exc:
        LOG.warning("Failed to write health file: %s", exc)


def check_health(path: Path) -> int:
    if not path.exists():
        print(f"Health file {path} does not exist", file=sys.stderr)
        return 1
    try:
        data = json.loads(path.read_text())
        if data.get("status") != "healthy":
            print(f"Health status is not healthy: {data}", file=sys.stderr)
            return 1
        updated = datetime.fromisoformat(data["updated_at"])
        age = (datetime.now(UTC) - updated).total_seconds()
        if age > 300:  # stale if older than 5 minutes
            print(f"Health status is stale (age={age:.1f}s)", file=sys.stderr)
            return 1
        return 0
    except Exception as exc:
        print(f"Health check failed: {exc}", file=sys.stderr)
        return 1


async def fetch_nextbike_live(client: httpx.AsyncClient, url: str) -> dict:
    LOG.debug("Fetching Nextbike data from %s", url)
    response = await client.get(url, timeout=30.0)
    response.raise_for_status()
    return response.json()


async def poll_cycle(client: httpx.AsyncClient, settings: Settings) -> dict:
    url = settings.api_url
    raw_data = await fetch_nextbike_live(client, url)
    stations = parse_nextbike_response(
        raw_data,
        allowed_city_ids=set(settings.city_ids) if settings.city_ids else None,
    )
    LOG.info("Parsed %d Nextbike stations from live feed", len(stations))

    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        stats = await ingest_nextbike_data(conn, stations)
        LOG.info(
            "Ingestion completed: stations=%d, obs=%d, trips=%d, bikes=%d",
            stats["stations_updated"],
            stats["observations_inserted"],
            stats["trips_detected"],
            stats["bikes_updated"],
        )
        return dict(stats)


async def main_loop():
    settings = Settings.from_env()
    health_path = Path(settings.state_dir) / "nextbike_collector_health.json"

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop_event.set)

    LOG.info(
        "Starting Nextbike Collector (cities=%s, poll_interval=%ds, target=%s)",
        ",".join(str(c) for c in settings.city_ids) or "all",
        settings.poll_seconds,
        settings.api_url,
    )

    backoff = 1
    async with httpx.AsyncClient(headers={"User-Agent": "OpenRiedSens-NextbikeCollector/1.0"}) as client:
        while not stop_event.is_set():
            try:
                stats = await poll_cycle(client, settings)
                backoff = 1
                write_health(
                    health_path,
                    "healthy",
                    {
                        "last_successful_fetch": datetime.now(UTC).isoformat(),
                        "stats": stats,
                    },
                )
            except Exception as exc:
                LOG.error("Error during Nextbike poll cycle: %s", exc, exc_info=True)
                write_health(
                    health_path,
                    "degraded",
                    {
                        "last_error": str(exc),
                        "last_error_at": datetime.now(UTC).isoformat(),
                    },
                )
                backoff = min(backoff * 2, 120)

            # Wait for next poll or stop signal
            sleep_time = backoff if backoff > 1 else settings.poll_seconds
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=sleep_time)
            except asyncio.TimeoutError:
                pass

    LOG.info("Nextbike Collector gracefully stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nextbike collector service")
    parser.add_argument("--healthcheck", action="store_true", help="Run Docker healthcheck")
    args = parser.parse_args()

    if args.healthcheck:
        settings = Settings.from_env()
        health_path = Path(settings.state_dir) / "nextbike_collector_health.json"
        sys.exit(check_health(health_path))

    asyncio.run(main_loop())
