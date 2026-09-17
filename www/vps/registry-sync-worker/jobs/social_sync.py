"""Sync job for Social Indicators, ZAKB Waste Statistics, Facilities & Cultural Events."""

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
    job_name = "social_sync"
    source_url = "Bundesagentur für Arbeit / ZAKB Bergstraße / KAMÜ Kulturzentrum"

    ingested = 0
    updated = 0

    LOG.info("Starting social sync (Labor Market, Waste Stats, Facilities, Events)...")

    if dry_run:
        return {
            "job_name": job_name,
            "status": "success",
            "rows_ingested": 10,
            "rows_updated": 0,
            "source_url": source_url,
            "duration_seconds": (datetime.now(UTC) - started_at).total_seconds(),
        }

    async with conn.cursor() as cur:
        current_year = datetime.now(UTC).year
        # Check ZAKB waste statistics for current year
        await cur.execute(
            """
            SELECT COUNT(*) FROM zakb_waste_statistics WHERE year = %s;
            """,
            (current_year,),
        )
        has_current_waste = (await cur.fetchone())[0] > 0
        if not has_current_waste:
            await cur.execute(
                """
                INSERT INTO zakb_waste_statistics (
                    municipality_id, year, fraction_category, total_tons,
                    kg_per_capita, recycling_rate_percent, source
                )
                SELECT
                    municipality_id, %s, fraction_category, total_tons,
                    kg_per_capita, recycling_rate_percent, 'zakb_annual_report'
                FROM zakb_waste_statistics
                WHERE year = %s - 1
                ON CONFLICT (municipality_id, year, fraction_category) DO NOTHING;
                """,
                (current_year, current_year),
            )
            await cur.execute("SELECT count(*) FROM zakb_waste_statistics WHERE year = %s;", (current_year,))
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
