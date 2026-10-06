"""Satellite responses must never invent scenes, indices, NDVI images or basemaps."""

import io
import json
import unittest
import zipfile
from unittest.mock import AsyncMock, MagicMock

from endpoints.satellite import (
    download_satellite_data,
    get_latest_satellite_scene,
    get_satellite_scenes,
    get_satellite_tile,
)
from fastapi import HTTPException


class SatelliteEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchone = AsyncMock(return_value=None)
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_legacy_proxy_is_missing_even_when_saved_as_ndvi(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "scene",
                "name": "Sentinel",
                "metadata": {
                    "date": "2026-10-05",
                    "ndvi_mean": 0.6,
                    "drought_stressed_area_ha": 200,
                },
            }
        ]
        result = await get_satellite_scenes(self.pool, limit=20)
        self.assertIsNone(result["scenes"][0]["ndviMean"])
        self.assertIsNone(result["scenes"][0]["droughtStressedAreaHa"])
        self.assertIn("NOT is_hidden", self.conn.execute.call_args.args[0])

    async def test_empty_archive_has_no_synthesized_scenes(self):
        self.assertEqual(
            (await get_satellite_scenes(self.pool, limit=20))["scenes"], []
        )
        with self.assertRaises(HTTPException) as ctx:
            await get_latest_satellite_scene(self.pool)
        self.assertEqual(ctx.exception.status_code, 404)
        with self.assertRaises(HTTPException) as ctx:
            await download_satellite_data(
                self.pool,
                start="2026-06-01",
                end="2026-06-30",
                layer="all",
                format="json",
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_tile_requires_archived_crop_no_thumbnail_or_world_imagery(self):
        self.cursor.fetchone.return_value = {
            "metadata": {"assets": {"thumbnailUrl": "https://example.org/thumb.png"}}
        }
        with self.assertRaises(HTTPException) as ctx:
            await get_satellite_tile("scene", 12, 2150, 1400, self.pool, layer="ndvi")
        self.assertEqual(ctx.exception.status_code, 404)
        with self.assertRaises(HTTPException) as ctx:
            await get_satellite_tile("latest", 12, 99999, 1400, self.pool, layer="rgb")
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_missing_rasters_export_manifest_without_fake_pngs(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "scene",
                "name": "Sentinel",
                "metadata": {"date": "2026-10-05", "scene_id": "S2_REAL"},
            }
        ]
        response = await download_satellite_data(
            self.pool, start="2026-10-05", end="2026-10-05", layer="all", format="zip"
        )
        with zipfile.ZipFile(io.BytesIO(response.body)) as archive:
            self.assertEqual(set(archive.namelist()), {"manifest.json", "README.txt"})
            self.assertEqual(
                json.loads(archive.read("manifest.json"))["missing_rasters"],
                ["S2_REAL"],
            )
        with self.assertRaises(HTTPException) as ctx:
            await download_satellite_data(
                self.pool,
                start="2026-02-31",
                end="2026-10-05",
                layer="rgb",
                format="json",
            )
        self.assertEqual(ctx.exception.status_code, 400)
