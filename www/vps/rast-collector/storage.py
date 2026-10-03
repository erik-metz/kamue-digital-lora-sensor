"""Storage module for rast-monitor truck parking sites in PostgreSQL/TimescaleDB.
Follows the Three-Table Core Schema (entities, measurement_definitions, readings)
and maintains sensor_metadata/sensor_latest for API/Map compatibility.
"""

import json
import logging
from datetime import UTC, datetime

import psycopg
from config import Settings
from normalize import RastSiteObservation

LOG = logging.getLogger("rast-collector.storage")


async def persist_rast_sites(
    conn: psycopg.AsyncConnection,
    sites: list[RastSiteObservation],
    settings: Settings,
    now: datetime | None = None,
) -> dict:
    now = now or datetime.now(UTC)
    stats = {
        "sites_updated": 0,
        "measurements_written": 0,
    }
    if not sites:
        return stats

    async with conn.transaction(), conn.cursor() as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")
        await cur.execute(
            "SELECT version FROM collector_schema_versions WHERE version=20260916"
        )
        if await cur.fetchone() is None:
            raise RuntimeError(
                "Apply API schema migration 20260916 before starting collectors"
            )

        # Unique advisory lock for rast-collector
        await cur.execute("SELECT pg_advisory_xact_lock(734222, 1)")

        await cur.execute(
            "SELECT 1 FROM information_schema.routines WHERE routine_name = 'write_measurement'"
        )
        has_measurement_core = (await cur.fetchone()) is not None

        for s in sites:
            desc = (
                f"LKW-Rastplatz {s.road} {s.name}"
                + (f" · Fahrtrichtung {s.destination}" if s.destination else "")
                + f" · {s.capacity or '?'} Stellplätze · Quelle: rast-monitor.de"
            )

            # 1. Canonical Three-Table Core Schema
            if has_measurement_core:
                entity_id = f"sensor:{s.sensor_id}"
                meta = {
                    "datex_id": s.datex_id,
                    "road": s.road,
                    "destination": s.destination,
                    "operator": s.operator,
                    "total_spaces": s.capacity,
                    "has_latitude": True,
                    "has_longitude": True,
                    "site_status": s.site_status,
                    "opening_status": s.opening_status,
                    "detection_type": s.detection_type,
                    "source_url": "https://rast-monitor.de",
                    "description": desc,
                }
                await cur.execute(
                    """
                    INSERT INTO entities (id, name, entity_type, metadata)
                    VALUES (%s, %s, 'truck_parking', %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        metadata = entities.metadata || EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    (entity_id, s.friendly_name, json.dumps(meta)),
                )

                provenance = json.dumps({
                    "source": "rast-monitor",
                    "datex_id": s.datex_id,
                    "road": s.road,
                })

                # Coordinates
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s, 'latitude', 'degrees', 'sensor-inventory', 'reported',
                        '{"crs":"EPSG:4326"}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'reference'
                    )
                    """,
                    (entity_id, s.observed_at, s.latitude, now, provenance),
                )
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s, 'longitude', 'degrees', 'sensor-inventory', 'reported',
                        '{"crs":"EPSG:4326"}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'reference'
                    )
                    """,
                    (entity_id, s.observed_at, s.longitude, now, provenance),
                )
                stats["measurements_written"] += 2

                legacy_source = f"legacy-sensor:{s.sensor_id}"
                basis = "model" if s.detection_type == "modelBased" else "observed"

                if s.capacity is not None:
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s, 'parking_capacity', 'count', %s, 'reported',
                            '{}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'instantaneous'
                        )
                        """,
                        (entity_id, legacy_source, s.observed_at, s.capacity, now, provenance),
                    )
                    stats["measurements_written"] += 1

                if s.occupancy_pct is not None:
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s, 'parking_occupancy_pct', '%%', %s, %s,
                            '{}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'instantaneous'
                        )
                        """,
                        (entity_id, legacy_source, basis, s.observed_at, s.occupancy_pct, now, provenance),
                    )
                    stats["measurements_written"] += 1

                if s.occupied_spaces is not None:
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s, 'parking_occupied', 'count', %s, %s,
                            '{}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'instantaneous'
                        )
                        """,
                        (entity_id, legacy_source, basis, s.observed_at, s.occupied_spaces, now, provenance),
                    )
                    stats["measurements_written"] += 1

                if s.free_spaces is not None:
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s, 'parking_free', 'count', %s, %s,
                            '{}'::jsonb, %s, %s, %s, %s::jsonb, 'valid', NULL, NULL, 'instantaneous'
                        )
                        """,
                        (entity_id, legacy_source, basis, s.observed_at, s.free_spaces, now, provenance),
                    )
                    stats["measurements_written"] += 1

            # 2. Legacy Telemetry & Map Compatibility (sensor_metadata, sensor_data, sensor_latest)
            await cur.execute(
                """
                INSERT INTO sensor_metadata (id, friendly_name, latitude, longitude, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    friendly_name = EXCLUDED.friendly_name,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    description = EXCLUDED.description
                """,
                (s.sensor_id, s.friendly_name, s.latitude, s.longitude, desc),
            )

            metrics_to_record = []
            if s.capacity is not None:
                metrics_to_record.append(("parking_capacity", float(s.capacity), "count"))
            if s.occupancy_pct is not None:
                metrics_to_record.append(("parking_occupancy_pct", float(s.occupancy_pct), "%"))
            if s.occupied_spaces is not None:
                metrics_to_record.append(("parking_occupied", float(s.occupied_spaces), "count"))
            if s.free_spaces is not None:
                metrics_to_record.append(("parking_free", float(s.free_spaces), "count"))

            for metric_name, metric_val, metric_unit in metrics_to_record:
                await cur.execute(
                    """
                    INSERT INTO sensor_data (timestamp, sensor_id, metric, value, unit)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (s.observed_at, s.sensor_id, metric_name, metric_val, metric_unit),
                )
                await cur.execute(
                    """
                    INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
                        timestamp = EXCLUDED.timestamp,
                        value = EXCLUDED.value
                    WHERE EXCLUDED.timestamp >= sensor_latest.timestamp
                    """,
                    (s.sensor_id, metric_name, metric_unit, s.observed_at, metric_val),
                )

            stats["sites_updated"] += 1

    return stats
