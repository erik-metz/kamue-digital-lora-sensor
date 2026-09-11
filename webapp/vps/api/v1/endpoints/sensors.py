from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Security, status

from api.dependencies import get_db_pool, verify_api_key
from api.v1.schemas import SensorMetadataCreate, SensorMetadataResponse

router = APIRouter()

# Type alias for database connection dependency
DbPool = Annotated[object, Depends(get_db_pool)]

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
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sensor_id) 
        DO UPDATE SET friendly_name = EXCLUDED.friendly_name,
                      latitude = EXCLUDED.latitude,
                      longitude = EXCLUDED.longitude;
    """
    async with pool.connection() as conn: # type: ignore
        await conn.execute(
            query, 
            sensor.sensor_id, 
            sensor.friendly_name, 
            sensor.latitude, 
            sensor.longitude
        )
    return {"status": "success", "sensor_id": sensor.sensor_id}


@router.get("/sensors", response_model=list[SensorMetadataResponse])
async def list_sensors(pool: DbPool):
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, created_at
        FROM sensor_metadata
        ORDER BY created_at DESC;
    """
    async with pool.connection() as conn: # type: ignore
        rows = await conn.fetch(query)
    
    return [dict(row) for row in rows]