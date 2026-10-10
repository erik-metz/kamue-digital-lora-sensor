"""Collect complete traffic snapshots and persist them atomically."""

from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from hessen_verkehr import collect_hessen_traffic
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
    hessen_coverage = {}
    hessen_incidents = (
        await collect_hessen_traffic(client, settings, coverage=hessen_coverage)
        if raw is None
        else []
    )
    hessen_done = monotonic()
    all_incidents = incidents + hessen_incidents
    flows = await collect_traffic_flows(
        client,
        settings,
        [inc for inc in all_incidents if inc.event_status(fetched_at) == "active"],
    )
    flow_done = monotonic()
    coverage = list(settings.roads)
    if hessen_coverage.get("complete"):
        coverage.append("hessen_verkehrsservice")
    summary = {
        "fetched_at": fetched_at.isoformat(),
        "accepted": len(all_incidents),
        "autobahn_incidents": len(incidents),
        "hessen_incidents": len(hessen_incidents),
        "skipped": skipped,
        "source_coverage": coverage,
        "traffic_flows": len(flows),
        "complete": True,
    }
    if dry_run:
        return {
            **summary,
            "records": [asdict(inc) for inc in all_incidents],
            "flows": [asdict(f) for f in flows],
        }
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist_traffic_incidents(
            conn,
            all_incidents,
            settings,
            fetched_at,
            flows=flows,
            reconcile_hessen=hessen_coverage.get("complete", False),
        )
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "hessen": hessen_done - normalized,
        "flow": flow_done - hessen_done,
        "persist": monotonic() - flow_done,
    }
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "TrafficCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
