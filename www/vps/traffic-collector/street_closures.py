"""Street Closures (Straßensperrungen) Collector Module for the Ried Area.
Covers Lampertheim, Rosengarten, Wehrzollhaus, Hofheim, Nordheim, Wattenheim, Biblis, Groß-Rohrheim, Bobstadt, Bürstadt.
"""

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import psycopg

LOG = logging.getLogger("traffic-collector.street-closures")

# Bounding box of the Hessian Ried
RIED_BBOX = {
    "min_lat": 49.54,
    "max_lat": 49.75,
    "min_lon": 8.33,
    "max_lon": 8.58,
}

# Municipalities and districts to target
RIED_MUNICIPALITIES = {
    "lampertheim": "Lampertheim",
    "rosengarten": "Lampertheim",
    "wehrzollhaus": "Lampertheim",
    "werzollhaus": "Lampertheim",
    "hofheim": "Lampertheim",
    "hüttenfeld": "Lampertheim",
    "neuschloß": "Lampertheim",
    "bürstadt": "Bürstadt",
    "buerstadt": "Bürstadt",
    "bobstadt": "Bürstadt",
    "bbobstadt": "Bürstadt",
    "riedrode": "Bürstadt",
    "biblis": "Biblis",
    "nordheim": "Biblis",
    "wattenheim": "Biblis",
    "groß-rohrheim": "Groß-Rohrheim",
    "gross-rohrheim": "Groß-Rohrheim",
    "großrohrheim": "Groß-Rohrheim",
}


@dataclass(frozen=True)
class ParsedClosure:
    id: str
    municipality: str
    district: str | None
    street_name: str
    location_from: str | None
    location_to: str | None
    closure_type: str  # 'full', 'partial', 'lane_restriction'
    status: str  # 'scheduled', 'active', 'extended', 'completed'
    start_time: datetime
    end_time: datetime | None
    is_active: bool
    reason: str | None
    description: str | None
    detour: str | None
    coordinates: list[list[float]] | list[float] | None
    source: str
    source_url: str | None = None


def is_in_ried_bbox(lat: float, lon: float) -> bool:
    return (
        RIED_BBOX["min_lat"] <= lat <= RIED_BBOX["max_lat"]
        and RIED_BBOX["min_lon"] <= lon <= RIED_BBOX["max_lon"]
    )


def match_ried_location(text: str) -> tuple[str, str | None] | None:
    """Detect municipality and district from text (title, location, description)."""
    text_lower = text.lower()
    for key, municipality in RIED_MUNICIPALITIES.items():
        if key in text_lower:
            district = key.capitalize() if key != municipality.lower() else None
            return municipality, district
    return None


async def persist_street_closures(
    conn: psycopg.AsyncConnection,
    closures: list[ParsedClosure],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Persist normalized closures into TimescaleDB/Postgres."""
    now = now or datetime.now(UTC)

    async with conn.transaction(), conn.cursor() as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")

        for c in closures:
            coords_json = json.dumps(c.coordinates) if c.coordinates is not None else None
            await cur.execute(
                """
                INSERT INTO street_closures (
                    id, municipality, district, street_name, location_from, location_to,
                    closure_type, status, start_time, end_time, is_active,
                    reason, description, detour, coordinates, source, source_url,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    municipality = EXCLUDED.municipality,
                    district = EXCLUDED.district,
                    street_name = EXCLUDED.street_name,
                    location_from = EXCLUDED.location_from,
                    location_to = EXCLUDED.location_to,
                    closure_type = EXCLUDED.closure_type,
                    status = EXCLUDED.status,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    is_active = EXCLUDED.is_active,
                    reason = EXCLUDED.reason,
                    description = EXCLUDED.description,
                    detour = EXCLUDED.detour,
                    coordinates = COALESCE(EXCLUDED.coordinates, street_closures.coordinates),
                    source = EXCLUDED.source,
                    source_url = EXCLUDED.source_url,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    c.id,
                    c.municipality,
                    c.district,
                    c.street_name,
                    c.location_from,
                    c.location_to,
                    c.closure_type,
                    c.status,
                    c.start_time,
                    c.end_time,
                    c.is_active,
                    c.reason,
                    c.description,
                    c.detour,
                    coords_json,
                    c.source,
                    c.source_url,
                    now,
                    now,
                ),
            )

        # Update closures whose end_time has arrived to 'completed'
        await cur.execute(
            """
            UPDATE street_closures
            SET status = 'completed',
                is_active = FALSE,
                updated_at = %s
            WHERE is_active = TRUE
              AND end_time IS NOT NULL
              AND end_time < %s
            """,
            (now, now),
        )

    LOG.info("Persisted %d street closures to database", len(closures))
    return {"persisted_closures": len(closures)}
