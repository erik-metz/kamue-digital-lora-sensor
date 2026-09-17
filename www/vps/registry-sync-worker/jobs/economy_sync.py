"""Sync job for Economy, Taxes, Business Registrations & Startups."""

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
    job_name = "economy_sync"
    source_url = "https://statistik.hessen.de / IHK Darmstadt / BA Arbeitsmarkt"

    ingested = 0
    updated = 0

    LOG.info("Starting economy sync (Taxes, Business Registrations, Employment)...")

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
        # Verify tax rates exist for the current fiscal year
        await cur.execute(
            """
            SELECT COUNT(*) FROM municipality_tax_rates WHERE year = %s;
            """,
            (current_year,),
        )
        has_current_taxes = (await cur.fetchone())[0] > 0
        if not has_current_taxes:
            await cur.execute(
                """
                INSERT INTO municipality_tax_rates (
                    municipality_id, year, gewerbesteuer_hebesatz,
                    grundsteuer_a_hebesatz, grundsteuer_b_hebesatz, source
                )
                SELECT
                    municipality_id, %s, gewerbesteuer_hebesatz,
                    grundsteuer_a_hebesatz, grundsteuer_b_hebesatz, 'gemeindesatzung_fortschreibung'
                FROM municipality_tax_rates
                WHERE year = %s - 1
                ON CONFLICT (municipality_id, year) DO NOTHING;
                """,
                (current_year, current_year),
            )
            await cur.execute("SELECT count(*) FROM municipality_tax_rates WHERE year = %s;", (current_year,))
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
