import sys
import unittest
from datetime import UTC, datetime
from importlib.util import find_spec
from unittest.mock import AsyncMock, MagicMock

if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()

class MockResponse:
    def __init__(self, content=b"", status_code=200, headers=None, media_type=None):
        self.content = content
        self.status_code = status_code
        self.headers = headers or {}
        self.media_type = media_type

if "fastapi" not in sys.modules and find_spec("fastapi") is None:
    class MockRouter:
        def get(self, *args, **kwargs):
            return lambda fn: fn
        def post(self, *args, **kwargs):
            return lambda fn: fn
    mock_fastapi = MagicMock()
    mock_fastapi.APIRouter = lambda *args, **kwargs: MockRouter()
    mock_fastapi.Response = MockResponse
    mock_fastapi.Depends = lambda x: x
    mock_fastapi.Query = lambda default=None, **kwargs: default
    mock_fastapi.HTTPException = Exception
    mock_fastapi.status = MagicMock()
    sys.modules["fastapi"] = mock_fastapi
elif "fastapi" in sys.modules and isinstance(sys.modules["fastapi"], MagicMock):
    sys.modules["fastapi"].Response = MockResponse

if "pydantic" not in sys.modules and find_spec("pydantic") is None:
    class MockBaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
    mock_pydantic = MagicMock()
    mock_pydantic.BaseModel = MockBaseModel
    mock_pydantic.Field = lambda *args, **kwargs: kwargs.get("default", None)
    sys.modules["pydantic"] = mock_pydantic

if "dependencies" not in sys.modules:
    mock_dep = MagicMock()
    mock_dep.get_db_pool = MagicMock()
    sys.modules["dependencies"] = mock_dep

from endpoints.satellite import (
    download_satellite_data,
    get_latest_satellite_scene,
    get_satellite_scenes,
    get_satellite_tile,
)


class SatelliteEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchone = AsyncMock(return_value=None)
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_get_satellite_scenes_from_dataset(self):
        self.cursor.fetchone.return_value = {
            "data": {
                "summary": {"total_scenes": 1},
                "scenes": [
                    {
                        "id": "satellite-scene-s2c-t32uma-20260930t103323-l2a",
                        "date": "2026-09-30",
                        "cloudCoverPercent": 16.2,
                        "ndviMean": 0.462,
                    }
                ],
            },
            "fetched_at": datetime(2026, 9, 30, 12, 0, 0, tzinfo=UTC),
        }
        res = await get_satellite_scenes(self.pool, limit=10)
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["scenes"][0]["id"], "satellite-scene-s2c-t32uma-20260930t103323-l2a")
        self.assertEqual(res["scenes"][0]["ndviMean"], 0.462)

    async def test_get_latest_satellite_scene(self):
        self.cursor.fetchone.return_value = {
            "data": {
                "summary": {"latest_scene_date": "2026-09-30"},
                "scenes": [
                    {
                        "id": "satellite-scene-s2c-t32uma-20260930t103323-l2a",
                        "date": "2026-09-30",
                        "cloudCoverPercent": 16.2,
                        "ndviMean": 0.462,
                    }
                ],
            },
            "fetched_at": datetime(2026, 9, 30, 12, 0, 0, tzinfo=UTC),
        }
        res = await get_latest_satellite_scene(self.pool)
        self.assertIn("latest", res)
        self.assertEqual(res["latest"]["date"], "2026-09-30")

    async def test_get_satellite_tile_redirect(self):
        self.cursor.fetchone.return_value = {
            "metadata": {
                "assets": {"thumbnailUrl": "https://example.org/thumb.jpg"}
            }
        }
        resp = await get_satellite_tile("test-scene", 12, 2150, 1400, self.pool)
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp.headers.get("Location"), "https://example.org/thumb.jpg")

    async def test_get_satellite_tile_latest_and_ndvi(self):
        self.cursor.fetchone.return_value = {
            "metadata": {
                "assets": {"ndviUrl": "https://example.org/ndvi.jpg"}
            }
        }
        resp = await get_satellite_tile("latest", 12, 2150, 1400, self.pool, layer="ndvi")
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp.headers.get("Location"), "https://example.org/ndvi.jpg")

    async def test_download_satellite_data_json(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "satellite-scene-s2-20260615",
                "name": "Sentinel-2 2026-06-15",
                "metadata": {
                    "scene_id": "s2-20260615",
                    "date": "2026-06-15",
                    "cloud_cover": 2.5,
                    "ndvi_mean": 0.54,
                    "assets": {"thumbnailUrl": "https://example.org/thumb.png"},
                },
            }
        ]
        resp = await download_satellite_data(
            self.pool, start="2026-06-01", end="2026-06-30", layer="rgb", format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("open-ried-sentinel2-2026-06-01-to-2026-06-30.json", resp.headers.get("Content-Disposition", ""))

    async def test_download_satellite_data_zip(self):
        import io
        import zipfile
        from unittest.mock import patch

        self.cursor.fetchall.return_value = [
            {
                "id": "satellite-scene-s2-20260615",
                "name": "Sentinel-2 2026-06-15",
                "metadata": {
                    "scene_id": "s2-20260615",
                    "date": "2026-06-15",
                    "cloud_cover": 2.5,
                    "ndvi_mean": 0.54,
                    "assets": {"thumbnailUrl": "https://example.org/thumb.png"},
                },
            }
        ]
        with patch("urllib.request.urlopen") as mock_url:
            mock_url.return_value.__enter__.return_value.read.return_value = b"fake-png-bytes"
            resp = await download_satellite_data(
                self.pool, start="2026-06-01", end="2026-06-30", layer="all", format="zip"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("Content-Type"), "application/zip")
        self.assertIn(".zip", resp.headers.get("Content-Disposition", ""))

        # Verify ZIP structure
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            namelist = zf.namelist()
            self.assertIn("manifest.json", namelist)
            self.assertIn("README.txt", namelist)
            self.assertTrue(any(name.startswith("scenes/") for name in namelist))


if __name__ == "__main__":
    unittest.main()
