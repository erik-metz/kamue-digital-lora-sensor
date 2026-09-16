"""Street Closures (Straßensperrungen) endpoints for the Hessian Ried area.
Covers Lampertheim, Rosengarten, Wehrzollhaus, Hofheim, Nordheim, Wattenheim, Biblis, Groß-Rohrheim, Bobstadt, Bürstadt.
"""

import json
from datetime import UTC, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_api_key
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/street-closures", tags=["Street Closures & Baustellen"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class StreetClosureResponse(BaseModel):
    id: str
    municipality: str
    district: str | None = None
    street_name: str
    location_from: str | None = None
    location_to: str | None = None
    closure_type: str = Field(default="full", description="'full' | 'partial' | 'lane_restriction'")
    status: str = Field(default="active", description="'scheduled' | 'active' | 'extended' | 'completed' | 'cancelled'")
    start_time: datetime
    end_time: datetime | None = None
    is_active: bool
    is_currently_active: bool
    reason: str | None = None
    description: str | None = None
    detour: str | None = None
    coordinates: list[list[float]] | list[float] | None = None
    source: str = "hessen_mobil"
    source_url: str | None = None
    created_at: datetime
    updated_at: datetime


class IngestClosurePayload(BaseModel):
    id: str
    municipality: str
    district: str | None = None
    street_name: str
    location_from: str | None = None
    location_to: str | None = None
    closure_type: str = "full"
    status: str = "active"
    start_time: datetime
    end_time: datetime | None = None
    is_active: bool = True
    reason: str | None = None
    description: str | None = None
    detour: str | None = None
    coordinates: list[list[float]] | list[float] | None = None
    source: str = "hessen_mobil"
    source_url: str | None = None


class SyncClosuresPayload(BaseModel):
    closures: list[IngestClosurePayload]


class UpdateClosurePayload(BaseModel):
    end_time: datetime | None = None
    status: str | None = None
    reason: str | None = None
    description: str | None = None
    detour: str | None = None
    is_active: bool | None = None


@router.get("", response_model=list[StreetClosureResponse])
async def list_street_closures(
    pool: DbPool,
    status_filter: str | None = Query(default=None, alias="status", description="'active' | 'scheduled' | 'all'"),
    municipality: str | None = Query(default=None, description="Filter by municipality, e.g. Lampertheim, Bürstadt"),
    include_completed_days: int = Query(default=0, ge=0, le=30, description="Include completed closures within past N days"),
):
    """Retrieve street closures (active and scheduled) across the Ried area."""
    now = datetime.now(UTC)
    query = """
        SELECT id, municipality, district, street_name, location_from, location_to,
               closure_type, status, start_time, end_time, is_active,
               reason, description, detour, coordinates, source, source_url,
               created_at, updated_at
        FROM street_closures
        WHERE 1=1
    """
    params: list[Any] = []

    if status_filter == "active":
        query += " AND is_active = TRUE AND start_time <= %s AND (end_time IS NULL OR end_time >= %s)"
        params.extend([now, now])
    elif status_filter == "scheduled":
        query += " AND is_active = TRUE AND start_time > %s"
        params.append(now)
    elif status_filter == "all":
        if include_completed_days == 0:
            query += " AND (is_active = TRUE OR (end_time IS NOT NULL AND end_time >= %s - INTERVAL '1 day'))"
            params.append(now)
        else:
            query += " AND (is_active = TRUE OR (end_time IS NOT NULL AND end_time >= %s - (%s * INTERVAL '1 day')))"
            params.extend([now, include_completed_days])
    else:
        # Default: all currently active or upcoming scheduled closures
        query += " AND (is_active = TRUE OR (end_time IS NOT NULL AND end_time >= %s))"
        params.append(now)

    if municipality:
        query += " AND (UPPER(municipality) = UPPER(%s) OR UPPER(district) = UPPER(%s))"
        params.extend([municipality, municipality])

    query += " ORDER BY start_time ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    results = []
    for r in rows:
        coords = r["coordinates"]
        if isinstance(coords, str):
            try:
                coords = json.loads(coords)
            except (json.JSONDecodeError, TypeError, ValueError):
                coords = None

        st = r["start_time"]
        et = r["end_time"]
        is_curr_active = r["is_active"] and (st <= now) and (et is None or et >= now)

        results.append(
            StreetClosureResponse(
                id=r["id"],
                municipality=r["municipality"],
                district=r["district"],
                street_name=r["street_name"],
                location_from=r["location_from"],
                location_to=r["location_to"],
                closure_type=r["closure_type"],
                status=r["status"],
                start_time=st,
                end_time=et,
                is_active=r["is_active"],
                is_currently_active=is_curr_active,
                reason=r["reason"],
                description=r["description"],
                detour=r["detour"],
                coordinates=coords,
                source=r["source"],
                source_url=r["source_url"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
        )
    return results


@router.get("/{closure_id}", response_model=StreetClosureResponse)
async def get_street_closure(closure_id: str, pool: DbPool):
    """Retrieve a single street closure by ID."""
    now = datetime.now(UTC)
    query = """
        SELECT id, municipality, district, street_name, location_from, location_to,
               closure_type, status, start_time, end_time, is_active,
               reason, description, detour, coordinates, source, source_url,
               created_at, updated_at
        FROM street_closures
        WHERE id = %s
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, [closure_id])
        r = await cur.fetchone()

    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Street closure not found")

    coords = r["coordinates"]
    if isinstance(coords, str):
        try:
            coords = json.loads(coords)
        except (json.JSONDecodeError, TypeError, ValueError):
            coords = None

    st = r["start_time"]
    et = r["end_time"]
    is_curr_active = r["is_active"] and (st <= now) and (et is None or et >= now)

    return StreetClosureResponse(
        id=r["id"],
        municipality=r["municipality"],
        district=r["district"],
        street_name=r["street_name"],
        location_from=r["location_from"],
        location_to=r["location_to"],
        closure_type=r["closure_type"],
        status=r["status"],
        start_time=st,
        end_time=et,
        is_active=r["is_active"],
        is_currently_active=is_curr_active,
        reason=r["reason"],
        description=r["description"],
        detour=r["detour"],
        coordinates=coords,
        source=r["source"],
        source_url=r["source_url"],
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


@router.post("/sync", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_api_key)])
async def sync_street_closures(payload: SyncClosuresPayload, pool: DbPool):
    """Ingest/upsert street closures from collector."""
    now = datetime.now(UTC)

    async with pool.connection() as conn, conn.cursor() as cur:
        for c in payload.closures:
            coords_json = json.dumps(c.coordinates) if c.coordinates is not None else None
            # Evaluate active/scheduled status
            closure_status = c.status
            if c.start_time > now:
                closure_status = "scheduled"
            elif c.end_time and c.end_time < now:
                closure_status = "completed"

            await cur.execute(
                """
                INSERT INTO street_closures (
                    id, municipality, district, street_name, location_from, location_to,
                    closure_type, status, start_time, end_time, is_active,
                    reason, description, detour, coordinates, source, source_url,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    municipality = EXCLUDED.municipality,
                    district = EXCLUDED.district,
                    street_name = EXCLUDED.street_name,
                    location_from = EXCLUDED.location_from,
                    location_to = EXCLUDED.location_to,
                    closure_type = EXCLUDED.closure_type,
                    status = EXCLUDED.status,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    is_active = EXCLUDED.is_active,
                    reason = EXCLUDED.reason,
                    description = EXCLUDED.description,
                    detour = EXCLUDED.detour,
                    coordinates = COALESCE(EXCLUDED.coordinates, street_closures.coordinates),
                    source = EXCLUDED.source,
                    source_url = EXCLUDED.source_url,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    c.id,
                    c.municipality,
                    c.district,
                    c.street_name,
                    c.location_from,
                    c.location_to,
                    c.closure_type,
                    closure_status,
                    c.start_time,
                    c.end_time,
                    c.is_active,
                    c.reason,
                    c.description,
                    c.detour,
                    coords_json,
                    c.source,
                    c.source_url,
                    now,
                    now,
                ),
            )

        # Mark expired closures as completed if end_time has passed
        await cur.execute(
            """
            UPDATE street_closures
            SET status = 'completed',
                is_active = FALSE,
                updated_at = %s
            WHERE is_active = TRUE
              AND end_time IS NOT NULL
              AND end_time < %s
            """,
            (now, now),
        )

    return {"status": "synced", "count": len(payload.closures)}


@router.post("/manual", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_api_key)])
async def create_manual_closure(payload: IngestClosurePayload, pool: DbPool):
    """Manually register a street closure (admin or community notice)."""
    sync_payload = SyncClosuresPayload(closures=[payload])
    await sync_street_closures(sync_payload, pool)
    return {"status": "created", "id": payload.id}


@router.patch("/{closure_id}", dependencies=[Depends(verify_api_key)])
async def update_closure(closure_id: str, payload: UpdateClosurePayload, pool: DbPool):
    """Update closure details (extension of end date, detour, status change)."""
    now = datetime.now(UTC)
    updates = []
    params: list[Any] = []

    if payload.end_time is not None:
        updates.append("end_time = %s")
        params.append(payload.end_time)
    if payload.status is not None:
        updates.append("status = %s")
        params.append(payload.status)
    if payload.reason is not None:
        updates.append("reason = %s")
        params.append(payload.reason)
    if payload.description is not None:
        updates.append("description = %s")
        params.append(payload.description)
    if payload.detour is not None:
        updates.append("detour = %s")
        params.append(payload.detour)
    if payload.is_active is not None:
        updates.append("is_active = %s")
        params.append(payload.is_active)

    if not updates:
        return {"status": "no_op"}

    updates.append("updated_at = %s")
    params.append(now)
    params.append(closure_id)

    query = f"UPDATE street_closures SET {', '.join(updates)} WHERE id = %s"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        if cur.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Street closure not found")

    return {"status": "updated", "id": closure_id}
