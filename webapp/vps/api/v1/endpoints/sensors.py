from typing import Annotated

from fastapi import APIRouter, Depends, Security, status
import psycopg_pool

from api.dependencies import get_db_pool, verify_api_key
from api.v1.schemas import SensorMetadataCreate, SensorMetadataResponse

router = APIRouter()

# Type alias for database connection dependency
DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]

@router.post(
    "/sensors/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Security(verify_api_key)]
)
async def register_sensor(
    sensor: SensorMetadataCreate,
    pool: DbPool
):
    query = """
        INSERT INTO sensor_metadata (sensor_id, friendly_name, latitude, longitude)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (sensor_id) 
        DO UPDATE SET friendly_name = EXCLUDED.friendly_name,
                      latitude = EXCLUDED.latitude,
                      longitude = EXCLUDED.longitude;
    """
    async with pool.connection() as conn:
        await conn.execute(
            query, 
            (sensor.sensor_id, 
            sensor.friendly_name, 
            sensor.latitude, 
            sensor.longitude)
        )
    return {"status": "success", "sensor_id": sensor.sensor_id}


@router.get("/sensors", response_model=list[SensorMetadataResponse])
async def list_sensors(pool: DbPool):
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, created_at
        FROM sensor_metadata
        ORDER BY created_at DESC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()
    
    return [dict(row) for row in rows]