"""Backfill historical TTN Mapper or Packet Broker data into the Three-Table Core Schema.

Usage:
  python backfill.py --csv <path_to_ttnmapper_csv>
  python backfill.py --json <path_to_gateways_json> [--timestamp <iso8601>]
"""

import argparse
import asyncio
import csv
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import psycopg
from config import Settings
from normalize import (
    _is_in_bounds,
    compute_ried_snapshot,
    normalize_gateways_payload,
)
from storage import persist_gateways

LOG = logging.getLogger("ttnmapper.backfill")


async def backfill_from_json(file_path: str, timestamp_str: str | None = None):
    settings = Settings.from_env()
    content = json.loads(Path(file_path).read_text())
    now = datetime.fromisoformat(timestamp_str) if timestamp_str else datetime.now(UTC)
    gateways = normalize_gateways_payload(content, settings, now)
    snapshot = compute_ried_snapshot(gateways, now)

    LOG.info("Backfilling %d gateways for timestamp %s", len(gateways), now.isoformat())
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        stats = await persist_gateways(
            conn,
            gateways,
            snapshot,
            settings,
            now=now,
            backfill=True,
        )
        LOG.info("Backfill complete: %s", stats)


def _parse_csv_gateways(file_path: str, settings: Settings) -> dict[str, list[dict]]:
    gateways_by_time: dict[str, list[dict]] = {}
    with open(file_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            time_val = row.get("time") or row.get("timestamp")
            if not time_val:
                continue
            date_key = time_val[:10]  # group by day
            lat = float(row.get("latitude") or row.get("lat") or 0)
            lon = float(row.get("longitude") or row.get("lon") or 0)
            if not _is_in_bounds(lat, lon, settings):
                continue
            gw_id = row.get("gateway_id") or row.get("gw_id") or row.get("eui") or "unknown-gw"
            gateways_by_time.setdefault(date_key, []).append({
                "id": gw_id,
                "location": {"latitude": lat, "longitude": lon},
                "online": True,
                "updatedAt": time_val,
            })
    return gateways_by_time


async def backfill_from_csv(file_path: str):
    """Backfill historical points from TTN Mapper CSV dump."""
    settings = Settings.from_env()
    gateways_by_time = _parse_csv_gateways(file_path, settings)

    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        for date_key, raw_list in sorted(gateways_by_time.items()):
            dt = datetime.fromisoformat(date_key + "T00:00:00+00:00")
            gws = normalize_gateways_payload(raw_list, settings, dt)
            snap = compute_ried_snapshot(gws, dt)
            LOG.info("Importing date %s with %d gateways", date_key, len(gws))
            await persist_gateways(conn, gws, snap, settings, now=dt, backfill=True)


def main():
    parser = argparse.ArgumentParser(description="Backfill TTN Mapper historical data")
    parser.add_argument("--json", help="Path to JSON file with gateway list")
    parser.add_argument("--timestamp", help="Observation timestamp for JSON backfill")
    parser.add_argument("--csv", help="Path to CSV dump file")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    if args.json:
        asyncio.run(backfill_from_json(args.json, args.timestamp))
    elif args.csv:
        asyncio.run(backfill_from_csv(args.csv))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
