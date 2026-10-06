"""Bounded, provenance-preserving reads of the environment-v1 contract."""

from datetime import UTC, datetime, timedelta

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/environment/measurements", tags=["Environment measurements"])


@router.get("")
async def environment_measurements(
    entity_id: str = Query(min_length=1, max_length=256),
    start: datetime | None = None,
    end: datetime | None = None,
    kind: str | None = Query(default=None, pattern="^(observation|model|forecast|derived)$"),
    metric: str | None = Query(default=None, min_length=1, max_length=128),
    limit: int = Query(default=1000, ge=1, le=10000),
    pool=Depends(get_db_pool),
):
    end = end or datetime.now(UTC) + timedelta(days=7)
    start = start or end - timedelta(days=14)
    if start.tzinfo is None or end.tzinfo is None or not start < end:
        raise HTTPException(422, "Use an increasing time range with explicit timezones")
    if end - start > timedelta(days=31):
        raise HTTPException(422, "Time range must not exceed 31 days")
    async with pool.connection() as conn:
        ready = await (await conn.execute(
            "SELECT to_regprocedure('write_environment_measurement(text,text,text,text,text,jsonb,"
            "timestamp with time zone,numeric,bigint,jsonb,text,timestamp with time zone,"
            "timestamp with time zone,text,timestamp with time zone)') IS NOT NULL AS ready"
        )).fetchone()
        if not ready or not ready['ready']:
            raise HTTPException(503, "Environment contract migration is not installed")
        cursor = await conn.execute("""SELECT d.id AS measurement_id,d.entity_id,d.metric,d.unit,
            d.source_id,d.basis,d.dimensions,d.semantics,r.observed_at AS valid_at,
            r.period_start,r.period_end,r.value,r.quality,r.collected_at,r.provenance,r.revision
            FROM measurement_definitions d JOIN entities e ON e.id=d.entity_id
            JOIN readings r ON r.measurement_id=d.id
            WHERE NOT e.is_hidden AND d.entity_id=%s AND d.dimensions->>'contract'='environment-v1'
                AND (%s::text IS NULL OR d.dimensions->>'data_kind'=%s)
                AND (%s::text IS NULL OR d.metric=%s)
                AND r.observed_at>=%s AND r.observed_at<%s
            ORDER BY r.observed_at,d.id LIMIT %s""",
            (entity_id, kind, kind, metric, metric, start, end, limit + 1))
        rows = await cursor.fetchall()
    return jsonable_encoder({"items": rows[:limit], "truncated": len(rows) > limit,
                             "start": start, "end": end})
