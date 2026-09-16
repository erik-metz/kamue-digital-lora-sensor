"""Collect source-timestamped dashboard observations."""

import logging
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic

import psycopg
from config import Settings
from health import write_json
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch_dashboards
from storage import ingest

LOG = logging.getLogger(__name__)


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


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    payload = await fetch_dashboards(client, settings) if raw is None else raw
    now = datetime.now(UTC)
    fetched = monotonic()
    result = normalize(
        payload,
        settings.tenant,
        settings.dashboard_url,
        now,
        settings.entity_ids,
        settings.metrics,
    )
    summary = report(result, now)
    normalized = monotonic()
    summary.update(
        accepted=len(result.observations),
        complete=True,
        source_coverage=[settings.dashboard_url, *settings.additional_dashboard_urls],
        latest_observed_at=max(
            (r.observed_at for r in result.observations), default=None
        ),
    )
    if dry_run:
        return summary
    # Diagnostic persistence is independent of ingestion success.
    try:
        write_json(Path(settings.state_dir) / "latest-dashboard.json", payload)
    except OSError:
        LOG.exception("Could not write diagnostic snapshot")
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = dict(await ingest(conn, result.observations))
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "persist": monotonic() - normalized,
    }
    if not result.observations:
        LOG.warning(
            "No accepted observations; check source schema, timestamps and filters"
        )
    return summary


async def run(settings, once=False, dry_run=False, input_file=None):
    await run_loop(
        settings,
        poll_cycle,
        "SmartCityCollector",
        once=once,
        dry_run=dry_run,
        input_file=input_file,
    )


if __name__ == "__main__":
    cli(Settings.from_env, run)
