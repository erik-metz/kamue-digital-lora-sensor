from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, Security, status
import psycopg_pool
from api.dependencies import get_db_pool, verify_api_key
from api.v1.schemas import (
    SensorReading, 
    BatchSensorReadings, 
    SensorAggregateResponse
)

router = APIRouter()

# --- INGESTION ENDPOINTS ---

@router.post("/telemetry", status_code=status.HTTP_201_CREATED, dependencies=[Security(verify_api_key)])
async def push_sensor_data(
    reading: SensorReading, 
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)
):
    """Inserts a single sensor reading."""
    ts = reading.timestamp or datetime.now(timezone.utc)
    query = """
        INSERT INTO sensor_data (timestamp, sensor_id, value, unit)
        VALUES (%s, %s, %s, %s);
    """
    async with pool.connection() as conn:
        # Automatically register sensor if it does not already exist
        await conn.execute(
            """
            INSERT INTO sensor_metadata (sensor_id, friendly_name)
            VALUES (%s, %s)
            ON CONFLICT (sensor_id) DO NOTHING;
            """,
            (reading.sensor_id, reading.sensor_id),
        )
        await conn.execute(query, (ts, reading.sensor_id, reading.value, reading.unit))
    return {"status": "inserted", "timestamp": ts}


@router.post("/telemetry/batch", status_code=status.HTTP_201_CREATED, dependencies=[Security(verify_api_key)])
async def push_batch_sensor_data(
    payload: BatchSensorReadings, 
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)
):
    """Bulk inserts multiple sensor readings in a single transaction."""
    if not payload.readings:
        raise HTTPException(status_code=400, detail="Readings array cannot be empty.")

    now_utc = datetime.now(timezone.utc)
    records = [
        (item.timestamp or now_utc, item.sensor_id, item.value, item.unit)
        for item in payload.readings
    ]

    unique_sensors = [(s_id, s_id) for s_id in {item.sensor_id for item in payload.readings}]

    query = """
        INSERT INTO sensor_data (timestamp, sensor_id, value, unit)
        VALUES (%s, %s, %s, %s);
    """
    async with pool.connection() as conn, conn.transaction():
        async with conn.cursor() as cur:
            # Auto-register distinct sensors in the batch
            await cur.executemany(
                """
                INSERT INTO sensor_metadata (sensor_id, friendly_name)
                VALUES (%s, %s)
                ON CONFLICT (sensor_id) DO NOTHING;
                """,
                unique_sensors,
            )
            await cur.executemany(query, records)

    return {"status": "success", "inserted_count": len(records)}


# --- RETRIEVAL ENDPOINTS ---

@router.get("/telemetry/raw", response_model=list[SensorReading])
async def get_raw_telemetry(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: datetime | None = Query(None, description="End timestamp"),
    limit: int = Query(default=100, le=5000, description="Max points to return"),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)
):
    """Retrieves raw historical data points for a specific sensor over a time range."""
    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT timestamp, sensor_id, value, unit
        FROM sensor_data
        WHERE sensor_id = %s AND timestamp >= %s AND timestamp <= %s
        ORDER BY timestamp DESC
        LIMIT %s;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id, start_time, end, limit))
        rows = await cur.fetchall()

    return [
        {
            "sensor_id": row["sensor_id"],
            "timestamp": row["timestamp"],
            "value": row["value"],
            "unit": row["unit"]
        }
        for row in rows
    ]


@router.get("/telemetry/aggregates", response_model=list[SensorAggregateResponse])
async def get_telemetry_aggregates(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    interval: str = Query(default="1 hour", description="Timescale time bucket interval"),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: datetime | None = Query(None, description="End timestamp"),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)
):
    """
    Leverages TimescaleDB's native `time_bucket` to calculate min, max, average values 
    and sample counts grouped into regular time intervals.
    """
    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT 
            time_bucket(%s::interval, timestamp) AS bucket,
            AVG(value) AS avg_value,
            MIN(value) AS min_value,
            MAX(value) AS max_value,
            COUNT(*) AS sample_count,
            unit
        FROM sensor_data
        WHERE sensor_id = %s AND timestamp >= %s AND timestamp <= %s
        GROUP BY bucket, unit
        ORDER BY bucket ASC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (interval, sensor_id, start_time, end))
        rows = await cur.fetchall()

    return [
        {
            "bucket": row["bucket"],
            "avg_value": round(row["avg_value"], 2) if row["avg_value"] is not None else None,
            "min_value": row["min_value"],
            "max_value": row["max_value"],
            "sample_count": row["sample_count"],
            "unit": row["unit"]
        }
        for row in rows
    ]


@router.get("/telemetry/latest", response_model=SensorReading)
async def get_latest_sensor_reading(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)
):
    """Retrieves the single most recent data point for a given sensor."""
    query = """
        SELECT timestamp, sensor_id, value, unit
        FROM sensor_data
        WHERE sensor_id = %s
        ORDER BY timestamp DESC
        LIMIT 1;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id,))
        row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"No telemetry found for sensor '{sensor_id}'.")

    return dict(row)