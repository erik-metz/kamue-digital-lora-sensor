"""Storage module for traffic incidents and corridor snapshots in PostgreSQL/TimescaleDB."""

import json
import logging
from datetime import UTC, datetime

import psycopg
from config import Settings
from normalize import ParsedIncident
from traffic_flow import FlowObservation

LOG = logging.getLogger("traffic-collector.storage")


async def persist_traffic_incidents(
    conn: psycopg.AsyncConnection,
    incidents: list[ParsedIncident],
    settings: Settings,
    now: datetime | None = None,
    flows: list[FlowObservation] | None = None,
    reconcile_hessen: bool = False,
) -> dict:
    now = now or datetime.now(UTC)
    incoming_ids = [inc.id for inc in incidents]

    async with conn.transaction(), conn.cursor() as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")
        await cur.execute(
            "SELECT version FROM collector_schema_versions WHERE version=20261009"
        )
        if await cur.fetchone() is None:
            raise RuntimeError(
                "Apply API schema migration 20261009 before starting collectors"
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
                    description, coordinates, source, updated_at, delay_kind, source_category,
                    provider_id, provider_start_at, provider_end_at, overall_end_date,
                    provider_future, closure_kind, work_length_meters, display_type, title
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, NULL, %s, TRUE,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                    source_category = EXCLUDED.source_category,
                    provider_id = EXCLUDED.provider_id,
                    provider_start_at = EXCLUDED.provider_start_at,
                    provider_end_at = EXCLUDED.provider_end_at,
                    overall_end_date = EXCLUDED.overall_end_date,
                    provider_future = EXCLUDED.provider_future,
                    closure_kind = EXCLUDED.closure_kind,
                    work_length_meters = EXCLUDED.work_length_meters,
                    display_type = EXCLUDED.display_type,
                    title = EXCLUDED.title
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
                    inc.provider_id,
                    inc.provider_start_at,
                    inc.provider_end_at,
                    inc.overall_end_date,
                    inc.provider_future,
                    inc.closure_kind,
                    inc.work_length_meters,
                    inc.display_type,
                    inc.title,
                ),
            )

        # 2. Mark incidents that are no longer reported as resolved (is_active=False, end_time=now)
        await cur.execute(
            """UPDATE traffic_incidents SET is_active=FALSE, end_time=%s, updated_at=%s
               WHERE is_active=TRUE AND source='autobahn_api' AND road_name=ANY(%s)
                 AND id != ALL(%s::varchar[]) AND last_seen_at < %s - INTERVAL '6 minutes'""",
            (now, now, list(settings.roads), incoming_ids, now),
        )
        if reconcile_hessen:
            await cur.execute(
                """UPDATE traffic_incidents SET is_active=FALSE, end_time=%s, updated_at=%s
                   WHERE is_active=TRUE AND source='hessen_verkehrsservice'
                     AND id != ALL(%s::varchar[]) AND last_seen_at < %s - INTERVAL '15 minutes'""",
                (now, now, incoming_ids, now),
            )

            for road in set(settings.roads) | {"B44", "B47"}:
                await cur.execute(
                    """INSERT INTO traffic_source_checks (road_name,source,last_success_at)
                       VALUES (%s,'hessen_verkehrsservice',%s) ON CONFLICT (road_name,source)
                       DO UPDATE SET last_success_at=EXCLUDED.last_success_at""",
                    (road, now),
                )

        for road in settings.roads:
            await cur.execute(
                """INSERT INTO traffic_source_checks (road_name,source,last_success_at)
                   VALUES (%s,'autobahn_api',%s) ON CONFLICT (road_name,source)
                   DO UPDATE SET last_success_at=EXCLUDED.last_success_at""",
                (road, now),
            )
        incidents = [inc for inc in incidents if inc.event_status(now) == "active"]

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
                    any(inc.closure_kind == "full" for inc in active_on_road)
                    or max_delay >= 900
                ):
                    status_val = (
                        "closure"
                        if any(inc.closure_kind == "full" for inc in active_on_road)
                        else "congestion"
                    )
                elif max_delay >= 300:
                    status_val = "sluggish"
                else:
                    status_val = (
                        "unknown"
                        if any(inc.delay_kind == "unknown" for inc in active_on_road)
                        else "clear"
                    )

            await cur.execute(
                """
                INSERT INTO traffic_corridor_snapshots (
                    timestamp, corridor_id, road_name, status,
                    delay_seconds, active_incidents_count, max_length_meters, delay_kind
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    now,
                    f"corridor-{road.lower()}",
                    road.upper(),
                    status_val,
                    max_delay,
                    count,
                    max_len,
                    "unknown"
                    if any(inc.delay_kind == "unknown" for inc in active_on_road)
                    or not active_on_road
                    else "estimated"
                    if any(inc.delay_kind == "estimated" for inc in active_on_road)
                    else "reported",
                ),
            )

        # 4. Canonical Core Schema: entities, measurement_definitions, readings
        await cur.execute(
            "SELECT 1 WHERE to_regprocedure('write_measurement(text,text,text,text,text,jsonb,timestamptz,numeric,timestamptz,jsonb,text,timestamptz,timestamptz,text,boolean)') IS NOT NULL"
        )
        has_measurement_core = (await cur.fetchone()) is not None

        if has_measurement_core:
            # 4a. Corridor snapshot measurements
            for road in settings.roads:
                corridor_id = f"corridor-{road.lower()}"
                active_on_road = [
                    inc for inc in incidents if inc.road_name.upper() == road.upper()
                ]
                count = len(active_on_road)
                max_delay = max(
                    (inc.delay_seconds for inc in active_on_road), default=0
                )
                await cur.execute(
                    """
                    INSERT INTO entities (id, name, entity_type, metadata)
                    VALUES (%s, %s, 'corridor', %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        metadata = entities.metadata || EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    (
                        corridor_id,
                        f"Autobahn-Korridor {road.upper()}",
                        json.dumps({"road": road.upper()}),
                    ),
                )
                if active_on_road and all(
                    inc.delay_kind != "unknown" for inc in active_on_road
                ):
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'delay'::text, 's'::text, 'autobahn_api'::text, %s::text,
                            '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text
                        )
                        """,
                        (
                            corridor_id,
                            "model"
                            if any(
                                inc.delay_kind == "estimated" for inc in active_on_road
                            )
                            else "reported",
                            now,
                            max_delay,
                            now,
                            json.dumps({"road": road.upper()}),
                        ),
                    )
                await cur.execute(
                    """
                    SELECT write_measurement(
                        %s::text, 'active_incidents'::text, 'count'::text, 'autobahn_api'::text, 'observed'::text,
                        '{}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                        'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text
                    )
                    """,
                    (
                        corridor_id,
                        now,
                        count,
                        now,
                        json.dumps({"road": road.upper()}),
                    ),
                )

            # 4b. Road segment flow measurements
            if flows:
                for flow in flows:
                    c = flow.corridor
                    meta = {
                        "road": c.road,
                        "direction": c.direction,
                        "start_junction": c.start_junction,
                        "end_junction": c.end_junction,
                        "length_km": c.length_km,
                        "center_lat": c.lat,
                        "center_lon": c.lon,
                    }
                    await cur.execute(
                        """
                        INSERT INTO entities (id, name, entity_type, metadata)
                        VALUES (%s, %s, 'road_segment', %s)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            metadata = entities.metadata || EXCLUDED.metadata,
                            updated_at = NOW()
                        """,
                        (c.id, c.name, json.dumps(meta)),
                    )
                    dims = json.dumps({"road": c.road, "direction": c.direction})
                    prov = json.dumps(
                        {
                            "source": flow.source,
                            "status": flow.status,
                            "confidence": flow.confidence,
                        }
                    )
                    basis = "observed" if flow.source == "tomtom_flow" else "model"

                    # Speed
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'speed'::text, 'km/h'::text, %s::text, %s::text,
                            %s::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text
                        )
                        """,
                        (
                            c.id,
                            flow.source,
                            basis,
                            dims,
                            now,
                            flow.speed_kmh,
                            now,
                            prov,
                        ),
                    )
                    # Free flow speed (reference value reported by flow model)
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'free_flow_speed'::text, 'km/h'::text, %s::text, 'reported'::text,
                            %s::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text
                        )
                        """,
                        (
                            c.id,
                            flow.source,
                            dims,
                            now,
                            flow.free_flow_speed_kmh,
                            now,
                            prov,
                        ),
                    )
                    # Delay
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'delay'::text, 's'::text, %s::text, %s::text,
                            %s::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text
                        )
                        """,
                        (
                            c.id,
                            flow.source,
                            basis,
                            dims,
                            now,
                            flow.delay_seconds,
                            now,
                            prov,
                        ),
                    )
                    # Congestion ratio
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'congestion_ratio'::text, 'ratio'::text, %s::text, %s::text,
                            '{"range": "0-1"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'instantaneous'::text
                        )
                        """,
                        (
                            c.id,
                            flow.source,
                            basis,
                            now,
                            flow.congestion_ratio,
                            now,
                            prov,
                        ),
                    )
                    # Coordinates as reference
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'latitude'::text, 'degrees'::text, %s::text, 'reported'::text,
                            '{"crs": "EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text
                        )
                        """,
                        (c.id, flow.source, now, c.lat, now, prov),
                    )
                    await cur.execute(
                        """
                        SELECT write_measurement(
                            %s::text, 'longitude'::text, 'degrees'::text, %s::text, 'reported'::text,
                            '{"crs": "EPSG:4326"}'::jsonb, %s::timestamptz, %s::numeric, %s::timestamptz, %s::jsonb,
                            'valid'::text, NULL::timestamptz, NULL::timestamptz, 'reference'::text
                        )
                        """,
                        (c.id, flow.source, now, c.lon, now, prov),
                    )

    LOG.info("Persisted %d active traffic incidents to database", len(incidents))
    result: dict[str, int] = {"active_incidents": len(incidents)}
    if flows is not None:
        result["persisted_flows"] = len(flows)
    return result
