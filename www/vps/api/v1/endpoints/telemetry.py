from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
import psycopg_pool
from dependencies import get_db_pool, verify_ingestion_key
from schemas import (
    BatchSensorReadings,
    SensorAggregateResponse,
    SensorReading,
)

router = APIRouter()

ALLOWED_INTERVALS = {
    "1 minute",
    "5 minutes",
    "10 minutes",
    "15 minutes",
    "30 minutes",
    "1 hour",
    "2 hours",
    "3 hours",
    "6 hours",
    "12 hours",
    "1 day",
    "7 days",
    "1 week",
    "30 days",
    "1 month",
}


# --- INGESTION ENDPOINTS (LoRaWAN / TTN Webhook) ---

@router.post(
    "/telemetry",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Security(verify_ingestion_key)],
    summary="Push single sensor telemetry reading (TTN / Ingestion Key required)",
    tags=["Telemetry Ingestion"],
)
async def push_sensor_data(
    reading: SensorReading, 
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    """Inserts a single sensor reading from an authenticated source."""
    ts = reading.timestamp or datetime.now(timezone.utc)
    query = """
        INSERT INTO sensor_data (timestamp, sensor_id, value, unit, metric)
        VALUES (%s, %s, %s, %s, %s);
    """
    async with pool.connection() as conn:
        # Automatically register sensor if it does not already exist
        await conn.execute(
            """
            INSERT INTO sensor_metadata (id, friendly_name, is_hidden)
            VALUES (%s, %s, FALSE)
            ON CONFLICT (id) DO NOTHING;
            """,
            (reading.sensor_id, reading.sensor_id),
        )
        await conn.execute(query, (ts, reading.sensor_id, reading.value, reading.unit, reading.metric))
    return {"status": "inserted", "timestamp": ts}


@router.post(
    "/telemetry/batch",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Security(verify_ingestion_key)],
    summary="Push batch telemetry readings (TTN / Ingestion Key required)",
    tags=["Telemetry Ingestion"],
)
async def push_batch_sensor_data(
    payload: BatchSensorReadings, 
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    """Bulk inserts multiple sensor readings in a single transaction."""
    if not payload.readings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Readings array cannot be empty.",
        )

    now_utc = datetime.now(timezone.utc)
    records = [
        (item.timestamp or now_utc, item.sensor_id, item.value, item.unit, item.metric)
        for item in payload.readings
    ]

    unique_sensors = [(s_id, s_id) for s_id in {item.sensor_id for item in payload.readings}]

    query = """
        INSERT INTO sensor_data (timestamp, sensor_id, value, unit, metric)
        VALUES (%s, %s, %s, %s, %s);
    """
    async with pool.connection() as conn, conn.transaction():
        async with conn.cursor() as cur:
            # Auto-register distinct sensors in the batch
            await cur.executemany(
                """
                INSERT INTO sensor_metadata (id, friendly_name, is_hidden)
                VALUES (%s, %s, FALSE)
                ON CONFLICT (id) DO NOTHING;
                """,
                unique_sensors,
            )
            await cur.executemany(query, records)

    return {"status": "success", "inserted_count": len(records)}


# --- RETRIEVAL ENDPOINTS (Public Open Data) ---

@router.get(
    "/telemetry/raw",
    response_model=list[SensorReading],
    summary="Get raw historical telemetry readings (Public)",
    tags=["Telemetry Public"],
)
async def get_raw_telemetry(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: datetime | None = Query(None, description="End timestamp"),
    limit: int = Query(default=100, ge=1, le=5000, description="Max points to return (1-5000)"),
    metric: str | None = Query(None, min_length=1, max_length=64),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    """Retrieves raw historical data points for a specific visible sensor over a time range."""
    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT sd.timestamp, sd.sensor_id, sd.value, sd.unit, sd.metric
        FROM sensor_data sd
        JOIN sensor_metadata sm ON sd.sensor_id = sm.id
        WHERE sd.sensor_id = %s AND sm.is_hidden = FALSE
          AND (%s::text IS NULL OR sd.metric = %s) AND sd.timestamp >= %s AND sd.timestamp <= %s
        ORDER BY sd.timestamp DESC
        LIMIT %s;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id, metric, metric, start_time, end, limit))
        rows = await cur.fetchall()

    return [
        {
            "sensor_id": row["sensor_id"],
            "timestamp": row["timestamp"],
            "value": row["value"],
            "unit": row["unit"],
            "metric": row["metric"],
        }
        for row in rows
    ]


@router.get(
    "/telemetry/aggregates",
    response_model=list[SensorAggregateResponse],
    summary="Get aggregated telemetry time buckets (Public)",
    tags=["Telemetry Public"],
)
async def get_telemetry_aggregates(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    interval: str = Query(
        default="1 hour",
        description="Bucket interval (e.g. 15 minutes, 1 hour, 1 day)",
    ),
    start_time: datetime = Query(..., description="Start timestamp (ISO 8601)"),
    end_time: datetime | None = Query(None, description="End timestamp"),
    metric: str | None = Query(None, min_length=1, max_length=64),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    """
    Leverages TimescaleDB's native `time_bucket` to calculate min, max, average values 
    and sample counts grouped into regular time intervals for visible sensors.
    """
    cleaned_interval = interval.strip().lower()
    if cleaned_interval not in ALLOWED_INTERVALS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid interval '{interval}'. Allowed intervals: "
                f"{', '.join(sorted(ALLOWED_INTERVALS))}"
            ),
        )

    end = end_time or datetime.now(timezone.utc)

    query = """
        SELECT 
            time_bucket(%s::interval, sd.timestamp) AS bucket,
            AVG(sd.value) AS avg_value,
            MIN(sd.value) AS min_value,
            MAX(sd.value) AS max_value,
            COUNT(*) AS sample_count,
            sd.unit,
            sd.metric
        FROM sensor_data sd
        JOIN sensor_metadata sm ON sd.sensor_id = sm.id
        WHERE sd.sensor_id = %s AND sm.is_hidden = FALSE
          AND (%s::text IS NULL OR sd.metric = %s) AND sd.timestamp >= %s AND sd.timestamp <= %s
        GROUP BY bucket, sd.unit, sd.metric
        ORDER BY bucket ASC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (cleaned_interval, sensor_id, metric, metric, start_time, end))
        rows = await cur.fetchall()

    return [
        {
            "bucket": row["bucket"],
            "avg_value": round(row["avg_value"], 2) if row["avg_value"] is not None else None,
            "min_value": row["min_value"],
            "max_value": row["max_value"],
            "sample_count": row["sample_count"],
            "unit": row["unit"],
            "metric": row["metric"],
        }
        for row in rows
    ]


@router.get(
    "/telemetry/latest",
    response_model=SensorReading,
    summary="Get latest reading for sensor (Public)",
    tags=["Telemetry Public"],
)
async def get_latest_sensor_reading(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    metric: str | None = Query(None, min_length=1, max_length=64),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    """Retrieves the single most recent data point for a given visible sensor."""
    query = """
        SELECT sd.timestamp, sd.sensor_id, sd.value, sd.unit, sd.metric
        FROM sensor_data sd
        JOIN sensor_metadata sm ON sd.sensor_id = sm.id
        WHERE sd.sensor_id = %s AND sm.is_hidden = FALSE
          AND (%s::text IS NULL OR sd.metric = %s)
        ORDER BY sd.timestamp DESC
        LIMIT 1;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id, metric, metric))
        row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No telemetry found for sensor '{sensor_id}' (or sensor is hidden).",
        )

    return dict(row)


@router.get(
    "/telemetry/latest/metrics",
    response_model=list[SensorReading],
    summary="Get the latest reading of each metric for a sensor (Public)",
    tags=["Telemetry Public"],
)
async def get_latest_sensor_metrics(
    sensor_id: str = Query(..., description="The ID of the sensor"),
    pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool),
):
    query = """
        SELECT DISTINCT ON (sd.metric, sd.unit)
            sd.timestamp, sd.sensor_id, sd.value, sd.unit, sd.metric
        FROM sensor_data sd
        JOIN sensor_metadata sm ON sd.sensor_id = sm.id
        WHERE sd.sensor_id = %s AND sm.is_hidden = FALSE
        ORDER BY sd.metric, sd.unit, sd.timestamp DESC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id,))
        rows = await cur.fetchall()
    return [dict(row) for row in rows]
