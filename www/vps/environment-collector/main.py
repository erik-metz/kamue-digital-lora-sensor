"""Collect environmental river gauge and weather data and persist atomically."""

from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import psycopg
from config import Settings
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import persist_environment_data


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    payload = await fetch(client, settings) if raw is None else raw
    fetched_at = datetime.now(UTC)
    fetched = monotonic()
    gauges, weather_list = normalize(payload, settings)
    normalized = monotonic()
    summary = {
        "fetched_at": fetched_at.isoformat(),
        "accepted": len(gauges) + len(weather_list),
        "skipped": 0,
        "source_coverage": ["pegelonline_wsv", "open_meteo_dwd"],
        "complete": True,
    }
    if dry_run:
        return {
            **summary,
            "gauges": [asdict(g) for g in gauges],
            "weather": [asdict(w) for w in weather_list],
        }
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist_environment_data(
            conn, gauges, weather_list, fetched_at
        )
    summary["durations_seconds"] = {
        "fetch": fetched - started,
        "normalize": normalized - fetched,
        "persist": monotonic() - normalized,
    }
    return summary


async def run(settings, **options):
    await run_loop(settings, poll_cycle, "EnvironmentCollector", **options)


if __name__ == "__main__":
    cli(Settings.from_env, run)
