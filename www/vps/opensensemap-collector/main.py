"""Collect complete openSenseMap sensor snapshots and persist them atomically."""

from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import persist_boxes


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    if raw is None:
        payload, raw_bytes, sha256 = await fetch(client, settings)
    else:
        payload = raw
        raw_bytes = None
        sha256 = None
    fetched_at = datetime.now(UTC)
    fetched = monotonic()
    boxes, skipped = normalize(payload, settings)
    normalized = monotonic()
    total_measurements = sum(len(b.measurements) for b in boxes)
    summary = {
        "fetched_at": fetched_at.isoformat(),
        "accepted": len(boxes),
        "total_measurements": total_measurements,
        "skipped": skipped,
        "bbox": [settings.min_lon, settings.min_lat, settings.max_lon, settings.max_lat],
        "complete": True,
    }
    if dry_run:
        return {
            **summary,
            "records": [asdict(b) for b in boxes],
        }
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist_boxes(
            conn,
            boxes,
            settings,
            fetched_at,
            payload_bytes=raw_bytes,
            payload_sha256=sha256,
        )
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "persist": monotonic() - normalized,
    }
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "OpenSenseMapCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
