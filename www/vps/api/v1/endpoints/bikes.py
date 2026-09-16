"""VRNnextbike sharing endpoints: live bike inventory, station availability, and commuter trips."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/bikes", tags=["VRN Nextbike Sharing"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class BikeResponse(BaseModel):
    bike_number: str
    current_station_id: str | None
    current_station_name: str | None
    bike_type: int
    electric_lock: bool
    pedelec_battery: int | None = Field(default=None, description="Battery percentage for pedelecs/e-bikes")
    state: str
    latitude: float | None
    longitude: float | None
    last_seen_at: datetime
    is_active: bool


class BikeTripResponse(BaseModel):
    evidence: str = "inferred_station_change"
    id: int
    bike_number: str
    start_station_id: str | None
    start_station_name: str | None
    end_station_id: str | None
    end_station_name: str | None
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    distance_meters: float | None


class BikeStatsResponse(BaseModel):
    total_active_bikes: int
    total_stations: int
    trips_last_24h: int
    estimated_distance_km_24h: float
    estimated_co2_saved_kg_24h: float
    busiest_station: str | None


@router.get("", response_model=list[BikeResponse])
async def list_bikes(
    pool: DbPool,
    station_id: str | None = Query(default=None, description="Filter bikes by current station ID"),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Return all currently tracked bikes, their current station, and battery levels."""
    query = """
        SELECT bike_number, current_station_id, current_station_name, bike_type,
               electric_lock, pedelec_battery, state, latitude, longitude,
               last_seen_at, is_active
        FROM nextbike_bikes
        WHERE is_active = TRUE AND COALESCE(fresh_until, last_seen_at + INTERVAL '15 minutes') >= NOW()
    """
    params: list = []
    if station_id:
        query += " AND current_station_id = %s"
        params.append(station_id)
    query += " ORDER BY last_seen_at DESC LIMIT %s"
    params.append(limit)

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
        return [
            BikeResponse(
                bike_number=row["bike_number"],
                current_station_id=row["current_station_id"],
                current_station_name=row["current_station_name"],
                bike_type=row["bike_type"],
                electric_lock=row["electric_lock"],
                pedelec_battery=row["pedelec_battery"],
                state=row["state"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                last_seen_at=row["last_seen_at"],
                is_active=row["is_active"],
            )
            for row in rows
        ]


@router.get("/trips", response_model=list[BikeTripResponse])
async def list_trips(
    pool: DbPool,
    bike_number: str | None = Query(default=None, description="Filter trips for a specific bike"),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Return detected bike trips between stations."""
    query = """
        SELECT id, bike_number, start_station_id, start_station_name,
               end_station_id, end_station_name, start_time, end_time,
               duration_seconds, distance_meters, evidence
        FROM nextbike_trips
    """
    params: list = []
    if bike_number:
        query += " WHERE bike_number = %s"
        params.append(bike_number)
    query += " ORDER BY end_time DESC LIMIT %s"
    params.append(limit)

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
        return [
            BikeTripResponse(
                id=row["id"],
                bike_number=row["bike_number"],
                start_station_id=row["start_station_id"],
                start_station_name=row["start_station_name"],
                end_station_id=row["end_station_id"],
                end_station_name=row["end_station_name"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                duration_seconds=row["duration_seconds"],
                distance_meters=row["distance_meters"],
                evidence=row.get("evidence", "inferred_station_change"),
            )
            for row in rows
        ]


@router.get("/stats", response_model=BikeStatsResponse)
async def get_bike_stats(pool: DbPool):
    """Aggregate statistics for bike sharing network, commuter trips, and CO2 reduction."""
    since = datetime.now(UTC) - timedelta(hours=24)
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute("SELECT COUNT(*) AS total FROM nextbike_bikes WHERE is_active = TRUE AND COALESCE(fresh_until, last_seen_at + INTERVAL '15 minutes') >= NOW()")
        row_bikes = await cur.fetchone()
        total_bikes = row_bikes["total"] if row_bikes else 0

        await cur.execute("SELECT COUNT(*) AS total FROM nextbike_sources")
        row_stations = await cur.fetchone()
        total_stations = row_stations["total"] if row_stations else 0

        await cur.execute(
            """SELECT COUNT(*) AS trip_count, COALESCE(SUM(distance_meters), 0) AS total_meters
               FROM nextbike_trips
               WHERE end_time >= %s""",
            (since,),
        )
        row_trips = await cur.fetchone()
        trip_count = row_trips["trip_count"] if row_trips else 0
        total_meters = float(row_trips["total_meters"]) if row_trips else 0.0

        # Most popular arrival station in last 24h
        await cur.execute(
            """SELECT end_station_name, COUNT(*) AS count
               FROM nextbike_trips
               WHERE end_time >= %s AND end_station_name IS NOT NULL
               GROUP BY end_station_name
               ORDER BY count DESC LIMIT 1""",
            (since,),
        )
        row_busy = await cur.fetchone()
        busiest = row_busy["end_station_name"] if row_busy else None

    km = round(total_meters / 1000.0, 1)
    # Average car emits approx 140g CO2 per passenger-km (Federal Environment Agency / UBA)
    co2_kg = round(km * 0.14, 2)

    return BikeStatsResponse(
        total_active_bikes=total_bikes,
        total_stations=total_stations,
        trips_last_24h=trip_count,
        estimated_distance_km_24h=km,
        estimated_co2_saved_kg_24h=co2_kg,
        busiest_station=busiest,
    )
