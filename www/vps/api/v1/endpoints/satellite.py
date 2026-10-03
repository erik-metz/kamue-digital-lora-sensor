"""Copernicus Sentinel-2 Satellite & Earth Observation API Endpoints.

Provides scenes metadata, latest vegetation/NDVI metrics, preview thumbnails,
and tile layer redirects for the Hessisches Ried.
"""

import asyncio
import io
import json
import urllib.error
import urllib.request
import zipfile
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
    layer: str = Query(default="rgb", pattern="^(rgb|ndvi)$"),
) -> Response:
    """Tile proxy/redirect for Sentinel-2 Cloud-Optimized GeoTIFF raster layers."""
    async with pool.connection() as conn:
        if scene_id == "latest":
            cursor = await conn.execute(
                """SELECT metadata FROM entities
                WHERE entity_type = 'satellite_scene'
                ORDER BY metadata->>'date' DESC
                LIMIT 1"""
            )
        else:
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
        tile_url = None
        if layer == "ndvi":
            tile_url = assets.get("ndviUrl") or assets.get("ndvi_cog") or assets.get("thumbnailUrl") or assets.get("preview")
        else:
            tile_url = assets.get("thumbnailUrl") or assets.get("preview") or assets.get("visual_cog")

        if tile_url:
            return Response(
                status_code=307,
                headers={"Location": tile_url, "Cache-Control": "public, max-age=86400"},
            )

        raise HTTPException(status_code=404, detail="Raster visual asset unavailable")


@router.get("/download")
async def download_satellite_data(
    pool: DbPool,
    start: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    layer: str = Query(default="rgb", pattern="^(rgb|ndvi|all)$"),
    format: str = Query(default="zip", pattern="^(zip|json)$"),
) -> Response:
    """Download all satellite images or GIS metadata for a specified date range.

    Generates either a ZIP archive with PNG/JPEG images for each scene or a JSON manifest
    with original Cloud-Optimized GeoTIFF (COG) URLs.
    """
    if start > end:
        raise HTTPException(status_code=400, detail="Start date must be before or equal to end date")

    async with pool.connection() as conn:
        cursor = await conn.execute(
            """SELECT id, name, metadata FROM entities
            WHERE entity_type = 'satellite_scene'
              AND metadata->>'date' >= %s
              AND metadata->>'date' <= %s
            ORDER BY metadata->>'date' ASC""",
            (start, end),
        )
        rows = await cursor.fetchall()
        scenes = []
        if rows:
            scenes = [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "sceneId": r.get("metadata", {}).get("scene_id"),
                    "date": r.get("metadata", {}).get("date"),
                    "cloudCoverPercent": r.get("metadata", {}).get("cloud_cover"),
                    "vegetationPercent": r.get("metadata", {}).get("vegetation_cover"),
                    "ndviMean": r.get("metadata", {}).get("ndvi_mean"),
                    "droughtStressedAreaHa": r.get("metadata", {}).get("drought_stressed_area_ha"),
                    "assets": r.get("metadata", {}).get("assets", {}),
                }
                for r in rows
            ]
        else:
            # Fallback to collected_datasets
            cursor = await conn.execute(
                """SELECT data FROM collected_datasets
                WHERE dataset = 'environment/satellite/scenes'
                ORDER BY fetched_at DESC LIMIT 1"""
            )
            ds_row = await cursor.fetchone()
            if ds_row and ds_row.get("data"):
                all_scenes = ds_row["data"].get("scenes", [])
                scenes = [
                    s for s in all_scenes
                    if s.get("date") and start <= s["date"] <= end
                ]

    if not scenes:
        raise HTTPException(
            status_code=404,
            detail=f"No satellite scenes found between {start} and {end} for the Ried.",
        )

    if format == "json":
        manifest = {
            "title": "Open Ried Sens - Copernicus Sentinel-2 Satelliten-Export",
            "time_range": {"start": start, "end": end},
            "layer": layer,
            "scene_count": len(scenes),
            "scenes": scenes,
            "license": "Copernicus Open Access / European Union (EU Regulation 377/2014)",
        }
        json_bytes = json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8")
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="open-ried-sentinel2-{start}-to-{end}.json"',
                "Cache-Control": "no-store",
            },
        )

    # format == "zip"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "title": "Open Ried Sens - Copernicus Sentinel-2 Bildersammlung",
            "time_range": {"start": start, "end": end},
            "layer": layer,
            "scene_count": len(scenes),
            "scenes": scenes,
            "license": "Copernicus Open Access / European Union",
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))

        readme = f"""Open Ried Sens: Copernicus Sentinel-2 Satellitenbild-Archiv
Zeitraum: {start} bis {end}
Gewählte Ebene: {layer}
Anzahl der Szenen: {len(scenes)}

Enthaltene Dateien:
- manifest.json: Vollständige Metadaten, Wolkenbedeckung, NDVI-Mittelwerte und 10m-COG-Download-Links
- scenes/: Szenen-Bilder (RGB True Color / NDVI Vitalität) für jede wolkenfreie Befliegung des Hessischen Rieds

Lizenz:
Copernicus Sentinel data [2022-2026] operated by ESA / European Union.
Frei nutzbar für Bürger, Forschung, Landwirtschaft und Verwaltung gemäß Open-Data-Richtlinie.
"""
        zf.writestr("README.txt", readme)

        # Minimal valid 1x1 PNG fallback
        valid_png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
            b"\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa74v\xd8\x00\x00\x00\x00IEND\xaeB`\x82"
        )

        def _fetch_image(url: str) -> bytes | None:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "OpenRiedSens-Downloader/1.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return resp.read()
            except (urllib.error.URLError, TimeoutError, OSError):
                return None

        for s in scenes:
            s_date = s.get("date", "unknown")
            s_id = s.get("sceneId") or s.get("id", "scene")
            assets = s.get("assets", {})

            if layer in ("rgb", "all"):
                rgb_url = assets.get("thumbnailUrl") or assets.get("preview") or assets.get("visual_cog")
                rgb_bytes = None
                if rgb_url and rgb_url.startswith(("http://", "https://")):
                    rgb_bytes = await asyncio.to_thread(_fetch_image, rgb_url)
                zf.writestr(f"scenes/{s_date}_{s_id}_rgb.png", rgb_bytes or valid_png)

            if layer in ("ndvi", "all"):
                ndvi_url = assets.get("ndviUrl") or assets.get("preview") or assets.get("thumbnailUrl")
                ndvi_bytes = None
                if ndvi_url and ndvi_url.startswith(("http://", "https://")):
                    ndvi_bytes = await asyncio.to_thread(_fetch_image, ndvi_url)
                zf.writestr(f"scenes/{s_date}_{s_id}_ndvi.png", ndvi_bytes or valid_png)

    zip_bytes = buf.getvalue()
    headers = {
        "Content-Type": "application/zip",
        "Content-Disposition": f'attachment; filename="open-ried-sentinel2-{layer}-{start}-to-{end}.zip"',
        "Cache-Control": "no-store",
    }
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)

