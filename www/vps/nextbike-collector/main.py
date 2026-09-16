"""Collect complete bike snapshots and persist inferred movement."""

from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from normalize import parse_nextbike_response
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import ingest_nextbike_data


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    payload = await fetch(client, settings) if raw is None else raw
    now = datetime.now(UTC)
    fetched = monotonic()
    stations = parse_nextbike_response(payload, set(settings.city_ids) or None, now=now)
    normalized = monotonic()
    summary = {
        "fetched_at": now.isoformat(),
        "accepted": len(stations),
        "skipped": {},
        "source_coverage": sorted(settings.city_ids) or ["all"],
        "complete": True,
        "timestamp_kind": "snapshot_acquired",
    }
    if dry_run:
        return {**summary, "records": [asdict(station) for station in stations]}
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = dict(
            await ingest_nextbike_data(
                conn,
                stations,
                city_ids=settings.city_ids,
                fetched_at=now,
                stale_seconds=max(900, 3 * settings.poll_seconds),
            )
        )
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "persist": monotonic() - normalized,
    }
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "NextbikeCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
