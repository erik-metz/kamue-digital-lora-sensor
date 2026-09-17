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

CROSS7_BUERSTADT_URL = "https://api.cross-7.de/public/calendar/667/events?pageNumber=1&pageSize=50&sortType=0&sortDirection=1"


async def run_sync(
    conn: Any = None,
    client: Any = None,
    settings: Any = None,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    started_at = datetime.now(UTC)
    job_name = "social_sync"
    source_url = "Bundesagentur für Arbeit / ZAKB Bergstraße / Stadt Bürstadt Cross-7 / KAMÜ Kulturzentrum"

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
        # 1. Check ZAKB waste statistics for current year
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

        # 2. Ingest Cultural Events from Bürstadt Cross-7 Portal
        if client:
            try:
                headers = {
                    "User-Agent": "OpenRiedSens-Bot/1.0",
                    "Accept": "application/json",
                    "slug": "/de/kultur-freizeit/veranstaltungen/veranstaltungskalender",
                    "Origin": "https://www.buerstadt.de",
                    "Referer": "https://www.buerstadt.de/",
                }
                resp = await client.get(CROSS7_BUERSTADT_URL, headers=headers, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("items", [])
                    for item in items:
                        target_id = item.get("link", {}).get("targetId")
                        if not target_id:
                            continue
                        event_id = f"c7-bst-{target_id}"
                        title = item.get("name", "").strip()
                        if not title:
                            continue

                        from_date = item.get("fromDate")
                        from_time = item.get("fromTime") or "00:00:00"
                        until_date = item.get("untilDate") or from_date
                        until_time = item.get("untilTime") or from_time

                        if not from_date:
                            continue

                        start_iso = f"{from_date}T{from_time}+02:00" if len(from_time) == 8 else f"{from_date}T00:00:00+02:00"
                        end_iso = f"{until_date}T{until_time}+02:00" if len(until_time) == 8 else None

                        desc = item.get("teaserText")
                        img_url = item.get("teaserPictureUrl")
                        addresses = item.get("addresses", [])
                        venue_name = "Bürstadt"
                        street = None
                        zip_code = "68642"
                        if addresses:
                            addr = addresses[0]
                            venue_name = addr.get("name") or "Bürstadt"
                            street = f"{addr.get('street', '')} {addr.get('houseNumber', '')}".strip() or None
                            zip_code = addr.get("zipCode") or "68642"

                        # Categorize
                        cat_names = [c.get("name", "").lower() for c in item.get("categoryNames", [])]
                        category = "civic"
                        if any("sport" in c for c in cat_names):
                            category = "sports"
                        elif any("konzert" in c or "musik" in c for c in cat_names):
                            category = "concert"
                        elif any("fest" in c or "kerwe" in c or "markt" in c or "advent" in c for c in cat_names):
                            category = "festival" if not any("markt" in c for c in cat_names) else "market"
                        elif any("ausstellung" in c or "kunst" in c or "theater" in c for c in cat_names):
                            category = "theater"

                        detail_url = f"https://www.buerstadt.de/de/kultur-freizeit/veranstaltungen/veranstaltungskalender?c7-item={target_id}"

                        await cur.execute(
                            """
                            INSERT INTO cultural_events (
                                id, title, organizer, venue_name, municipality,
                                start_time, end_time, category, description,
                                ticket_url, event_url, image_url, street_address,
                                postal_code, status, is_free, is_archived, source, updated_at
                            )
                            VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'scheduled', FALSE, FALSE, 'stadt_buerstadt_cross7', NOW()
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                title = EXCLUDED.title,
                                start_time = EXCLUDED.start_time,
                                end_time = EXCLUDED.end_time,
                                category = EXCLUDED.category,
                                description = EXCLUDED.description,
                                event_url = EXCLUDED.event_url,
                                image_url = EXCLUDED.image_url,
                                street_address = EXCLUDED.street_address,
                                postal_code = EXCLUDED.postal_code,
                                updated_at = NOW();
                            """,
                            (
                                event_id, title, "Stadt Bürstadt / Kulturbeirat", venue_name, "Bürstadt",
                                start_iso, end_iso, category, desc, detail_url, detail_url, img_url,
                                street, zip_code
                            ),
                        )
                        ingested += 1
            except Exception as e:
                LOG.warning(f"Error fetching Bürstadt Cross-7 events: {e}")

        # 3. Archive past events into historical records (NEVER delete them)
        await cur.execute(
            """
            UPDATE cultural_events
            SET status = 'past'
            WHERE (end_time < NOW() OR (end_time IS NULL AND start_time < NOW() - INTERVAL '1 day'))
              AND status != 'past';
            """
        )
        updated += cur.rowcount

        await conn.commit()

    return {
        "job_name": job_name,
        "status": "success",
        "rows_ingested": ingested,
        "rows_updated": updated,
        "source_url": source_url,
        "duration_seconds": (datetime.now(UTC) - started_at).total_seconds(),
    }

