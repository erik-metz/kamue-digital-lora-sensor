import os
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import asyncpg

app = FastAPI(title="Sensor Telemetry API")

DB_HOST = os.getenv("DB_HOST", "timescaledb")
DB_NAME = os.getenv("DB_NAME", "mydatabase")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "mysecretpassword")

pool = None

@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(
        host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS
    )
    
    # Run database initialization automatically
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sensor_metadata (
                sensor_id VARCHAR(64) PRIMARY KEY,
                friendly_name VARCHAR(255) NOT NULL,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sensor_data (
                timestamp TIMESTAMPTZ NOT NULL,
                sensor_id VARCHAR(64) NOT NULL REFERENCES sensor_metadata(sensor_id),
                value DOUBLE PRECISION NOT NULL,
                unit VARCHAR(32) NOT NULL
            );

            SELECT create_hypertable('sensor_data', 'timestamp', if_not_exists => TRUE);

            CREATE INDEX IF NOT EXISTS idx_sensor_data_composite 
            ON sensor_data (sensor_id, timestamp DESC);
        """)

@app.on_event("shutdown")
async def shutdown():
    await pool.close()

# Pydantic Schemas
class SensorReading(BaseModel):
    sensor_id: str
    value: float
    unit: str
    timestamp: Optional[datetime] = None

class BatchSensorReadings(BaseModel):
    readings: List[SensorReading]


# --- BATCH INGESTION ENDPOINT ---

@app.post("/telemetry/batch", status_code=201)
async def push_batch_sensor_data(payload: BatchSensorReadings):
    """Bulk inserts multiple sensor readings in a single efficient transaction."""
    if not payload.readings:
        raise HTTPException(status_code=400, detail="Readings array cannot be empty.")

    # Prepare tuples for asyncpg copy_records_to_table or executemany
    records = [
        (
            item.timestamp or datetime.utcnow(),
            item.sensor_id,
            item.value,
            item.unit
        )
        for item in payload.readings
    ]

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Executemany executes an optimized batch insert statement
            await conn.executemany(
                """
                INSERT INTO sensor_data (timestamp, sensor_id, value, unit)
                VALUES ($1, $2, $3, $4);
                """,
                records
            )

    return {"status": "success", "inserted_count": len(records)}


# --- DATA QUERY ENDPOINTS ---

@app.get("/telemetry/history")
async def get_sensor_history(
    sensor_id: str,
    start_time: datetime,
    end_time: Optional[datetime] = None,
    limit: int = Query(default=100, le=1000)
):
    """Retrieves raw historical data points for a specific sensor over a time range."""
    end = end_time or datetime.utcnow()

    query = """
        SELECT timestamp, value, unit
        FROM sensor_data
        WHERE sensor_id = $1 AND timestamp >= $2 AND timestamp <= $3
        ORDER BY timestamp DESC
        LIMIT $4;
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, sensor_id, start_time, end, limit)
    
    return [
        {
            "timestamp": row["timestamp"],
            "value": row["value"],
            "unit": row["unit"]
        }
        for row in rows
    ]


@app.get("/telemetry/aggregates")
async def get_sensor_aggregates(
    sensor_id: str,
    interval: str = Query(default="1 hour", description="Timescale time bucket, e.g. '5 minutes', '1 hour', '1 day'"),
    start_time: datetime = Query(...),
    end_time: Optional[datetime] = None
):
    """
    Uses TimescaleDB's `time_bucket` to aggregate metrics over fixed time windows (e.g. hourly avg/min/max).
    """
    end = end_time or datetime.utcnow()

    # Query uses time_bucket to group timestamps into regular intervals
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
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, interval, sensor_id, start_time, end)

    return [
        {
            "bucket": row["bucket"],
            "avg_value": round(row["avg_value"], 2) if row["avg_value"] else None,
            "min_value": row["min_value"],
            "max_value": row["max_value"],
            "sample_count": row["sample_count"],
            "unit": row["unit"]
        }
        for row in rows
    ]