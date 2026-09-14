"""Poll a configured public dashboard and persist source-timestamped observations."""

import argparse
import asyncio
import json
import logging
import random
import signal
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx
import psycopg
from config import Settings
from normalize import normalize, timestamp
from storage import ingest

LOG = logging.getLogger("smartcity-collector")
MAX_BYTES = 20 * 1024 * 1024


def retry_after(value, now):
    if not value:
        return 0
    try:
        return max(0, int(value))
    except ValueError:
        try:
            return max(0, (parsedate_to_datetime(value) - now).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return 0


async def fetch(client, url):
    async with asyncio.timeout(45), client.stream("GET", url) as response:
        response.raise_for_status()
        body = bytearray()
        async for part in response.aiter_bytes():
            body.extend(part)
            if len(body) > MAX_BYTES:
                raise ValueError("Dashboard response exceeds 20 MiB")
        return json.loads(body)


def write_json(directory, name, payload):
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / (name + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8"
    )
    temporary.replace(directory / name)


def report(result, now):
    return {
        "fetched_at": now.isoformat(),
        "entities_seen": result.entity_count,
        "observations": len(result.observations),
        "sensors": len({r.sensor_id for r in result.observations}),
        "skipped": dict(result.skipped),
        "source_observations": [
            {
                "sensor_id": r.sensor_id,
                "entity_id": r.entity_id,
                "metric": r.metric,
                "value": r.value,
                "unit": r.unit,
                "observed_at": r.observed_at.isoformat(),
                "age_seconds": max(0, int((now - r.observed_at).total_seconds())),
            }
            for r in result.observations
        ],
    }


async def run(settings, once=False, dry_run=False, input_file=None):
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    failures = 0
    state_dir = Path(settings.state_dir)
    async with httpx.AsyncClient(
        timeout=30, headers={"User-Agent": "OpenRiedSens-SmartCityCollector/1.0"}
    ) as client:
        while not stop.is_set():
            delay = settings.poll_seconds
            try:
                payload = (
                    json.loads(Path(input_file).read_text())
                    if input_file
                    else await fetch(client, settings.dashboard_url)
                )
                now = datetime.now(UTC)
                if not dry_run:
                    # One bounded latest snapshot, replaced each poll, for parser diagnostics.
                    write_json(state_dir, "latest-dashboard.json", payload)
                result = normalize(
                    payload,
                    settings.tenant,
                    settings.dashboard_url,
                    now,
                    settings.entity_ids,
                    settings.metrics,
                )
                summary = report(result, now)
                if dry_run:
                    print(json.dumps(summary, ensure_ascii=False, indent=2))
                    return
                async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                    counts = await ingest(conn, result.observations)
                summary["last_success"] = datetime.now(UTC).isoformat()
                summary["ingestion"] = dict(counts)
                write_json(state_dir, "status.json", summary)
                LOG.info(
                    "Fetched %d entities; %d accepted readings; %s; skipped=%s",
                    result.entity_count,
                    len(result.observations),
                    dict(counts),
                    dict(result.skipped),
                )
                if not result.observations:
                    LOG.warning(
                        "No accepted observations; check filters, source timestamps, units and schema"
                    )
                failures = 0
            except (
                httpx.HTTPError,
                psycopg.Error,
                ValueError,
                TypeError,
                OSError,
                RuntimeError,
            ) as exc:
                if once or dry_run:
                    raise
                failures += 1
                delay = min(3600, settings.poll_seconds * 2 ** min(failures, 10))
                if isinstance(exc, httpx.HTTPStatusError):
                    delay = max(
                        delay,
                        retry_after(
                            exc.response.headers.get("Retry-After"), datetime.now(UTC)
                        ),
                    )
                LOG.warning(
                    "Poll failed (%s): %s; retry in %.0fs",
                    type(exc).__name__,
                    exc,
                    delay,
                )
            if once:
                return
            try:
                await asyncio.wait_for(
                    stop.wait(), timeout=delay + random.uniform(0, min(10, delay * 0.1))
                )
            except TimeoutError:
                pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once", action="store_true", help="Fetch and commit one poll, then exit"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print one normalized poll, no DB or file writes",
    )
    parser.add_argument("--input", help="Offline dashboard JSON (requires --dry-run)")
    parser.add_argument("--healthcheck", action="store_true")
    args = parser.parse_args()
    if args.input and not args.dry_run:
        parser.error("--input requires --dry-run")
    settings = Settings.from_env()
    if args.healthcheck:
        try:
            status = json.loads((Path(settings.state_dir) / "status.json").read_text())
            success = timestamp(status.get("last_success"))
            healthy = success and (datetime.now(UTC) - success).total_seconds() <= max(
                300, 3 * settings.poll_seconds
            )
        except (OSError, ValueError):
            healthy = False
        raise SystemExit(0 if healthy else 1)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(run(settings, args.once, args.dry_run, args.input))


if __name__ == "__main__":
    main()
