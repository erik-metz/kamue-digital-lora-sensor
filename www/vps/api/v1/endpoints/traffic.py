"""Traffic Jam (Stau) endpoints for Ried highways (A67, A5, A6) and federal roads (B47, B44)."""

import json
from datetime import UTC, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_api_key
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/traffic", tags=["Traffic & Stau"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class TrafficIncidentResponse(BaseModel):
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    start_time: datetime
    end_time: datetime | None = None
    last_seen_at: datetime
    is_active: bool
    delay_seconds: int
    delay_minutes: int
    length_meters: int
    length_km: float
    severity: str = Field(..., description="'minor' | 'moderate' | 'major' | 'standstill'")
    cause_type: str = Field(default="congestion", description="'congestion' | 'accident' | 'roadwork' | 'closure'")
    description: str | None = None
    coordinates: list[list[float]] | None = None
    source: str
    delay_kind: str = "unknown"
    source_category: str = "unknown"
    timestamp_kind: str = "collector_observed"


class TrafficHistoryResponse(BaseModel):
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    delay_seconds: int
    length_meters: int
    severity: str
    cause_type: str
    description: str | None = None


class CorridorStatus(BaseModel):
    corridor_id: str
    road_name: str
    name: str
    status: str = Field(..., description="'clear' | 'sluggish' | 'congestion' | 'closure'")
    delay_seconds: int
    delay_minutes: int
    active_incidents_count: int
    description: str


class IngestIncidentPayload(BaseModel):
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    delay_seconds: int = 0
    length_meters: int = 0
    severity: str = "moderate"
    cause_type: str = "congestion"
    description: str | None = None
    coordinates: list[list[float]] | None = None
    source: str = "autobahn_api"


class SyncTrafficPayload(BaseModel):
    incidents: list[IngestIncidentPayload]


RIED_CORRIDORS = [
    {
        "corridor_id": "corridor-a67",
        "road_name": "A67",
        "name": "A67 (Darmstadt ↔ Lorsch ↔ Viernheim)",
    },
    {
        "corridor_id": "corridor-b47",
        "road_name": "B47",
        "name": "B47 (Worms Rheinbrücke ↔ Bürstadt ↔ Lorsch ↔ Bensheim)",
    },
    {
        "corridor_id": "corridor-b44",
        "road_name": "B44",
        "name": "B44 (Biblis ↔ Bürstadt ↔ Lampertheim ↔ Mannheim)",
    },
    {
        "corridor_id": "corridor-a5",
        "road_name": "A5",
        "name": "A5 (Darmstadt ↔ Bensheim ↔ Heppenheim ↔ Weinheim)",
    },
    {
        "corridor_id": "corridor-a6",
        "road_name": "A6",
        "name": "A6 (Viernheimer Dreieck ↔ Mannheim ↔ Ludwigshafen)",
    },
]


@router.get("/incidents", response_model=list[TrafficIncidentResponse])
async def list_active_incidents(
    pool: DbPool,
    road: str | None = Query(default=None, description="Filter by road, e.g. A67, B47, B44"),
    include_cleared_hours: int = Query(default=0, ge=0, le=48, description="Include incidents cleared within the last N hours"),
):
    """List current active traffic jams, roadworks, and closures in the Ried."""
    query = """
        SELECT id, road_name, direction, location_from, location_to,
               start_time, end_time, last_seen_at, is_active,
               delay_seconds, length_meters, severity, cause_type,
               description, coordinates, source, delay_kind, source_category
        FROM traffic_incidents
        WHERE (is_active = TRUE OR (end_time >= NOW() - (%s * INTERVAL '1 hour')))
    """
    params: list[Any] = [include_cleared_hours]

    if road:
        query += " AND UPPER(road_name) = UPPER(%s)"
        params.append(road)

    query += " ORDER BY delay_seconds DESC, start_time DESC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    results = []
    for r in rows:
        coords = r["coordinates"]
        if isinstance(coords, str):
            try:
                coords = json.loads(coords)
            except (json.JSONDecodeError, TypeError, ValueError):
                coords = None
        delay_sec = r["delay_seconds"] or 0
        len_m = r["length_meters"] or 0
        results.append(
            TrafficIncidentResponse(
                id=r["id"],
                road_name=r["road_name"],
                direction=r["direction"],
                location_from=r["location_from"],
                location_to=r["location_to"],
                start_time=r["start_time"],
                end_time=r["end_time"],
                last_seen_at=r["last_seen_at"],
                is_active=r["is_active"],
                delay_seconds=delay_sec,
                delay_minutes=round(delay_sec / 60),
                length_meters=len_m,
                length_km=round(len_m / 1000.0, 1),
                severity=r["severity"],
                cause_type=r["cause_type"],
                description=r["description"],
                coordinates=coords,
                source=r["source"],
                delay_kind=r.get("delay_kind", "unknown"),
                source_category=r.get("source_category", "unknown"),
            )
        )
    return results


@router.get("/history", response_model=list[TrafficHistoryResponse])
async def list_traffic_history(
    pool: DbPool,
    road: str | None = Query(default=None, description="Filter by road, e.g. A67, B47"),
    days: int = Query(default=7, ge=1, le=90, description="History in days"),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Retrieve historical resolved traffic jams to analyze recurring bottlenecks (place from-to, time from-till)."""
    query = """
        SELECT id, road_name, direction, location_from, location_to,
               start_time, end_time, delay_seconds, length_meters,
               severity, cause_type, description
        FROM traffic_incidents
        WHERE end_time IS NOT NULL
          AND start_time >= NOW() - (%s * INTERVAL '1 day')
    """
    params: list[Any] = [days]

    if road:
        query += " AND UPPER(road_name) = UPPER(%s)"
        params.append(road)

    query += " ORDER BY start_time DESC LIMIT %s"
    params.append(limit)

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    results = []
    for r in rows:
        st = r["start_time"]
        et = r["end_time"]
        duration_min = round((et - st).total_seconds() / 60) if et and st else 0
        results.append(
            TrafficHistoryResponse(
                id=r["id"],
                road_name=r["road_name"],
                direction=r["direction"],
                location_from=r["location_from"],
                location_to=r["location_to"],
                start_time=st,
                end_time=et,
                duration_minutes=max(1, duration_min),
                delay_seconds=r["delay_seconds"] or 0,
                length_meters=r["length_meters"] or 0,
                severity=r["severity"],
                cause_type=r["cause_type"],
                description=r["description"],
            )
        )
    return results


@router.get("/corridors", response_model=list[CorridorStatus])
async def get_corridor_statuses(pool: DbPool):
    """Return live aggregate status for the 5 key Ried commuter corridors."""
    query = """
        SELECT road_name,
               COUNT(*) AS active_count,
               COALESCE(MAX(delay_seconds), 0) AS max_delay,
               COALESCE(MAX(CASE WHEN severity = 'standstill' THEN 4
                                 WHEN severity = 'major' THEN 3
                                 WHEN severity = 'moderate' THEN 2
                                 ELSE 1 END), 1) AS max_severity_rank
        FROM traffic_incidents
        WHERE is_active = TRUE
        GROUP BY road_name
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query)
        rows = await cur.fetchall()

    stats_by_road: dict[str, dict[str, Any]] = {}
    for r in rows:
        stats_by_road[r["road_name"].upper()] = {
            "active_count": r["active_count"],
            "max_delay": r["max_delay"],
            "max_severity_rank": r["max_severity_rank"],
        }

    corridor_results = []
    for c in RIED_CORRIDORS:
        road = c["road_name"].upper()
        stat = stats_by_road.get(road, {"active_count": 0, "max_delay": 0, "max_severity_rank": 1})
        delay_sec = stat["max_delay"]
        active_count = stat["active_count"]
        rank = stat["max_severity_rank"]

        if active_count == 0:
            status_val = "clear"
            desc = "Freie Fahrt ohne gemeldete Behinderungen"
        elif rank >= 4 or delay_sec >= 900:
            status_val = "congestion"
            desc = f"{active_count} Störung(en), bis zu +{round(delay_sec / 60)} Min. Zeitverlust"
        elif delay_sec >= 300:
            status_val = "sluggish"
            desc = f"Zähflüssiger Verkehr, ca. +{round(delay_sec / 60)} Min. Verzögerung"
        else:
            status_val = "clear"
            desc = f"{active_count} Baustelle/Meldung, geringer Zeitverlust"

        corridor_results.append(
            CorridorStatus(
                corridor_id=c["corridor_id"],
                road_name=c["road_name"],
                name=c["name"],
                status=status_val,
                delay_seconds=delay_sec,
                delay_minutes=round(delay_sec / 60),
                active_incidents_count=active_count,
                description=desc,
            )
        )
    return corridor_results


@router.post("/sync", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_api_key)])
async def sync_traffic_incidents(payload: SyncTrafficPayload, pool: DbPool):
    """
    Ingest live traffic incidents from collector.
    Upserts active incidents and marks omitted incidents as resolved (end_time = NOW()).
    """
    now = datetime.now(UTC)
    incoming_ids = [inc.id for inc in payload.incidents]

    async with pool.connection() as conn, conn.cursor() as cur:
        # 1. Upsert incoming active incidents
        for inc in payload.incidents:
            coords_json = json.dumps(inc.coordinates) if inc.coordinates is not None else None
            await cur.execute(
                """
                INSERT INTO traffic_incidents (
                    id, road_name, direction, location_from, location_to,
                    start_time, end_time, last_seen_at, is_active,
                    delay_seconds, length_meters, severity, cause_type,
                    description, coordinates, source, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, NULL, %s, TRUE,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
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
                    updated_at = EXCLUDED.updated_at
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
                ),
            )

        # 2. Mark incidents not present in this cycle as resolved if older than threshold
        if incoming_ids:
            await cur.execute(
                """
                UPDATE traffic_incidents
                SET is_active = FALSE,
                    end_time = %s,
                    updated_at = %s
                WHERE is_active = TRUE
                  AND id != ALL(%s)
                  AND last_seen_at < %s - INTERVAL '6 minutes'
                """,
                (now, now, incoming_ids, now),
            )
        else:
            await cur.execute(
                """
                UPDATE traffic_incidents
                SET is_active = FALSE,
                    end_time = %s,
                    updated_at = %s
                WHERE is_active = TRUE
                  AND last_seen_at < %s - INTERVAL '6 minutes'
                """,
                (now, now, now),
            )

    return {"status": "synced", "count": len(payload.incidents)}
