import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()

from importlib.util import find_spec

if "fastapi" not in sys.modules and find_spec("fastapi") is None:
    class MockRouter:
        def get(self, *args, **kwargs):
            return lambda fn: fn
        def post(self, *args, **kwargs):
            return lambda fn: fn
        def patch(self, *args, **kwargs):
            return lambda fn: fn
        def put(self, *args, **kwargs):
            return lambda fn: fn
        def delete(self, *args, **kwargs):
            return lambda fn: fn
    mock_fastapi = MagicMock()
    mock_fastapi.APIRouter = lambda *args, **kwargs: MockRouter()
    mock_fastapi.Depends = lambda x: x
    mock_fastapi.Query = lambda default=None, **kwargs: default
    mock_fastapi.HTTPException = Exception
    mock_fastapi.status = MagicMock()
    sys.modules["fastapi"] = mock_fastapi

if "pydantic" not in sys.modules and find_spec("pydantic") is None:
    class MockBaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def __getattr__(self, name):
            return None
    mock_pydantic = MagicMock()
    mock_pydantic.BaseModel = MockBaseModel
    mock_pydantic.Field = lambda *args, **kwargs: kwargs.get("default", None)
    sys.modules["pydantic"] = mock_pydantic

if "dependencies" not in sys.modules:
    mock_dep = MagicMock()
    mock_dep.get_db_pool = MagicMock()
    mock_dep.verify_api_key = MagicMock()
    sys.modules["dependencies"] = mock_dep

from endpoints.environment import (
    get_protected_areas,
    get_agriculture_stats,
    get_crop_parcels,
    get_flood_gauges,
    get_noise_corridors,
    get_map_services,
    get_groundwater_stations,
)


class EnvironmentEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_get_protected_areas(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "nsg-lampertheimer-altrhein",
                "name": "Naturschutzgebiet Lampertheimer Altrhein",
                "designation": "nsg",
                "municipality": "Lampertheim",
                "area_hectares": 516.0,
                "legal_ordinance_year": 1927,
                "conservation_aims": "Auenwälder & Vogelbrut",
                "visiting_rules": {"leash_required": True},
                "geojson": {"type": "Polygon", "coordinates": []},
                "source": "hlnug_natureg",
            }
        ]
        results = await get_protected_areas(self.pool)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "nsg-lampertheimer-altrhein")
        self.assertEqual(results[0]["designation"], "nsg")

        # Test with filters
        filtered_results = await get_protected_areas(self.pool, municipality="Lampertheim", designation="nsg")
        self.assertEqual(len(filtered_results), 1)
        self.conn.execute.assert_called()

    async def test_get_agriculture_stats(self):
        self.cursor.fetchall.return_value = [
            {
                "municipality": "Bürstadt",
                "year": 2025,
                "crop_family": "sonderkultur",
                "crop_name": "Spargel",
                "area_hectares": 485.0,
                "percentage_of_agricultural_land": 24.2,
            }
        ]
        results = await get_agriculture_stats(self.pool)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["crop_name"], "Spargel")
        self.assertEqual(results[0]["percentage_of_agricultural_land"], 24.2)

    async def test_get_flood_gauges(self):
        now = datetime.now(timezone.utc)
        self.cursor.fetchall.return_value = [
            {
                "id": "pegel-rhein-worms",
                "name": "Rheinpegel Worms",
                "water_body": "Rhein",
                "municipality": "Worms / Riedufer",
                "latitude": 49.6315,
                "longitude": 8.3755,
                "current_level_m": 2.78,
                "discharge_m3_s": 1420.0,
                "alarm_level_1_m": 4.50,
                "alarm_level_2_m": 5.50,
                "alarm_level_3_m": 6.50,
                "status": "normal",
                "source": "pegelonline_wsv",
                "updated_at": now,
            }
        ]
        results = await get_flood_gauges(self.pool)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "normal")
        self.assertEqual(results[0]["current_level_m"], 2.78)

    async def test_get_groundwater_stations(self):
        now = datetime.now(timezone.utc)
        self.cursor.fetchall.return_value = [
            {
                "id": "gw-bst-boxheimerhof",
                "friendly_name": "Grundwassermessstelle Bürstadt Boxheimerhof",
                "latitude": 49.6295,
                "longitude": 8.4810,
                "description": "HLNUG Pegel-Nr. 3021",
                "depth_to_water_m": 2.15,
                "measured_at": now,
                "nitrate_mg_l": 28.4,
            }
        ]
        results = await get_groundwater_stations(self.pool)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["depth_to_water_m"], 2.15)
        self.assertEqual(results[0]["nitrate_mg_l"], 28.4)


if __name__ == "__main__":
    unittest.main()
