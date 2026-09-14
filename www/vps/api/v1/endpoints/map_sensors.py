"""Bounded public map inventory and latest measurements in one request."""

import math
from datetime import UTC, datetime

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import QueryCanceled

router = APIRouter()
MAX_MAP_SENSORS = 5000
MAX_MAP_READINGS = 64

MAP_QUERY = """
SELECT sm.id, sm.friendly_name, sm.latitude, sm.longitude, sm.description,
       sc.entity_type, sc.entity_id AS source_entity_id,
       COALESCE(readings.items, '[]'::json) AS readings
FROM sensor_metadata sm
LEFT JOIN smartcity_sources sc ON sc.sensor_id = sm.id
LEFT JOIN LATERAL (
    SELECT json_agg(r) AS items FROM (
        SELECT metric, unit, value, timestamp FROM sensor_latest
        WHERE sensor_id = sm.id AND metric <> 'waveform'
        ORDER BY metric, unit LIMIT %s
    ) r
) readings ON TRUE
WHERE sm.is_hidden = FALSE
  AND (sm.latitude IS NULL OR sm.latitude BETWEEN -90 AND 90)
  AND (sm.longitude IS NULL OR sm.longitude BETWEEN -180 AND 180)
ORDER BY sm.id LIMIT %s
"""


@router.get("/map/sensors", tags=["Telemetry Public"])
async def get_map_sensors(pool=Depends(get_db_pool)):
    try:
        async with pool.connection() as conn, conn.transaction():
            await conn.execute("SET LOCAL statement_timeout = '5s'")
            cursor = await conn.execute(MAP_QUERY, (MAX_MAP_READINGS + 1, MAX_MAP_SENSORS + 1))
            rows = await cursor.fetchall()
    except QueryCanceled:
        raise HTTPException(503, "Map data temporarily unavailable.") from None
    if len(rows) > MAX_MAP_SENSORS or any(len(row["readings"]) > MAX_MAP_READINGS for row in rows):
        raise HTTPException(422, "Map inventory exceeds supported size.")
    sensors = []
    for row in rows:
        item = dict(row)
        item["readings"] = [r for r in item["readings"] if isinstance(r["value"], (int, float)) and math.isfinite(r["value"])]
        sensors.append(item)
    return {"generated_at": datetime.now(UTC), "sensors": sensors}
