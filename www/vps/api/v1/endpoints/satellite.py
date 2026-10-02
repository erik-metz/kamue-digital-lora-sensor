"""Copernicus Sentinel-2 Satellite & Earth Observation API Endpoints.

Provides scenes metadata, latest vegetation/NDVI metrics, preview thumbnails,
and tile layer redirects for the Hessisches Ried.
"""

from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

router = APIRouter(prefix="/satellite", tags=["Satellite & Earth Observation"])
DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class SatelliteSceneResponse(BaseModel):
    id: str
    scene_id: str
    name: str
    date: str
    cloud_cover_percent: float
    vegetation_percent: float
    ndvi_mean: float | None = None
    drought_stressed_area_ha: float | None = None
    thumbnail_url: str | None = None
    visual_cog_url: str | None = None


@router.get("/scenes")
async def get_satellite_scenes(
    pool: DbPool,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """Retrieve available Sentinel-2 scenes for the Ried ordered by recency."""
    async with pool.connection() as conn:
        cursor = await conn.execute(
            """SELECT data, fetched_at FROM collected_datasets
            WHERE dataset = 'environment/satellite/scenes'
            ORDER BY fetched_at DESC LIMIT 1"""
        )
        row = await cursor.fetchone()
        if row and row.get("data"):
            data = row["data"]
            scenes = data.get("scenes", [])[:limit]
            return {
                "summary": data.get("summary", {}),
                "scenes": scenes,
                "count": len(scenes),
                "fetched_at": row["fetched_at"].isoformat() if hasattr(row["fetched_at"], "isoformat") else str(row["fetched_at"]),
            }

        # Fallback to entities query
        cursor = await conn.execute(
            """SELECT id, name, metadata FROM entities
            WHERE entity_type = 'satellite_scene'
            ORDER BY metadata->>'date' DESC LIMIT %s""",
            (limit,),
        )
        entities = await cursor.fetchall()
        scenes = [
            {
                "id": e["id"],
                "name": e["name"],
                "sceneId": e.get("metadata", {}).get("scene_id"),
                "date": e.get("metadata", {}).get("date"),
                "cloudCoverPercent": e.get("metadata", {}).get("cloud_cover"),
                "vegetationPercent": e.get("metadata", {}).get("vegetation_cover"),
                "assets": e.get("metadata", {}).get("assets", {}),
            }
            for e in entities
        ]
        return {
            "summary": {"total_scenes": len(scenes)},
            "scenes": scenes,
            "count": len(scenes),
        }


@router.get("/latest")
async def get_latest_satellite_scene(pool: DbPool) -> dict[str, Any]:
    """Retrieve the newest low-cloud Sentinel-2 scene and vegetation health metrics."""
    data = await get_satellite_scenes(pool, limit=1)
    scenes = data.get("scenes", [])
    if not scenes:
        raise HTTPException(status_code=404, detail="No satellite scenes available yet")
    return {
        "latest": scenes[0],
        "summary": data.get("summary", {}),
    }


@router.get("/tiles/{scene_id}/{z}/{x}/{y}.png")
async def get_satellite_tile(
    scene_id: str,
    z: int,
    x: int,
    y: int,
    pool: DbPool,
) -> Response:
    """Tile proxy/redirect for Sentinel-2 Cloud-Optimized GeoTIFF raster layers."""
    async with pool.connection() as conn:
        cursor = await conn.execute(
            """SELECT metadata FROM entities
            WHERE id = %s OR id = %s OR metadata->>'scene_id' = %s
            LIMIT 1""",
            (scene_id, f"satellite-scene-{scene_id.lower().replace('_', '-')}", scene_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

        meta = row.get("metadata", {})
        assets = meta.get("assets", {})
        thumbnail_url = assets.get("thumbnailUrl") or assets.get("preview")
        if thumbnail_url:
            # Temporary redirect to thumbnail/asset
            return Response(
                status_code=307,
                headers={"Location": thumbnail_url, "Cache-Control": "public, max-age=86400"},
            )

        raise HTTPException(status_code=404, detail="Raster visual asset unavailable")
