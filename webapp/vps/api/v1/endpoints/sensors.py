from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
import psycopg_pool

from api.dependencies import get_db_pool, verify_admin_key
from api.v1.schemas import (
    SensorMetadataCreate,
    SensorMetadataResponse,
    SensorMetadataUpdate,
    SensorVisibilityUpdate,
)

router = APIRouter()

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


# ==========================================
# PUBLIC OPEN-DATA SENSOR ENDPOINTS
# ==========================================

@router.get(
    "/sensors",
    response_model=list[SensorMetadataResponse],
    summary="List all publicly visible sensors",
    tags=["Sensors Public"],
)
async def list_public_sensors(pool: DbPool):
    """Returns all active, non-hidden sensor stations for public consumption."""
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at
        FROM sensor_metadata
        WHERE is_hidden = FALSE
        ORDER BY created_at ASC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()

    return [dict(row) for row in rows]


@router.get(
    "/sensors/{sensor_id}",
    response_model=SensorMetadataResponse,
    summary="Get sensor metadata",
    tags=["Sensors Public"],
)
async def get_public_sensor(sensor_id: str, pool: DbPool):
    """Returns metadata for a specific public sensor."""
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at
        FROM sensor_metadata
        WHERE sensor_id = %s AND is_hidden = FALSE;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (sensor_id,))
        row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor '{sensor_id}' not found or is currently private.",
        )

    return dict(row)


# ==========================================
# ADMIN SENSOR MANAGEMENT ENDPOINTS
# (Restricted to Open Ried Sens Next.js Admin)
# ==========================================

@router.get(
    "/admin/sensors",
    response_model=list[SensorMetadataResponse],
    dependencies=[Security(verify_admin_key)],
    summary="List all sensors including hidden (Admin only)",
    tags=["Sensors Admin"],
)
async def admin_list_sensors(pool: DbPool):
    """Admin endpoint: lists all sensors regardless of visibility."""
    query = """
        SELECT sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at
        FROM sensor_metadata
        ORDER BY created_at DESC;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query)
        rows = await cur.fetchall()

    return [dict(row) for row in rows]


@router.post(
    "/admin/sensors",
    response_model=SensorMetadataResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Security(verify_admin_key)],
    summary="Create or register sensor (Admin only)",
    tags=["Sensors Admin"],
)
async def admin_create_sensor(sensor: SensorMetadataCreate, pool: DbPool):
    """Admin endpoint: registers a new sensor or updates existing metadata."""
    now = datetime.now(timezone.utc)
    query = """
        INSERT INTO sensor_metadata (sensor_id, friendly_name, latitude, longitude, is_hidden, description, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (sensor_id) 
        DO UPDATE SET friendly_name = EXCLUDED.friendly_name,
                      latitude = EXCLUDED.latitude,
                      longitude = EXCLUDED.longitude,
                      is_hidden = EXCLUDED.is_hidden,
                      description = EXCLUDED.description,
                      updated_at = EXCLUDED.updated_at
        RETURNING sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(
            query,
            (
                sensor.sensor_id,
                sensor.friendly_name,
                sensor.latitude,
                sensor.longitude,
                sensor.is_hidden,
                sensor.description,
                now,
            ),
        )
        row = await cur.fetchone()

    return dict(row)


@router.put(
    "/admin/sensors/{sensor_id}",
    response_model=SensorMetadataResponse,
    dependencies=[Security(verify_admin_key)],
    summary="Update sensor metadata (Admin only)",
    tags=["Sensors Admin"],
)
async def admin_update_sensor(
    sensor_id: str,
    update_data: SensorMetadataUpdate,
    pool: DbPool,
):
    """Admin endpoint: updates sensor metadata fields and/or visibility."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT * FROM sensor_metadata WHERE sensor_id = %s;",
            (sensor_id,),
        )
        existing = await cur.fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sensor '{sensor_id}' does not exist.",
            )

        friendly_name = (
            update_data.friendly_name
            if update_data.friendly_name is not None
            else existing["friendly_name"]
        )
        latitude = (
            update_data.latitude
            if update_data.latitude is not None
            else existing["latitude"]
        )
        longitude = (
            update_data.longitude
            if update_data.longitude is not None
            else existing["longitude"]
        )
        is_hidden = (
            update_data.is_hidden
            if update_data.is_hidden is not None
            else existing["is_hidden"]
        )
        description = (
            update_data.description
            if update_data.description is not None
            else existing["description"]
        )
        now = datetime.now(timezone.utc)

        update_query = """
            UPDATE sensor_metadata
            SET friendly_name = %s,
                latitude = %s,
                longitude = %s,
                is_hidden = %s,
                description = %s,
                updated_at = %s
            WHERE sensor_id = %s
            RETURNING sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at;
        """
        cur = await conn.execute(
            update_query,
            (friendly_name, latitude, longitude, is_hidden, description, now, sensor_id),
        )
        updated_row = await cur.fetchone()

    return dict(updated_row)


@router.patch(
    "/admin/sensors/{sensor_id}/visibility",
    response_model=SensorMetadataResponse,
    dependencies=[Security(verify_admin_key)],
    summary="Toggle sensor visibility (Admin only)",
    tags=["Sensors Admin"],
)
async def admin_toggle_visibility(
    sensor_id: str,
    body: SensorVisibilityUpdate,
    pool: DbPool,
):
    """Admin endpoint: quickly hides or reveals a sensor on the public portal."""
    now = datetime.now(timezone.utc)
    query = """
        UPDATE sensor_metadata
        SET is_hidden = %s,
            updated_at = %s
        WHERE sensor_id = %s
        RETURNING sensor_id, friendly_name, latitude, longitude, is_hidden, description, created_at, updated_at;
    """
    async with pool.connection() as conn:
        cur = await conn.execute(query, (body.is_hidden, now, sensor_id))
        row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sensor '{sensor_id}' not found.",
        )

    return dict(row)


@router.delete(
    "/admin/sensors/{sensor_id}",
    dependencies=[Security(verify_admin_key)],
    summary="Delete or archive sensor (Admin only)",
    tags=["Sensors Admin"],
)
async def admin_delete_sensor(
    sensor_id: str,
    pool: DbPool,
    purge_telemetry: bool = Query(
        default=False,
        description="If True, cascades and permanently deletes all recorded telemetry data.",
    ),
):
    """
    Admin endpoint: deletes a sensor.
    If purge_telemetry is False, sets is_hidden = True (soft delete) to preserve historical data.
    If purge_telemetry is True, permanently wipes the sensor and its telemetry records.
    """
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT sensor_id FROM sensor_metadata WHERE sensor_id = %s;",
            (sensor_id,),
        )
        if not await cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sensor '{sensor_id}' not found.",
            )

        if purge_telemetry:
            async with conn.transaction():
                await conn.execute("DELETE FROM sensor_data WHERE sensor_id = %s;", (sensor_id,))
                await conn.execute("DELETE FROM sensor_metadata WHERE sensor_id = %s;", (sensor_id,))
            return {
                "status": "purged",
                "sensor_id": sensor_id,
                "message": f"Sensor '{sensor_id}' and all telemetry permanently deleted.",
            }
        else:
            # Soft delete: set hidden
            await conn.execute(
                "UPDATE sensor_metadata SET is_hidden = TRUE, updated_at = %s WHERE sensor_id = %s;",
                (datetime.now(timezone.utc), sensor_id),
            )
            return {
                "status": "hidden",
                "sensor_id": sensor_id,
                "message": f"Sensor '{sensor_id}' was archived and hidden from public feeds.",
            }


# Backward-compatibility alias
@router.post(
    "/sensors/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Security(verify_admin_key)],
    deprecated=True,
    summary="Legacy register endpoint (Deprecated, use POST /admin/sensors)",
    tags=["Sensors Admin"],
)
async def legacy_register_sensor(sensor: SensorMetadataCreate, pool: DbPool):
    return await admin_create_sensor(sensor, pool)