from typing import List
from fastapi import APIRouter, HTTPException, Depends, Security, status
from api.dependencies import get_db_pool, verify_api_key
from api.v1.schemas import SensorMetadataCreate, SensorMetadataResponse

router = APIRouter()

@router.post(
    "/sensors/register", 
    status_code=status.HTTP_201_CREATED, 
    dependencies=[Security(verify_api_key)]
)
async def register_sensor(
    sensor: SensorMetadataCreate,
    pool = Depends(get_db_pool)
):
    """Registers a new sensor or updates existing sensor metadata."""
    query = """
        INSERT INTO sensor_metadata (sensor_id, friendly_name, latitude, longitude)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sensor_id) 
        DO UPDATE SET friendly_name = EXCLUDED.friendly_name,
                      latitude = EXCLUDED.latitude,
                      longitude = EXCLUDED.longitude;
    """
    async with pool.acquire() as conn:
        await conn.execute(
            query, 
            sensor.sensor_id, 
            sensor.friendly_name, 
            sensor.latitude, 
            sensor.longitude
        )
    return {"status": "success", "sensor_id": sensor.sensor_id}


@router.get("/sensors", response_model=List[SensorMetadataResponse])
async def list_sensors(pool = Depends(get_db_pool)):
    """Lists all registered sensors and their metadata."""
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, created_at
        FROM sensor_metadata
        ORDER BY created_at DESC;
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query)
    
    return [dict(row) for row in rows]


@router.get("/sensors/{sensor_id}", response_model=SensorMetadataResponse)
async def get_sensor(sensor_id: str, pool = Depends(get_db_pool)):
    """Retrieves metadata for a specific sensor."""
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, created_at
        FROM sensor_metadata
        WHERE sensor_id = $1;
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, sensor_id)
        
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Sensor '{sensor_id}' not found."
        )
    return dict(row)