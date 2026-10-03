"""Storage module for TTN Mapper and Packet Broker gateways in PostgreSQL/TimescaleDB.
Follows the Three-Table Core Schema (entities, measurement_definitions, readings)
and maintains sensor_metadata/sensor_latest for API/Map compatibility.
"""

import json
import logging
from datetime import UTC, datetime

import psycopg
from config import Settings
from normalize import NormalizedGateway, RiedCoverageSnapshot

LOG = logging.getLogger("ttnmapper-collector.storage")


async def persist_gateways(
    conn: psycopg.AsyncConnection,
    gateways: list[NormalizedGateway],
    snapshot: RiedCoverageSnapshot,
    settings: Settings,
    now: datetime | None = None,
    payload_bytes: bytes | None = None,
    payload_sha256: str | None = None,
    backfill: bool = False,
) -> dict:
    now = now or datetime.now(UTC)
    stats = {
        "gateways_updated": 0,
        "measurements_written": 0,
        "area_metrics_written": 0,
    }
    if not gateways:
        return stats

    async with conn.transaction(), conn.cursor() as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")

        # Schema version gate if table exists
        await cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'collector_schema_versions'"
        )
        if (await cur.fetchone()) is not None:
            await cur.execute(
                "SELECT version FROM collector_schema_versions WHERE version=20260916"
            )
            if await cur.fetchone() is None:
                raise RuntimeError(
                    "Apply API schema migration 20260916 before starting collectors"
                )

        # Unique advisory lock for ttnmapper-collector
        await cur.execute("SELECT pg_advisory_xact_lock(734225, 1)")

        # Check collection_sources table
        await cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_sources'"
        )
        if (await cur.fetchone()) is not None:
            await cur.execute(
                """
                INSERT INTO collection_sources (id, adapter, enabled, config)
                VALUES ('ttnmapper', 'packetbroker', TRUE, %s)
                ON CONFLICT (id) DO UPDATE SET
                    adapter = EXCLUDED.adapter,
                    enabled = TRUE,
                    config = EXCLUDED.config,
                    updated_at = NOW()
                """,
                (
                    json.dumps({
                        "api_url": settings.packetbroker_api_url,
                        "center_lat": settings.center_lat,
                        "center_lon": settings.center_lon,
                        "radius_meters": settings.radius_meters,
                    }),
                ),
            )

        # Check Three-Table Core routine
        await cur.execute(
            "SELECT 1 FROM information_schema.routines WHERE routine_name = 'write_measurement'"
        )
        has_measurement_core = (await cur.fetchone()) is not None

        # 1. Canonical Three-Table Core Schema: Physical Gateways
        for gw in gateways:
            if has_measurement_core:
                entity_id = f"lora:gateway:{gw.gateway_id}"
                meta = {
                    "gateway_id": gw.gateway_id,
                    "eui": gw.eui,
                    "net_id": gw.net_id,
                    "tenant_id": gw.tenant_id,
                    "cluster_id": gw.cluster_id,
                    "antenna_placement": gw.antenna_placement,
                    "has_latitude": True,
                    "has_longitude": True,
                    "altitude": gw.altitude,
                    "source": "ttnmapper",
                    "description": gw.description,
                }
                await cur.execute(
                    """
                    INSERT INTO entities (id, name, entity_type, metadata)
                    VALUES (%s, %s, 'lora_gateway', %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        metadata = entities.metadata || EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    (entity_id, gw.friendly_name, json.dumps(meta)),
                )

                provenance = json.dumps({
                    "source": "packetbroker",
                    "tenant_id": gw.tenant_id,
                    "cluster_id": gw.cluster_id,
                })

                # Coordinates as reference measurements
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'latitude'::text, 'degrees'::text, 'lora-infrastructure'::text, 'reported'::text,
                        '{"crs":"EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, %s::boolean
                    )
                    """,
                    (entity_id, gw.updated_at, gw.latitude, now, provenance, backfill),
                )
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'longitude'::text, 'degrees'::text, 'lora-infrastructure'::text, 'reported'::text,
                        '{"crs":"EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, %s::boolean
                    )
                    """,
                    (entity_id, gw.updated_at, gw.longitude, now, provenance, backfill),
                )
                stats["measurements_written"] += 2

                if gw.altitude is not None:
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'altitude'::text, 'm'::text, 'lora-infrastructure'::text, 'reported'::text,
                            '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text, %s::boolean
                        )
                        """,
                        (entity_id, gw.updated_at, gw.altitude, now, provenance, backfill),
                    )
                    stats["measurements_written"] += 1

                # Online status as observed state
                online_val = 1.0 if gw.online else 0.0
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'online_status'::text, 'state'::text, 'ttnmapper'::text, 'observed'::text,
                        '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'state'::text, %s::boolean
                    )
                    """,
                    (entity_id, gw.updated_at, online_val, now, provenance, backfill),
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
                (gw.sensor_id, gw.friendly_name, gw.latitude, gw.longitude, gw.description),
            )

            status_val = 1.0 if gw.online else 0.0
            await cur.execute(
                """
                INSERT INTO sensor_data (timestamp, sensor_id, metric, value, unit)
                VALUES (%s, %s, 'online_status', %s, 'state')
                ON CONFLICT DO NOTHING
                """,
                (gw.updated_at, gw.sensor_id, status_val),
            )
            await cur.execute(
                """
                INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
                VALUES (%s, 'online_status', 'state', %s, %s)
                ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    value = EXCLUDED.value
                WHERE EXCLUDED.timestamp >= sensor_latest.timestamp
                """,
                (gw.sensor_id, gw.updated_at, status_val),
            )

            stats["gateways_updated"] += 1

        # 3. Canonical Three-Table Core Schema: Regional Ried Ausbau Tracking Area
        if has_measurement_core and snapshot.total_gateways > 0:
            area_id = "lora:area:hessisches_ried"
            area_meta = {
                "region": "Hessisches Ried",
                "center_lat": settings.center_lat,
                "center_lon": settings.center_lon,
                "radius_meters": settings.radius_meters,
                "source": "ttnmapper",
                "description": "LoRaWAN Ausbau- und Versorgungsmonitoring für das Hessische Ried",
            }
            await cur.execute(
                """
                INSERT INTO entities (id, name, entity_type, metadata)
                VALUES (%s, 'LoRaWAN-Ausbau Hessisches Ried', 'lora_coverage_area', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metadata = entities.metadata || EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (area_id, json.dumps(area_meta)),
            )

            area_provenance = json.dumps({
                "source": "ttnmapper-sync",
                "gateways_sampled": snapshot.total_gateways,
            })

            metrics = [
                ("active_gateways_count", snapshot.active_gateways, "count"),
                ("total_gateways_count", snapshot.total_gateways, "count"),
                ("outdoor_gateways_count", snapshot.outdoor_gateways, "count"),
                ("indoor_gateways_count", snapshot.indoor_gateways, "count"),
                ("online_ratio", snapshot.online_ratio_pct, "percent"),
            ]

            for metric_name, val, unit in metrics:
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, %s::text, %s::text, 'ttnmapper'::text, 'observed'::text,
                        '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text, %s::boolean
                    )
                    """,
                    (area_id, metric_name, unit, snapshot.observed_at, val, now, area_provenance, backfill),
                )
                stats["area_metrics_written"] += 1

    return stats
