"""Storage module for BNetzA EMF sites and measurements in PostgreSQL/TimescaleDB.
Conforms strictly to the Three-Table Core Schema (entities, measurement_definitions, readings)
and uses the canonical write_measurement stored procedure.
"""

import json
import logging
from datetime import UTC, datetime

import psycopg

from normalize import NormalizedEmfSite

LOG = logging.getLogger("emf-collector.storage")


async def persist_emf_sites(
    conn: psycopg.AsyncConnection,
    sites: list[NormalizedEmfSite],
    now: datetime | None = None,
) -> dict[str, int]:
    """Persist normalized EMF sites into entities, measurement_definitions and readings."""
    now = now or datetime.now(UTC)
    stats = {
        "sites_saved": 0,
        "measurements_written": 0,
    }
    if not sites:
        return stats

    async with conn.transaction(), conn.cursor() as cur:
        await cur.execute("SET LOCAL statement_timeout = '60s'")
        await cur.execute("SET LOCAL lock_timeout = '15s'")

        # Register or update collection source if table exists
        await cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_sources'"
        )
        if (await cur.fetchone()) is not None:
            await cur.execute(
                """
                INSERT INTO collection_sources (id, source_url, adapter, enabled, interval_seconds, description)
                VALUES (
                    'bnetza-emf',
                    'https://www.bundesnetzagentur.de/emf-karte/',
                    'bnetza_scraper',
                    TRUE,
                    86400,
                    'Bundesnetzagentur EMF Funkanlagen & Standortbescheinigungen'
                )
                ON CONFLICT (id) DO UPDATE SET
                    enabled = TRUE,
                    description = EXCLUDED.description,
                    updated_at = NOW()
                """
            )

        # Check write_measurement procedure availability
        await cur.execute(
            "SELECT 1 FROM information_schema.routines WHERE routine_name = 'write_measurement'"
        )
        has_measurement_core = (await cur.fetchone()) is not None

        for site in sites:
            # 1. Upsert into entities
            await cur.execute(
                """
                INSERT INTO entities (id, name, entity_type, metadata)
                VALUES (%s, %s, 'radio_tower', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metadata = entities.metadata || EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (site.entity_id, site.name, json.dumps(site.raw_metadata)),
            )
            stats["sites_saved"] += 1

            if not has_measurement_core:
                continue

            provenance = json.dumps({
                "source": "bnetza_emf",
                "fid": site.fid,
                "stob_nr": site.stob_nr,
            })

            # 2. Write latitude & longitude atomically
            # Using stob_date as observed_at
            obs_time = site.stob_date

            await cur.execute(
                """
                SELECT write_measurement(
                    %s::text, 'latitude'::text, 'degrees'::text, 'bnetza-emf'::text, 'reported'::text,
                    '{"crs":"EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                    'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, FALSE::boolean
                )
                """,
                (site.entity_id, obs_time, site.latitude, now, provenance),
            )
            await cur.execute(
                """
                SELECT write_measurement(
                    %s::text, 'longitude'::text, 'degrees'::text, 'bnetza-emf'::text, 'reported'::text,
                    '{"crs":"EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                    'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, FALSE::boolean
                )
                """,
                (site.entity_id, obs_time, site.longitude, now, provenance),
            )
            stats["measurements_written"] += 2

            # 3. Maximum antenna height if present
            if site.max_height_m is not None:
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'max_antenna_height'::text, 'm'::text, 'bnetza-emf'::text, 'reported'::text,
                        '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, FALSE::boolean
                    )
                    """,
                    (site.entity_id, obs_time, site.max_height_m, now, provenance),
                )
                stats["measurements_written"] += 1

            # 4. Maximum horizontal safety distance if present
            if site.max_safety_distance_h_m is not None:
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'safety_distance_horizontal'::text, 'm'::text, 'bnetza-emf'::text, 'reported'::text,
                        '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, FALSE::boolean
                    )
                    """,
                    (site.entity_id, obs_time, site.max_safety_distance_h_m, now, provenance),
                )
                stats["measurements_written"] += 1

            # 5. Number of registered antennas
            await cur.execute(
                """
                SELECT write_measurement(
                    %s::text, 'antenna_count'::text, 'count'::text, 'bnetza-emf'::text, 'reported'::text,
                    '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                    'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text, FALSE::boolean
                )
                """,
                (site.entity_id, obs_time, site.antenna_count, now, provenance),
            )
            stats["measurements_written"] += 1

    return stats
