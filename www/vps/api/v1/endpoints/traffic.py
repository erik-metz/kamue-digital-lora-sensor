"""Traffic Jam (Stau) endpoints for Ried highways (A67, A5, A6) and federal roads (B47, B44)."""

import json
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

import psycopg_pool
from dependencies import get_db_pool, verify_api_key
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from traffic_semantics import summarize_corridor

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
    delay_seconds: int | None
    delay_minutes: int | None
    length_meters: int
    length_km: float
    severity: str = Field(
        ..., description="'minor' | 'moderate' | 'major' | 'standstill'"
    )
    cause_type: str = Field(
        default="congestion",
        description="'congestion' | 'accident' | 'roadwork' | 'closure'",
    )
    description: str | None = None
    coordinates: list[list[float]] | None = None
    source: str
    delay_kind: str = "unknown"
    source_category: str = "unknown"
    timestamp_kind: str = "collector_observed"
    provider_id: str | None = None
    provider_start_at: datetime | None = None
    provider_end_at: datetime | None = None
    overall_end_date: str | None = None
    provider_future: bool = False
    closure_kind: str = "unknown"
    work_length_meters: int | None = None
    display_type: str | None = None
    title: str | None = None
    event_status: str = "active"
    is_stale: bool = False


class TrafficHistoryResponse(BaseModel):
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    delay_seconds: int | None
    delay_kind: str = "unknown"
    timestamp_kind: str = "collector_observed"
    length_meters: int
    severity: str
    cause_type: str
    description: str | None = None


class CorridorStatus(BaseModel):
    corridor_id: str
    road_name: str
    name: str
    status: str = Field(
        ..., description="'clear' | 'sluggish' | 'congestion' | 'closure' | 'unknown'"
    )
    delay_seconds: int | None
    delay_minutes: int | None
    active_incidents_count: int
    description: str
    delay_kind: str = "unknown"
    last_success_at: datetime | None = None
    is_stale: bool = True


class IngestIncidentPayload(BaseModel):
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    delay_seconds: int = 0
    delay_kind: Literal["unknown", "reported", "estimated"] = "unknown"
    length_meters: int = 0
    severity: str = "moderate"
    cause_type: str = "congestion"
    description: str | None = None
    coordinates: list[list[float]] | None = None
    source: str = "autobahn_api"


class CompletedTrafficScope(BaseModel):
    source: str
    roads: list[str] = Field(min_length=1)


class SyncTrafficPayload(BaseModel):
    incidents: list[IngestIncidentPayload]
    # Missing records may only be reconciled for explicitly completed source/road snapshots.
    completed_scopes: list[CompletedTrafficScope] = Field(default_factory=list)


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
    road: Annotated[
        str | None, Query(description="Filter by road, e.g. A67, B47, B44")
    ] = None,
    include_cleared_hours: Annotated[int, Query(ge=0, le=48)] = 0,
    event_status: Literal["active", "planned", "all"] = "active",
    category: Literal["warning", "roadworks", "closure"] | None = None,
    planned_days: Annotated[int, Query(ge=1, le=90)] = 7,
):
    """List current active traffic jams, roadworks, and closures in the Ried."""
    query = """
        SELECT id, road_name, direction, location_from, location_to,
               start_time, end_time, last_seen_at, is_active,
               delay_seconds, length_meters, severity, cause_type,
               description, coordinates, source, delay_kind, source_category,
               provider_id,provider_start_at,provider_end_at,overall_end_date,
               provider_future,closure_kind,work_length_meters,display_type,title,
               event_status,is_stale
        FROM traffic_events
        WHERE ((event_status = %s OR (%s = 'all' AND event_status IN ('active','planned')))
          OR (%s > 0 AND event_status = 'resolved' AND end_time >= NOW() - (%s * INTERVAL '1 hour')))
          AND (event_status != 'planned' OR provider_start_at IS NULL
               OR provider_start_at <= NOW() + (%s * INTERVAL '1 day'))
    """
    params: list[Any] = [
        event_status,
        event_status,
        include_cleared_hours,
        include_cleared_hours,
        planned_days,
    ]

    if road:
        query += " AND UPPER(road_name) = UPPER(%s)"
        params.append(road)

    if category:
        query += " AND source_category = %s"
        params.append(category)
    query += (
        " ORDER BY provider_start_at NULLS LAST, delay_seconds DESC, start_time DESC"
    )

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
                delay_seconds=delay_sec
                if r.get("delay_kind") in ("reported", "estimated")
                else None,
                delay_minutes=round(delay_sec / 60)
                if r.get("delay_kind") in ("reported", "estimated")
                else None,
                length_meters=len_m,
                length_km=round(len_m / 1000.0, 1),
                severity=r["severity"],
                cause_type=r["cause_type"],
                description=r["description"],
                coordinates=coords,
                source=r["source"],
                delay_kind=r.get("delay_kind", "unknown"),
                source_category=r.get("source_category", "unknown"),
                provider_id=r.get("provider_id"),
                provider_start_at=r.get("provider_start_at"),
                provider_end_at=r.get("provider_end_at"),
                overall_end_date=str(r["overall_end_date"])
                if r.get("overall_end_date")
                else None,
                provider_future=r.get("provider_future", False),
                closure_kind=r.get("closure_kind", "unknown"),
                work_length_meters=r.get("work_length_meters"),
                display_type=r.get("display_type"),
                title=r.get("title"),
                event_status=r.get("event_status", "active"),
                is_stale=r.get("is_stale", False),
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
               severity, cause_type, description, delay_kind
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
                delay_seconds=(r["delay_seconds"] or 0)
                if r.get("delay_kind") in ("reported", "estimated")
                else None,
                delay_kind=r.get("delay_kind", "unknown"),
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
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute("SELECT * FROM traffic_events WHERE event_status='active'")
        incidents = await cur.fetchall()
        await cur.execute(
            "SELECT road_name,MAX(last_success_at) AS last_success_at FROM traffic_source_checks GROUP BY road_name"
        )
        checks = {r["road_name"]: r["last_success_at"] for r in await cur.fetchall()}
    return [
        CorridorStatus(
            **c,
            **summarize_corridor(
                [i for i in incidents if i["road_name"].upper() == c["road_name"]],
                checks.get(c["road_name"]),
            ),
        )
        for c in RIED_CORRIDORS
    ]


@router.post(
    "/sync", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_api_key)]
)
async def sync_traffic_incidents(payload: SyncTrafficPayload, pool: DbPool):
    """
    Ingest live traffic incidents from collector.
    Upserts incidents; only explicitly completed source/road snapshots resolve omissions.
    """
    now = datetime.now(UTC)
    incoming_ids = [inc.id for inc in payload.incidents]

    async with pool.connection() as conn, conn.cursor() as cur:
        # 1. Upsert incoming active incidents
        for inc in payload.incidents:
            coords_json = (
                json.dumps(inc.coordinates) if inc.coordinates is not None else None
            )
            await cur.execute(
                """
                INSERT INTO traffic_incidents (
                    id, road_name, direction, location_from, location_to,
                    start_time, end_time, last_seen_at, is_active,
                    delay_seconds, length_meters, severity, cause_type,
                    description, coordinates, source, updated_at, delay_kind
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, NULL, %s, TRUE,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
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
                    delay_kind = EXCLUDED.delay_kind
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
                ),
            )

        for scope in payload.completed_scopes:
            await cur.execute(
                """UPDATE traffic_incidents
                   SET is_active=FALSE,end_time=%s,updated_at=%s
                   WHERE is_active=TRUE AND source=%s AND UPPER(road_name)=ANY(%s)
                     AND id != ALL(%s::varchar[])
                     AND last_seen_at < %s - INTERVAL '6 minutes'""",
                (
                    now,
                    now,
                    scope.source,
                    [road.upper() for road in scope.roads],
                    incoming_ids,
                    now,
                ),
            )

    return {"status": "synced", "count": len(payload.incidents)}
