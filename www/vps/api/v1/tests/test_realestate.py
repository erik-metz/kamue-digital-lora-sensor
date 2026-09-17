import sys
import unittest
from datetime import UTC, date, datetime
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
    mock_dep.verify_admin_key = MagicMock()
    mock_dep.verify_api_key = MagicMock()
    sys.modules["dependencies"] = mock_dep

from endpoints.realestate import (
    get_boris_zones,
    get_construction_activity,
    get_development_plans,
    get_housing_stock,
    get_land_use,
    get_market_benchmarks,
    get_realestate_summary,
    get_sources,
)


class TestRealEstateEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.fetchone = AsyncMock(return_value=None)
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.cursor.return_value.__aenter__.return_value = self.cursor
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_get_realestate_summary(self):
        self.cursor.fetchall.return_value = [
            {
                "municipality": "Bürstadt",
                "total_dwellings": 9860,
                "vacancy_rate_pct": 2.7,
                "avg_living_space_sqm": 98.4,
                "avg_land_value_residential": 480.0,
                "avg_rent_cold_sqm": 8.85,
                "avg_apartment_buy_sqm": 2850.0,
                "recent_permits_dwellings": 64,
                "recent_completions_dwellings": 56,
                "active_bplaene_count": 2,
            }
        ]
        res = await get_realestate_summary(self.pool)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].municipality, "Bürstadt")
        self.assertEqual(res[0].total_dwellings, 9860)
        self.assertEqual(res[0].vacancy_rate_pct, 2.7)

    async def test_get_housing_stock(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "hs-buerstadt-2022",
                "municipality": "Bürstadt",
                "district": "Gesamtstadt",
                "reference_year": 2022,
                "total_buildings": 5120,
                "residential_buildings": 4320,
                "total_dwellings": 9860,
                "avg_living_space_sqm": 98.4,
                "vacant_dwellings": 266,
                "vacancy_rate_pct": 2.7,
                "age_distribution": {"pre_1919": 450, "1949_1978": 1850},
                "building_types": {"single_family": 2740},
                "heating_energy": {"gas": 64.2, "oil": 21.8},
                "source": "statistik_hessen_zensus_2022",
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_housing_stock(self.pool, municipality="Bürstadt")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].municipality, "Bürstadt")
        self.assertEqual(res[0].age_distribution["1949_1978"], 1850)

    async def test_get_boris_zones(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "boris-bst-kern-w",
                "zone_code": "06431005-01",
                "municipality": "Bürstadt",
                "district": "Kernstadt",
                "stichtag": date(2024, 1, 1),
                "land_value_eur_sqm": 480.0,
                "zone_type": "Wohnbaufläche",
                "development_status": "baureifes Land",
                "floor_space_index": 0.8,
                "center_lat": 49.6425,
                "center_lng": 8.4550,
                "geometry": {"type": "Polygon", "coordinates": []},
                "source": "boris_hessen",
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_boris_zones(self.pool, municipality="Bürstadt", zone_type="Wohnbaufläche")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].land_value_eur_sqm, 480.0)

    async def test_get_land_use(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "lu-bst-wald",
                "municipality": "Bürstadt",
                "district": "Bürstädter Wald",
                "category": "forest",
                "category_detail": "Laub- und Nadelwald",
                "area_sqm": 7450000.0,
                "area_hectares": 745.0,
                "center_lat": 49.6380,
                "center_lng": 8.4980,
                "geometry": {"type": "Polygon", "coordinates": []},
                "source": "alkis_hessen",
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_land_use(self.pool, municipality="Bürstadt", category="forest")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].category, "forest")
        self.assertEqual(res[0].area_hectares, 745.0)

    async def test_get_construction_activity(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "cp-bst-2025",
                "municipality": "Bürstadt",
                "year": 2025,
                "residential_permits_count": 39,
                "residential_dwellings_count": 64,
                "residential_living_space_sqm": 7350.0,
                "non_residential_volume_m3": 33500.0,
                "completions_buildings_count": 35,
                "completions_dwellings_count": 56,
                "source": "statistik_hessen_f_ii_1",
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_construction_activity(self.pool, municipality="Bürstadt")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].residential_dwellings_count, 64)

    async def test_get_market_benchmarks(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "mb-bst-rent-2025",
                "municipality": "Bürstadt",
                "year": 2025,
                "metric_type": "rent_cold_sqm",
                "median_val": 8.80,
                "avg_val": 8.85,
                "min_val": 6.50,
                "max_val": 12.00,
                "unit": "EUR/m2",
                "transaction_count": None,
                "source": "gutachterausschuss_bergstrasse",
                "source_title": "Nettokaltmiete Wohnungsbestand",
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_market_benchmarks(self.pool, municipality="Bürstadt", metric_type="rent_cold_sqm")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].avg_val, 8.85)

    async def test_get_development_plans(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "dp-bst-sonneneck-2",
                "municipality": "Bürstadt",
                "district": "Kernstadt",
                "plan_name": "Bebauungsplan Sonneneck II",
                "plan_number": "BP-BST-52",
                "status": "rechtskraeftig",
                "target_use": "Wohnen",
                "area_hectares": 8.4,
                "resolution_year": 2021,
                "document_url": "https://buerstadt.de",
                "center_lat": 49.6480,
                "center_lng": 8.4670,
                "geometry": None,
                "updated_at": datetime.now(UTC),
            }
        ]
        res = await get_development_plans(self.pool, municipality="Bürstadt")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].plan_name, "Bebauungsplan Sonneneck II")

    async def test_get_sources(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "src-boris-hessen",
                "name": "BORIS Hessen",
                "provider": "HVBG",
                "dataset_type": "boris",
                "license": "dl-zero-de/2.0",
                "source_url": "https://www.gds.hessen.de/wfs2/boris",
                "last_imported_at": datetime.now(UTC),
                "record_count": 24,
            }
        ]
        res = await get_sources(self.pool)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].id, "src-boris-hessen")


if __name__ == "__main__":
    unittest.main()
