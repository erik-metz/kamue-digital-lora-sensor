"""Storage module for traffic incidents and corridor snapshots in PostgreSQL/TimescaleDB."""

import json
import logging
from datetime import UTC, datetime

import psycopg
from config import Settings
from normalize import ParsedIncident

LOG = logging.getLogger("traffic-collector.storage")


async def persist_traffic_incidents(
    conn: psycopg.AsyncConnection,
    incidents: list[ParsedIncident],
    settings: Settings,
    now: datetime | None = None,
) -> dict:
    now = now or datetime.now(UTC)
    incoming_ids = [inc.id for inc in incidents]

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
        await cur.execute("SELECT pg_advisory_xact_lock(734221, 1)")
        # 1. Upsert active incidents
        for inc in incidents:
            coords_json = (
                json.dumps(inc.coordinates) if inc.coordinates is not None else None
            )
            await cur.execute(
                """
                INSERT INTO traffic_incidents (
                    id, road_name, direction, location_from, location_to,
                    start_time, end_time, last_seen_at, is_active,
                    delay_seconds, length_meters, severity, cause_type,
                    description, coordinates, source, updated_at, delay_kind, source_category
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, NULL, %s, TRUE,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    direction = EXCLUDED.direction,
                    location_from = EXCLUDED.location_from,
                    location_to = EXCLUDED.location_to,
                    last_seen_at = EXCLUDED.last_seen_at,
                    is_active = TRUE,
                    end_time = NULL,
                    delay_seconds = EXCLUDED.delay_seconds,
                    length_meters = EXCLUDED.length_meters,
                    severity = EXCLUDED.severity,
                    cause_type = EXCLUDED.cause_type,
                    description = EXCLUDED.description,
                    coordinates = COALESCE(EXCLUDED.coordinates, traffic_incidents.coordinates),
                    updated_at = EXCLUDED.updated_at,
                    delay_kind = EXCLUDED.delay_kind,
                    source_category = EXCLUDED.source_category
                """,
                (
                    inc.id,
                    inc.road_name,
                    inc.direction,
                    inc.location_from,
                    inc.location_to,
                    now,
                    now,
                    inc.delay_seconds,
                    inc.length_meters,
                    inc.severity,
                    inc.cause_type,
                    inc.description,
                    coords_json,
                    inc.source,
                    now,
                    inc.delay_kind,
                    inc.category,
                ),
            )

        # 2. Mark incidents that are no longer reported as resolved (is_active=False, end_time=now)
        await cur.execute(
            """UPDATE traffic_incidents SET is_active=FALSE, end_time=%s, updated_at=%s
               WHERE is_active=TRUE AND source='autobahn_api' AND road_name=ANY(%s)
                 AND id != ALL(%s::varchar[]) AND last_seen_at < %s - INTERVAL '6 minutes'""",
            (now, now, list(settings.roads), incoming_ids, now),
        )

        # 3. Record periodic snapshot for environmental correlation in hypertable
        for road in settings.roads:
            active_on_road = [
                inc for inc in incidents if inc.road_name.upper() == road.upper()
            ]
            count = len(active_on_road)
            max_delay = max((inc.delay_seconds for inc in active_on_road), default=0)
            max_len = max((inc.length_meters for inc in active_on_road), default=0)

            status_val = "clear"
            if count > 0:
                if (
                    any(inc.cause_type == "closure" for inc in active_on_road)
                    or max_delay >= 900
                ):
                    status_val = "congestion"
                elif max_delay >= 300:
                    status_val = "sluggish"
                else:
                    status_val = "clear"

            await cur.execute(
                """
                INSERT INTO traffic_corridor_snapshots (
                    timestamp, corridor_id, road_name, status,
                    delay_seconds, active_incidents_count, max_length_meters
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    now,
                    f"corridor-{road.lower()}",
                    road.upper(),
                    status_val,
                    max_delay,
                    count,
                    max_len,
                ),
            )

    LOG.info("Persisted %d active traffic incidents to database", len(incidents))
    return {"active_incidents": len(incidents)}
