"""Satellite tracking from canonical storage, independent of Sentinel imagery."""
import asyncio
import json
import time
from datetime import UTC, datetime, timedelta

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from satellite_orbits import (
    MAX_ELEMENT_AGE,
    RIED_BOUNDS,
    element,
    position,
    regional_position,
)

router = APIRouter(prefix="/satellites", tags=["Satellite tracking"])
_lock = asyncio.Lock()
_cache = None
_cached_at = 0.0
_cache_pool = None
_orbits = []
_orbits_at = 0.0
_orbits_pool = None

def response(body):
    return JSONResponse(jsonable_encoder(body), headers={"Cache-Control": "no-store"})

def instant(value):
    if value.tzinfo is None:
        raise HTTPException(422, "Use a timestamp with timezone")
    return value.astimezone(UTC)

async def elements(pool, norad=None, at=None):
    async with pool.connection() as conn:
        if at is None:
            cursor = await conn.execute("""SELECT e.id,e.name,r.provenance
                FROM entities e JOIN measurement_definitions d ON d.entity_id=e.id
                JOIN latest_readings r ON r.measurement_id=d.id
                WHERE e.entity_type='satellite' AND d.metric='orbital_elements'
                AND d.source_id='space-track' AND (%s::text IS NULL OR e.id=%s)
                AND COALESCE(e.metadata->>'decayed','false') != 'true'
                ORDER BY e.id""", (None if norad is None else f"satellite:{norad}", f"satellite:{norad}"))
        else:
            cursor = await conn.execute("""SELECT e.id,e.name,r.provenance FROM entities e
                JOIN measurement_definitions d ON d.entity_id=e.id JOIN readings r ON r.measurement_id=d.id
                WHERE e.id=%s AND d.metric='orbital_elements' AND d.source_id='space-track'
                AND r.observed_at<=%s AND (r.provenance->>'element_epoch')::timestamptz<=%s
                ORDER BY r.observed_at DESC LIMIT 1""", (f"satellite:{norad}", at, at))
        return await cursor.fetchall()

async def snapshot(pool):
    global _cache, _cached_at, _cache_pool, _orbits, _orbits_at, _orbits_pool
    async with _lock:
        if _cache_pool is pool and _cache is not None and time.monotonic()-_cached_at < 1:
            return _cache
        now = datetime.now(UTC)
        if _orbits_pool is not pool or time.monotonic()-_orbits_at >= 60:
            rows = await elements(pool)
            def compile_rows():
                compiled = []
                for row in rows:
                    try:
                        compiled.append((row['id'], row['name'], element(row['provenance']['omm'])))
                    except (KeyError, TypeError, ValueError):
                        continue
                return compiled
            _orbits = await asyncio.to_thread(compile_rows)
            _orbits_pool, _orbits_at = pool, time.monotonic()
        def calculate():
            samples, valid = [], 0
            for key, name, orbit in _orbits:
                if not orbit[1] <= now <= orbit[1] + MAX_ELEMENT_AGE:
                    continue
                valid += 1
                sample = regional_position(orbit, now)
                if sample:
                    sample.update(id=key, name=name)
                    samples.append(sample)
            return samples, valid
        samples, valid = await asyncio.to_thread(calculate)
        async with pool.connection() as conn:
            cursor = await conn.execute("SELECT metadata FROM entities WHERE id='satellite:feed'")
            feed = await cursor.fetchone()
        _cache = {"positions": samples, "satellites": [{"norad_id": p['norad_id'], "name": p['name']} for p in samples], "timestamp": now.isoformat(),
                  "catalog_count": len(_orbits), "valid_orbit_count": valid, "status": "ready" if valid else "unavailable",
                  "region": {"name": "ried", "bounds": RIED_BOUNDS},
                  "source": "space-track", "basis": "model",
                  "last_import": feed['metadata'].get('last_success') if feed else None}
        _cached_at, _cache_pool = time.monotonic(), pool
        return _cache

@router.get("/latest")
async def latest(pool=Depends(get_db_pool)):
    return response(await snapshot(pool))

@router.get("/stream")
async def stream(request: Request, pool=Depends(get_db_pool)):
    async def events():
        while not await request.is_disconnected():
            yield 'data: ' + json.dumps(await snapshot(pool), separators=(',', ':')) + '\n\n'
            await asyncio.sleep(1)
    return StreamingResponse(events(), media_type='text/event-stream',
        headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

@router.get("/{norad_id}/history")
async def history(norad_id: int, start: datetime, end: datetime,
                  limit: int = Query(1000, ge=1, le=10000), pool=Depends(get_db_pool)):
    start, end = instant(start), instant(end)
    if not 1 <= norad_id <= 999999999 or not start < end or end-start > timedelta(days=7):
        raise HTTPException(422, "Choose a valid NORAD ID and at most seven days")
    async with pool.connection() as conn:
        cursor = await conn.execute("""SELECT r.observed_at,
            jsonb_object_agg(d.metric,r.value) AS values,
            max(r.provenance->>'element_version') AS element_version,
            max(r.provenance->>'element_epoch') AS element_epoch
            FROM measurement_definitions d JOIN readings r ON r.measurement_id=d.id
            WHERE d.entity_id=%s AND d.source_id='space-track' AND d.basis='model'
            AND d.metric IN ('latitude','longitude','altitude_km','speed_km_s') AND r.quality='valid'
            AND r.observed_at>=%s AND r.observed_at<%s
            GROUP BY r.observed_at HAVING count(DISTINCT d.metric)=4
            ORDER BY r.observed_at LIMIT %s""", (f"satellite:{norad_id}", start, end, limit+1))
        rows = await cursor.fetchall()
    points = [{"timestamp": row['observed_at'], **row['values'], "element_version": row['element_version'], "element_epoch": row['element_epoch']}
              for row in rows[:limit]]
    return response({"positions": points, "basis": "model", "source": "space-track",
                     "next_start": rows[limit]['observed_at'] if len(rows)>limit else None})

@router.get("/{norad_id}/orbit")
async def orbit(norad_id: int, at: datetime | None = None,
                minutes: int = Query(90, ge=1, le=180), pool=Depends(get_db_pool)):
    if not 1 <= norad_id <= 999999999:
        raise HTTPException(422, "Invalid NORAD ID")
    at = instant(at) if at is not None else datetime.now(UTC)
    rows = await elements(pool, norad_id, at)
    if not rows:
        raise HTTPException(404, "No orbital elements available for this time")
    points = [sample for offset in range(0, minutes*60+1, 30)
              if (sample := position(rows[0]['provenance']['omm'], at+timedelta(seconds=offset))) is not None]
    if not points:
        raise HTTPException(404, "Orbital elements are outside their validity window")
    return response({"positions": points, "basis": "model", "source": "space-track", "name": rows[0]['name']})
