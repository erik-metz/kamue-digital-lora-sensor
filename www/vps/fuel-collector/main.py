"""Collect regional fuel prices; acquisition time is not a price-change time."""
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import persist


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    start = monotonic()
    payload = await fetch(client, settings) if raw is None else raw
    now = datetime.now(UTC)
    stations = normalize(payload)
    normalized = monotonic()
    summary = {"fetched_at": now.isoformat(), "accepted": len(stations), "skipped": {},
        "source_coverage": {"center": [settings.latitude, settings.longitude], "radius_km": settings.radius},
        "complete": True, "timestamp_kind": "snapshot_acquired"}
    if dry_run:
        return {**summary, "records": stations}
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist(conn, stations, now, settings)
    summary["durations_seconds"] = {"fetch_normalize": normalized-start, "persist": monotonic()-normalized}
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "FuelCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
