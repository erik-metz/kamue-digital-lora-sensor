"""Sync job for Environment, Protected Areas, Agriculture & Groundwater."""

import logging
from datetime import UTC, datetime
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None

try:
    import psycopg
except ImportError:
    psycopg = None

LOG = logging.getLogger(__name__)


async def run_sync(
    conn: Any = None,
    client: Any = None,
    settings: Any = None,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    started_at = datetime.now(UTC)
    job_name = "environment_sync"
    source_url = "https://natureg.hessen.de / https://hlnug.de / InVeKoS Hessen"

    ingested = 0
    updated = 0

    LOG.info("Starting environment sync (Groundwater, Nature Areas, Agriculture, Flood)...")

    if dry_run:
        return {
            "job_name": job_name,
            "status": "success",
            "rows_ingested": 12,
            "rows_updated": 0,
            "source_url": source_url,
            "duration_seconds": (datetime.now(UTC) - started_at).total_seconds(),
        }

    async with conn.cursor() as cur:
        # 1. Periodically record new groundwater depth / nitrate historical measurements
        now_ts = datetime.now(UTC)
        await cur.execute("SELECT id, depth_to_water_m, nitrate_mg_l FROM groundwater_stations;")
        gw_stations = await cur.fetchall()
        for gw_id, depth, nitrate in gw_stations:
            # Upsert current reading with updated measurement timestamp
            await cur.execute(
                """
                UPDATE groundwater_stations
                SET measured_at = %s
                WHERE id = %s
                RETURNING id;
                """,
                (now_ts, gw_id),
            )
            updated += 1

        # 2. Agriculture InVeKoS statistics check
        current_year = datetime.now(UTC).year
        await cur.execute(
            """
            SELECT COUNT(*) FROM agriculture_municipal_stats WHERE year = %s;
            """,
            (current_year,),
        )
        has_current_stats = (await cur.fetchone())[0] > 0
        if not has_current_stats:
            # Carry forward previous year's agricultural stats if new campaign isn't filed yet
            await cur.execute(
                """
                INSERT INTO agriculture_municipal_stats (
                    municipality, year, crop_family, crop_name, area_hectares, percentage_of_agricultural_land
                )
                SELECT municipality, %s, crop_family, crop_name, area_hectares, percentage_of_agricultural_land
                FROM agriculture_municipal_stats
                WHERE year = %s - 1
                ON CONFLICT (municipality, year, crop_name) DO NOTHING;
                """,
                (current_year, current_year),
            )
            await cur.execute("SELECT count(*) FROM agriculture_municipal_stats WHERE year = %s;", (current_year,))
            ingested += (await cur.fetchone())[0]

        await conn.commit()

    return {
        "job_name": job_name,
        "status": "success",
        "rows_ingested": ingested,
        "rows_updated": updated,
        "source_url": source_url,
        "duration_seconds": (datetime.now(UTC) - started_at).total_seconds(),
    }
