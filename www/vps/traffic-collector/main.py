"""Traffic collector daemon: polls Autobahn and regional traffic data and writes to TimescaleDB."""

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
from fetcher import fetch_road_incidents
from storage import persist_traffic_incidents

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
LOG = logging.getLogger("traffic-collector")


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
    except OSError as exc:
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
        if age > 600:  # stale if older than 10 minutes
            print(f"Health status is stale (age={age:.1f}s)", file=sys.stderr)
            return 1
        return 0
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"Health check failed: {exc}", file=sys.stderr)
        return 1


async def poll_cycle(client: httpx.AsyncClient, conn: psycopg.AsyncConnection, settings: Settings) -> dict:
    all_incidents = []
    for road in settings.roads:
        road_incidents = await fetch_road_incidents(client, road, settings)
        all_incidents.extend(road_incidents)

    return await persist_traffic_incidents(conn, all_incidents, settings)


async def main_loop(settings: Settings):
    LOG.info("Starting traffic-collector daemon for roads: %s", settings.roads)
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    async with httpx.AsyncClient(headers={"User-Agent": "OpenRiedSens-TrafficCollector/1.0"}) as client:
        while not stop_event.is_set():
            try:
                LOG.info("Connecting to database: %s:%d/%s", settings.db_host, settings.db_port, settings.db_name)
                async with await psycopg.AsyncConnection.connect(
                    settings.db_url, autocommit=False
                ) as conn:
                    while not stop_event.is_set():
                        start_time = asyncio.get_event_loop().time()
                        try:
                            stats = await poll_cycle(client, conn, settings)
                            write_health(
                                settings.health_file,
                                "healthy",
                                {"incidents_tracked": stats.get("active_incidents", 0)},
                            )
                        except Exception as exc:
                            LOG.exception("Error during poll cycle")
                            write_health(settings.health_file, "unhealthy", {"error": str(exc)})

                        elapsed = asyncio.get_event_loop().time() - start_time
                        sleep_time = max(10, settings.poll_seconds - elapsed)
                        try:
                            await asyncio.wait_for(stop_event.wait(), timeout=sleep_time)
                        except TimeoutError:
                            pass
            except (psycopg.Error, OSError) as exc:
                LOG.error("Database connection failed: %s. Retrying in 10s...", exc)
                write_health(settings.health_file, "unhealthy", {"error": str(exc)})
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=10.0)
                except TimeoutError:
                    pass

    LOG.info("Traffic collector daemon shutdown cleanly.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Traffic collector daemon")
    parser.add_argument("--healthcheck", action="store_true", help="Run health check and exit")
    args = parser.parse_args()

    settings = Settings()
    if args.healthcheck:
        sys.exit(check_health(settings.health_file))

    try:
        asyncio.run(main_loop(settings))
    except KeyboardInterrupt:
        pass
