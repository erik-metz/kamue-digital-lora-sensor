"""VRN GTFS-RT Bus tracking and bus stops endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Security, status
import psycopg_pool
from pydantic import BaseModel, Field

from dependencies import get_db_pool, verify_ingestion_key

router = APIRouter(prefix="/buses", tags=["VRN Bus Mobility"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class BusStopResponse(BaseModel):
    id: str
    name: str
    municipality: str
    latitude: float
    longitude: float
    lines: list[str] = []
    is_school_stop: bool = False
    nearby_school_name: str | None = None
    is_train_hub: bool = False
    platforms: list[str] = ["Steig 1"]


class BusLineResponse(BaseModel):
    id: str
    line_number: str
    operator: str
    route_name: str
    color: str = "#0284c7"
    is_school_line: bool = False


class BusPositionRecord(BaseModel):
    timestamp: datetime
    vehicle_id: str
    trip_id: str | None = None
    line: str
    origin: str | None = None
    destination: str
    latitude: float
    longitude: float
    heading: float | None = None
    speed_kmh: float
    status: str = Field(..., description="'moving' | 'stopped'")
    stop_id: str | None = None
    is_school_bus: bool = False
    delay_sec: int = 0
    position_basis: str = Field(default="model_prediction", description="'model_prediction' | 'vrn_gtfs_rt'")


class RecordBusPositionsPayload(BaseModel):
    positions: list[BusPositionRecord]


class BusDepartureItem(BaseModel):
    line: str
    origin: str
    destination: str
    scheduled_time: str
    estimated_time: str
    delay_minutes: int
    is_school_bus: bool
    school_bus_reason: str | None = None
    wheelchair_accessible: bool = True
    platform: str = "Steig 1"


# ------------------------------------------------------------------
# Bus Stops & Lines
# ------------------------------------------------------------------

@router.get("/stops", response_model=list[BusStopResponse])
async def list_bus_stops(
    pool: DbPool,
    municipality: str | None = Query(None, description="e.g. 'Bürstadt', 'Lampertheim', 'Biblis'"),
    school_stops_only: bool = False,
):
    """List all registered VRN bus stops in the Ried corridor."""
    conditions = ["1=1"]
    params: list = []

    if municipality:
        conditions.append("municipality = %s")
        params.append(municipality)
    if school_stops_only:
        conditions.append("is_school_stop = TRUE")

    query = f"""
        SELECT id, name, municipality, latitude, longitude, lines, is_school_stop, nearby_school_name, is_train_hub, platforms
        FROM bus_stops
        WHERE {' AND '.join(conditions)}
        ORDER BY municipality, name;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, tuple(params))
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.get("/lines", response_model=list[BusLineResponse])
async def list_bus_lines(pool: DbPool):
    """List all registered VRN bus lines serving the Ried."""
    query = """
        SELECT id, line_number, operator, route_name, color, is_school_line
        FROM bus_lines
        ORDER BY line_number;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


# ------------------------------------------------------------------
# Live & Historical Positions (TimescaleDB)
# ------------------------------------------------------------------

@router.get("/positions/latest", response_model=list[BusPositionRecord])
async def get_latest_bus_positions(pool: DbPool):
    """Returns the most recent recorded position for each active bus."""
    query = """
        SELECT DISTINCT ON (vehicle_id)
            timestamp, vehicle_id, trip_id, line, origin, destination,
            latitude, longitude, heading, speed_kmh, status, stop_id,
            is_school_bus, delay_sec, position_basis
        FROM bus_positions
        ORDER BY vehicle_id, timestamp DESC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.get("/positions/history", response_model=list[BusPositionRecord])
async def get_bus_position_history(
    pool: DbPool,
    line: str | None = Query(None, description="Filter by line, e.g. '641', '642', '652'"),
    vehicle_id: str | None = Query(None, description="Filter by vehicle ID"),
    from_time: datetime | None = Query(None, description="Start timestamp"),
    to_time: datetime | None = Query(None, description="End timestamp"),
    limit: int = Query(200, ge=1, le=1000),
):
    """Returns time-series position track for replay and punctuality analysis."""
    conditions = ["1=1"]
    params: list = []

    if line:
        conditions.append("line = %s")
        params.append(line)
    if vehicle_id:
        conditions.append("vehicle_id = %s")
        params.append(vehicle_id)
    if from_time:
        conditions.append("timestamp >= %s")
        params.append(from_time)
    if to_time:
        conditions.append("timestamp <= %s")
        params.append(to_time)

    params.append(limit)

    query = f"""
        SELECT timestamp, vehicle_id, trip_id, line, origin, destination,
               latitude, longitude, heading, speed_kmh, status, stop_id,
               is_school_bus, delay_sec, position_basis
        FROM bus_positions
        WHERE {' AND '.join(conditions)}
        ORDER BY timestamp DESC
        LIMIT %s;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, tuple(params))
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.post("/positions/record", status_code=status.HTTP_201_CREATED)
async def record_bus_positions(
    payload: RecordBusPositionsPayload,
    pool: DbPool,
    _token: str = Security(verify_ingestion_key),
):
    """Ingests real-time VRN GTFS-RT snapshots into TimescaleDB."""
    query = """
        INSERT INTO bus_positions (
            timestamp, vehicle_id, trip_id, line, origin, destination,
            latitude, longitude, heading, speed_kmh, status, stop_id,
            is_school_bus, delay_sec, position_basis
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s
        );
    """
    async with pool.connection() as conn:
        for pos in payload.positions:
            await conn.execute(
                query,
                (
                    pos.timestamp,
                    pos.vehicle_id,
                    pos.trip_id,
                    pos.line,
                    pos.origin,
                    pos.destination,
                    pos.latitude,
                    pos.longitude,
                    pos.heading,
                    pos.speed_kmh,
                    pos.status,
                    pos.stop_id,
                    pos.is_school_bus,
                    pos.delay_sec,
                    pos.position_basis,
                ),
            )
    return {"status": "ok", "recorded": len(payload.positions)}
