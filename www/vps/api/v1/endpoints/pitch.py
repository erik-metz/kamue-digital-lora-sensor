"""Small database-backed presentation summary. No provider requests or extrapolation."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from dependencies import get_db_pool
from endpoints.collected import mobility_snapshot
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from measurement_reads import read_sql
from pitch_activity import bike_changes, crossing_changes, moving_counts

router = APIRouter(tags=['Presentation'])
logger = logging.getLogger(__name__)


async def read_crossings(pool, start, end):
    async with pool.connection() as conn:
        await conn.execute("SET LOCAL statement_timeout = '10s'")
        cursor = await conn.execute("""SELECT d.entity_id,r.observed_at AS timestamp,r.value,r.quality
            FROM measurement_definitions d JOIN readings r ON r.measurement_id=d.id
            WHERE d.metric='crossing_state' AND d.source_id='rail-barrier-model'
                AND d.basis='model' AND d.unit='state'
                AND r.observed_at BETWEEN %s AND %s
            ORDER BY d.entity_id,r.observed_at""", (start-timedelta(seconds=30), end))
        return crossing_changes(await cursor.fetchall(), start, end)


async def read_bikes(pool, start, end):
    async with pool.connection() as conn:
        await conn.execute("SET LOCAL statement_timeout = '10s'")
        cursor = await conn.execute(read_sql("""SELECT s.sensor_id,s.last_fetched_at AS timestamp
            FROM nextbike_sources s JOIN sensor_metadata m ON m.id=s.sensor_id
            WHERE NOT m.is_hidden AND m.latitude BETWEEN 49.5 AND 49.85
                AND m.longitude BETWEEN 8.25 AND 8.65
                AND s.last_fetched_at BETWEEN %s AND %s"""),
            (start-timedelta(minutes=20), end))
        sources = await cursor.fetchall()
        cursor = await conn.execute("""SELECT o.sensor_id,o.observed_at AS timestamp,o.value,o.bike_numbers
            FROM nextbike_observations o WHERE o.metric='bike_available'
                AND o.sensor_id=ANY(%s) AND o.observed_at BETWEEN %s AND %s
            ORDER BY o.sensor_id,o.observed_at""",
            ([s['sensor_id'] for s in sources], start-timedelta(minutes=20), end))
        return bike_changes(await cursor.fetchall(), sources, start, end)


async def optional_read(awaitable):
    try:
        return await awaitable
    except Exception:
        logger.warning('Presentation activity source unavailable', exc_info=True)
        return None


@router.get('/pitch/activity')
async def activity(start: datetime, pool=Depends(get_db_pool)):
    end = datetime.now(UTC)
    start = start.replace(tzinfo=UTC) if start.tzinfo is None else start.astimezone(UTC)
    if not end-timedelta(hours=2) <= start <= end:
        raise HTTPException(400, 'Presentation start must be within the last two hours')
    crossings, bikes, snapshot = await asyncio.gather(
        optional_read(read_crossings(pool, start, end)),
        optional_read(read_bikes(pool, start, end)),
        optional_read(mobility_snapshot(pool)),
    )
    if crossings is None and bikes is None and snapshot is None:
        raise HTTPException(503, 'Activity sources unavailable')
    return JSONResponse(jsonable_encoder({
        'startedAt': start, 'checkedAt': end, 'crossings': crossings, 'bikes': bikes,
        'moving': moving_counts(snapshot, end) if snapshot is not None else None,
    }), headers={'Cache-Control': 'no-store'})
