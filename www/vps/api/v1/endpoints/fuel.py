"""Read the cached regional snapshot; public requests never call the provider."""
from datetime import UTC, datetime

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, Response

router = APIRouter()


@router.get("/fuel", tags=["Mobility Public"])
async def fuel_snapshot(response: Response, pool=Depends(get_db_pool)):
    async with pool.connection() as conn, conn.transaction():
        await conn.execute("SET LOCAL statement_timeout = '5s'")
        cursor = await conn.execute("SELECT fetched_at, data FROM fuel_snapshot WHERE id=1")
        row = await cursor.fetchone()
    response.headers["Cache-Control"] = "public, max-age=30, s-maxage=30"
    return {"fetched_at": row["fetched_at"] if row else None,
        "stale": not row or not 0 <= (datetime.now(UTC)-row["fetched_at"]).total_seconds() <= 900,
        **(row["data"] if row else {"stations": [], "center": [49.62, 8.46], "radius_km": 25})}
