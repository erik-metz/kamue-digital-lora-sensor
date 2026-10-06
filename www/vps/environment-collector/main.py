"""Collect environmental river gauge and weather data and persist atomically."""

import logging
from dataclasses import asdict
from datetime import UTC, datetime
from time import monotonic

import gbif
import pollen
import psycopg
import soil
from config import Settings
from normalize import normalize
from runtime import cli
from runtime import run as run_loop
from source import fetch
from storage import persist_environment_data


async def poll_cycle(client, settings, *, raw=None, dry_run=False):
    started = monotonic()
    if dry_run and raw is None:
        raise ValueError(
            "Dry-run requires --input; provider acquisition must be archived"
        )
    if raw is None:
        async with await psycopg.AsyncConnection.connect(**settings.db) as archive_conn:
            payload = await fetch(client, settings, archive_conn)
    else:
        payload = raw
    fetched_at = datetime.now(UTC)
    fetched = monotonic()
    gauges, weather_list = normalize(payload, settings)
    if not gauges or not weather_list:
        raise ValueError("Incomplete environment source data")
    normalized = monotonic()
    radar_list = getattr(weather_list, "radar", [])
    forecast_list = getattr(weather_list, "forecasts", [])
    lightning_item = getattr(weather_list, "lightning", None)
    coverage = ["pegelonline_wsv", "open_meteo_dwd"]
    if radar_list:
        coverage.append("dwd_radolan")
    if forecast_list:
        coverage.append("dwd_mosmix")
    if lightning_item:
        coverage.append("blitzortung")
    summary = {
        "fetched_at": fetched_at.isoformat(),
        "accepted": (
            len(gauges)
            + len(weather_list)
            + len(radar_list)
            + len(forecast_list)
            + (1 if lightning_item else 0)
        ),
        "skipped": 0,
        "source_coverage": coverage,
        "complete": True,
    }
    if dry_run:
        soil_bundle = payload.get("soil")
        soil_points = soil.normalize(soil_bundle) if soil_bundle else []
        dry_res = {
            **summary,
            "soil": soil_points,
            "pollen": pollen.normalize(payload["pollen"]) if payload.get("pollen") else [],
            "gbif": gbif.normalize(payload["gbif"]) if payload.get("gbif") else None,
            "gauges": [asdict(g) for g in gauges],
            "weather": [asdict(w) for w in weather_list],
            "radar": [asdict(r) for r in radar_list],
            "forecasts": [asdict(f) for f in forecast_list],
        }
        if lightning_item:
            dry_res["lightning"] = asdict(lightning_item)
        return dry_res
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        summary["ingestion"] = await persist_environment_data(
            conn,
            gauges,
            weather_list,
            fetched_at,
            payload=payload,
            source_url=settings.pegelonline_url,
            radar=radar_list,
            forecasts=forecast_list,
            lightning=lightning_item,
        )
    summary["soil"] = {"status": "disabled"}
    if settings.enable_soil:
        try:
            async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                bundle = payload.get("soil") if raw is not None else await soil.acquire(client, settings, conn)
                if bundle is not None:
                    points = soil.normalize(bundle)
                    count = await soil.persist(conn, bundle, points)
                    summary["ingestion"]["soil"] = count
                    summary["accepted"] += count
                    summary["source_coverage"].append(soil.SOURCE)
                    summary["soil"] = {"status": "success", "run": bundle["run"], "accepted": count,
                        "last_success": datetime.now(UTC).isoformat(),
                        "missing": sum(row[5] == "missing" for point in points for row in point["rows"])}
                else:
                    last = await (await conn.execute("SELECT MAX(received_at) FROM collection_attempts WHERE source_id=%s AND status='success'", (soil.SOURCE,))).fetchone()
                    summary["soil"] = {"status": "not_due", "last_success": last[0].isoformat() if last[0] else None}
        except Exception as exc:
            logging.getLogger(__name__).exception("Soil acquisition/import failed; existing environment writes retained")
            summary["complete"] = False
            summary["soil"] = {"status": "failed", "error_category": type(exc).__name__}
        summary["soil"]["poll_seconds"] = settings.soil_poll_seconds
    summary["pollen"] = {"status": "disabled"}
    if settings.enable_pollen:
        try:
            async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                bundle = payload.get("pollen") if raw is not None else await pollen.acquire(client, settings, conn)
                if bundle is not None:
                    points = pollen.normalize(bundle)
                    count = await pollen.persist(conn, bundle, points)
                    summary["ingestion"]["pollen"] = count
                    summary["accepted"] += count
                    summary["source_coverage"].append(pollen.SOURCE)
                    summary["pollen"] = {"status": "success", "accepted": count,
                        "last_success": datetime.now(UTC).isoformat(),
                        "missing": sum(r[3] == "missing" for p in points for r in p["rows"])}
                else:
                    last = await (await conn.execute("SELECT MAX(received_at) FROM collection_attempts WHERE source_id=%s AND status='success'", (pollen.SOURCE,))).fetchone()
                    summary["pollen"] = {"status": "not_due", "last_success": last[0].isoformat() if last[0] else None}
        except Exception as exc:
            logging.getLogger(__name__).exception("Pollen import failed; other environment writes retained")
            summary["complete"] = False
            summary["pollen"] = {"status": "failed", "error_category": type(exc).__name__}
        summary["pollen"]["poll_seconds"] = settings.pollen_poll_seconds
    summary["gbif"] = {"status": "disabled"}
    if settings.enable_gbif:
        try:
            async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
                bundle = payload.get("gbif") if raw is not None else await gbif.acquire(client, settings, conn)
                if bundle is not None:
                    normalized_gbif = gbif.normalize(bundle)
                    count = await gbif.persist(conn, bundle, normalized_gbif)
                    summary["ingestion"]["gbif"] = count
                    summary["accepted"] += count
                    summary["source_coverage"].append(gbif.SOURCE)
                    summary["gbif"] = {"status": "success", "accepted": count,
                        "last_success": datetime.now(UTC).isoformat(),
                        "matched": normalized_gbif["matched"], "scanned": normalized_gbif["scanned"],
                        "source_truncated": normalized_gbif["source_truncated"], "skipped": normalized_gbif["skipped"]}
                else:
                    last = await (await conn.execute("SELECT MAX(received_at) FROM collection_attempts WHERE source_id=%s AND status='success'", (gbif.SOURCE,))).fetchone()
                    summary["gbif"] = {"status": "not_due", "last_success": last[0].isoformat() if last[0] else None}
        except Exception as exc:
            logging.getLogger(__name__).exception("GBIF import failed; other environment writes retained")
            summary["complete"] = False
            summary["gbif"] = {"status": "failed", "error_category": type(exc).__name__}
        summary["gbif"]["poll_seconds"] = settings.gbif_poll_seconds
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
