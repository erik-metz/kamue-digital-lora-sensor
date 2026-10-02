"""Collect complete traffic snapshots and persist them atomically."""

from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import persist_traffic_incidents
from traffic_flow import collect_traffic_flows


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    payload = await fetch(client, settings) if raw is None else raw
    fetched_at = datetime.now(UTC)
    fetched = monotonic()
    incidents, skipped = normalize(payload, settings)
    normalized = monotonic()
    flows = await collect_traffic_flows(client, settings, incidents)
    flow_done = monotonic()
    summary = {
        "fetched_at": fetched_at.isoformat(),
        "accepted": len(incidents),
        "skipped": skipped,
        "source_coverage": list(settings.roads),
        "traffic_flows": len(flows),
        "complete": True,
    }
    if dry_run:
        return {
            **summary,
            "records": [asdict(inc) for inc in incidents],
            "flows": [asdict(f) for f in flows],
        }
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist_traffic_incidents(
            conn, incidents, settings, fetched_at, flows=flows
        )
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "flow": flow_done - normalized,
        "persist": monotonic() - flow_done,
    }
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "TrafficCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
