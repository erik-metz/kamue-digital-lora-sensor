from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Security, status
from api.dependencies import get_db_pool, verify_api_key
from api.v1.schemas import (
    SensorReading, 
    BatchSensorReadings, 
    SensorAggregateResponse
)

router = APIRouter()

# --- INGESTION ENDPOINTS ---

@router.post("/telemetry", status_code=status.HTTP_201_CREATED, dependencies=[Security(verify_api_key)])
async def push_sensor_data(reading: SensorReading, pool = Depends(get_db_pool)):
    """Inserts a single sensor reading."""
    ts = reading.timestamp or datetime.now(timezone.utc)
    query = """
        INSERT INTO sensor_data (timestamp, sensor_id, value, unit)
        VALUES ($1, $2, $3, $4);
    """
    async with pool.connection() as conn:
        await conn.execute(query, ts, reading.sensor_id, reading.value, reading.unit)
    return {"status": "inserted", "timestamp": ts}


@router.post("/telemetry/batch", status_code=status.HTTP_201_CREATED, dependencies=[Security(verify_api_key)])
async def push_batch_sensor_data(payload: BatchSensorReadings, pool = Depends(get_db_pool)):
    """Bulk inserts multiple sensor readings in a single transaction."""
    if not payload.readings:
        raise HTTPException(status_code=400, detail="Readings array cannot be empty.")

    now_utc = datetime.now(timezone.utc)
    records = [
        (item.timestamp or now_utc, item.sensor_id, item.value, item.unit)
        for item in payload.readings
    ]

    # Fixed SIM117: Combined nested context managers into a single line
    async with pool.connection() as conn, conn.transaction():
        await conn.executemany(
            "INSERT INTO sensor_data (timestamp, sensor_id, value, unit) VALUES ($1, $2, $3, $4);",
            records
        )

    return {"status": "success", "inserted_count": len(records)}


# --- RETRIEVAL ENDPOINTS ---

@router.get("/telemetry/raw", response_model=List[SensorReading])
async def get_raw_telemetry(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="End timestamp"),
    limit: int = Query(default=100, le=5000, description="Max points to return"),
    pool = Depends(get_db_pool)
):
    """Retrieves raw historical data points for a specific sensor over a time range."""
    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT timestamp, sensor_id, value, unit
        FROM sensor_data
        WHERE sensor_id = $1 AND timestamp >= $2 AND timestamp <= $3
        ORDER BY timestamp DESC
        LIMIT $4;
    """
    async with pool.connection() as conn:
        rows = await conn.fetch(query, sensor_id, start_time, end, limit)

    return [
        {
            "sensor_id": row["sensor_id"],
            "timestamp": row["timestamp"],
            "value": row["value"],
            "unit": row["unit"]
        }
        for row in rows
    ]


@router.get("/telemetry/aggregates", response_model=List[SensorAggregateResponse])
async def get_telemetry_aggregates(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    interval: str = Query(default="1 hour", description="Timescale time bucket interval"),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="End timestamp"),
    pool = Depends(get_db_pool)
):
    """
    Leverages TimescaleDB's native `time_bucket` to calculate min, max, average values 
    and sample counts grouped into regular time intervals.
    """
    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT 
            time_bucket($1::interval, timestamp) AS bucket,
            AVG(value) AS avg_value,
            MIN(value) AS min_value,
            MAX(value) AS max_value,
            COUNT(*) AS sample_count,
            unit
        FROM sensor_data
        WHERE sensor_id = $2 AND timestamp >= $3 AND timestamp <= $4
        GROUP BY bucket, unit
        ORDER BY bucket ASC;
    """
    async with pool.connection() as conn:
        rows = await conn.fetch(query, interval, sensor_id, start_time, end)

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


@router.get("/telemetry/latest")
async def get_latest_sensor_reading(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    pool = Depends(get_db_pool)
):
    """Retrieves the single most recent data point for a given sensor."""
    query = """
        SELECT timestamp, sensor_id, value, unit
        FROM sensor_data
        WHERE sensor_id = $1
        ORDER BY timestamp DESC
        LIMIT 1;
    """
    async with pool.connection() as conn:
        row = await conn.fetchrow(query, sensor_id)

    if not row:
        raise HTTPException(status_code=404, detail=f"No telemetry found for sensor '{sensor_id}'.")

    return dict(row)