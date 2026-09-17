"""Waste truck fleet and ZAKB collection tracking endpoints."""

from datetime import date, datetime, time
from typing import Annotated

import psycopg_pool
from dependencies import get_db_pool, verify_admin_key, verify_ingestion_key
from fastapi import APIRouter, Depends, Query, Security, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/waste-trucks", tags=["ZAKB Waste Management"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class WasteFacilityResponse(BaseModel):
    id: str
    name: str
    facility_type: str
    municipality: str
    address: str
    latitude: float
    longitude: float
    accepted_fractions: list[str] = []


class WasteTruckFleetResponse(BaseModel):
    id: str
    license_plate: str
    vehicle_model: str
    assigned_fraction: str
    assigned_municipality: str
    capacity_m3: float
    is_active: bool


class WasteCalendarRecord(BaseModel):
    municipality: str
    district: str | None = None
    street_name: str
    fraction: str
    collection_date: date
    expected_time_start: time | None = None
    expected_time_end: time | None = None
    tour_code: str | None = None
    source: str = "zakb_abfuhrkalender"


class WasteTruckPositionRecord(BaseModel):
    timestamp: datetime
    truck_id: str
    tour_code: str
    fraction: str
    latitude: float
    longitude: float
    heading: float | None = None
    speed_kmh: float
    status: str = Field(..., description="'collecting' | 'bin_emptying' | 'transit' | 'depot'")
    current_street: str | None = None
    next_street: str | None = None
    load_percent: int | None = None
    empty_countdown_sec: int | None = None
    position_basis: str = Field(default="model_prediction", description="'model_prediction' | 'observed_gps' | 'crowdsourced'")


class RecordWasteTruckPositionsPayload(BaseModel):
    positions: list[WasteTruckPositionRecord]


# ------------------------------------------------------------------
# Facilities & Fleet Registry
# ------------------------------------------------------------------

@router.get("/facilities", response_model=list[WasteFacilityResponse])
async def list_waste_facilities(pool: DbPool):
    """List all registered ZAKB depots, Wertstoffhöfe, and recycling centers."""
    query = """
        SELECT id, name, facility_type, municipality, address, latitude, longitude, accepted_fractions
        FROM waste_facilities
        ORDER BY municipality, name;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.get("/fleet", response_model=list[WasteTruckFleetResponse])
async def list_waste_fleet(pool: DbPool, active_only: bool = True):
    """List all registered municipal refuse collection vehicles in Kreis Bergstraße."""
    query = """
        SELECT id, license_plate, vehicle_model, assigned_fraction, assigned_municipality, capacity_m3, is_active
        FROM waste_truck_fleet
        WHERE (NOT %s OR is_active = TRUE)
        ORDER BY assigned_municipality, assigned_fraction;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (active_only,))
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


# ------------------------------------------------------------------
# Calendar Schedules
# ------------------------------------------------------------------

@router.get("/calendar", response_model=list[WasteCalendarRecord])
async def get_collection_calendar(
    pool: DbPool,
    municipality: str | None = Query(None, description="e.g. 'Bürstadt', 'Lampertheim', 'Biblis'"),
    street_name: str | None = Query(None, description="e.g. 'Nibelungenstraße'"),
    from_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    fraction: str | None = Query(None, description="'restmuell', 'biomuell', 'papier', 'gelber_sack', 'umweltmobil'"),
    limit: int = Query(100, ge=1, le=500),
):
    """Query scheduled collection dates and time windows per street."""
    conditions = ["1=1"]
    params: list = []

    if municipality:
        conditions.append("municipality = %s")
        params.append(municipality)
    if street_name:
        conditions.append("street_name ILIKE %s")
        params.append(f"%{street_name}%")
    if from_date:
        conditions.append("collection_date >= %s")
        params.append(from_date)
    if to_date:
        conditions.append("collection_date <= %s")
        params.append(to_date)
    if fraction:
        conditions.append("fraction = %s")
        params.append(fraction)

    params.append(limit)

    query = f"""
        SELECT municipality, district, street_name, fraction, collection_date,
               expected_time_start, expected_time_end, tour_code, source
        FROM waste_collection_calendar
        WHERE {" AND ".join(conditions)}
        ORDER BY collection_date ASC, street_name ASC
        LIMIT %s;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, params)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.post("/calendar/import", status_code=status.HTTP_201_CREATED)
async def import_collection_calendar(
    payload: list[WasteCalendarRecord],
    pool: DbPool,
    _token: Annotated[str, Security(verify_admin_key)],
):
    """Admin endpoint to bulk upsert calendar collection dates from ZAKB official exports."""
    if not payload:
        return {"status": "ok", "imported": 0}

    query = """
        INSERT INTO waste_collection_calendar (
            municipality, district, street_name, fraction, collection_date,
            expected_time_start, expected_time_end, tour_code, source
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (municipality, street_name, fraction, collection_date)
        DO UPDATE SET
            expected_time_start = EXCLUDED.expected_time_start,
            expected_time_end = EXCLUDED.expected_time_end,
            tour_code = EXCLUDED.tour_code,
            source = EXCLUDED.source;
    """
    async with pool.connection() as conn:
        for item in payload:
            await conn.execute(
                query,
                (
                    item.municipality,
                    item.district,
                    item.street_name,
                    item.fraction,
                    item.collection_date,
                    item.expected_time_start,
                    item.expected_time_end,
                    item.tour_code,
                    item.source,
                ),
            )
    return {"status": "ok", "imported": len(payload)}


# ------------------------------------------------------------------
# Live & Historical Positions (TimescaleDB)
# ------------------------------------------------------------------

@router.get("/positions/latest", response_model=list[WasteTruckPositionRecord])
async def get_latest_positions(pool: DbPool):
    """Returns the most recent recorded position for each active collection vehicle."""
    query = """
        SELECT DISTINCT ON (truck_id)
            timestamp, truck_id, tour_code, fraction, latitude, longitude,
            heading, speed_kmh, status, current_street, next_street,
            load_percent, empty_countdown_sec, position_basis
        FROM waste_truck_positions
        ORDER BY truck_id, timestamp DESC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.get("/positions/history", response_model=list[WasteTruckPositionRecord])
async def get_position_history(
    pool: DbPool,
    truck_id: str = Query(..., description="Target vehicle ID"),
    from_time: datetime | None = Query(None, description="Start timestamp"),
    to_time: datetime | None = Query(None, description="End timestamp"),
    limit: int = Query(200, ge=1, le=1000),
):
    """Returns time-series position track for tour playback and route analysis."""
    conditions = ["truck_id = %s"]
    params: list = [truck_id]

    if from_time:
        conditions.append("timestamp >= %s")
        params.append(from_time)
    if to_time:
        conditions.append("timestamp <= %s")
        params.append(to_time)

    params.append(limit)

    query = f"""
        SELECT timestamp, truck_id, tour_code, fraction, latitude, longitude,
               heading, speed_kmh, status, current_street, next_street,
               load_percent, empty_countdown_sec, position_basis
        FROM waste_truck_positions
        WHERE {" AND ".join(conditions)}
        ORDER BY timestamp ASC
        LIMIT %s;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, params)
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.post("/positions/record", status_code=status.HTTP_201_CREATED)
async def record_waste_truck_positions(
    payload: RecordWasteTruckPositionsPayload,
    pool: DbPool,
    _token: Annotated[str, Security(verify_ingestion_key)],
):
    """Ingest position snapshot frames into the waste_truck_positions hypertable."""
    if not payload.positions:
        return {"status": "ok", "recorded": 0}

    query = """
        INSERT INTO waste_truck_positions (
            timestamp, truck_id, tour_code, fraction, latitude, longitude,
            heading, speed_kmh, status, current_street, next_street,
            load_percent, empty_countdown_sec, position_basis
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        );
    """
    async with pool.connection() as conn:
        for p in payload.positions:
            await conn.execute(
                query,
                (
                    p.timestamp,
                    p.truck_id,
                    p.tour_code,
                    p.fraction,
                    p.latitude,
                    p.longitude,
                    p.heading,
                    p.speed_kmh,
                    p.status,
                    p.current_street,
                    p.next_street,
                    p.load_percent,
                    p.empty_countdown_sec,
                    p.position_basis,
                ),
            )
    return {"status": "ok", "recorded": len(payload.positions)}
