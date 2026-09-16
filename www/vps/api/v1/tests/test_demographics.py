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
    mock_dep.verify_admin_key = MagicMock()
    mock_dep.verify_api_key = MagicMock()
    sys.modules["dependencies"] = mock_dep

from endpoints.demographics import (
    IngestFacilityPayload,
    IngestSnapshotPayload,
    get_demographic_summary,
    get_municipality_commuters,
    get_municipality_timeseries,
    ingest_demographic_snapshot,
    ingest_educational_facility,
    list_educational_facilities,
    list_municipalities,
)


class TestDemographicsEndpoints(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.fetchone = AsyncMock(return_value=None)
        self.cursor.execute = AsyncMock()
        self.cursor.rowcount = 1
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.conn.cursor.return_value.__aenter__.return_value = self.cursor
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_list_municipalities(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "buerstadt",
                "ags": "06431005",
                "name": "Bürstadt",
                "county": "Kreis Bergstraße",
                "state": "Hessen",
                "area_sqkm": 34.46,
                "center_lat": 49.6425,
                "center_lng": 8.4552,
            },
            {
                "id": "lampertheim",
                "ags": "06431013",
                "name": "Lampertheim",
                "county": "Kreis Bergstraße",
                "state": "Hessen",
                "area_sqkm": 72.27,
                "center_lat": 49.5958,
                "center_lng": 8.4688,
            },
        ]

        result = await list_municipalities(self.pool)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].id, "buerstadt")
        self.assertEqual(result[0].name, "Bürstadt")
        self.assertEqual(result[1].name, "Lampertheim")

    async def test_get_demographic_summary(self):
        # 1. municipalities, 2. snapshots, 3. facilities counts
        self.cursor.fetchall.side_effect = [
            [
                {"id": "buerstadt", "name": "Bürstadt"},
                {"id": "lampertheim", "name": "Lampertheim"},
            ],
            [
                {"municipality_id": "buerstadt", "metric": "total_population", "value": 16980},
                {"municipality_id": "buerstadt", "metric": "population_density", "value": 492.7},
                {"municipality_id": "buerstadt", "metric": "foreign_share_pct", "value": 15.8},
                {"municipality_id": "buerstadt", "metric": "net_migration", "value": 125},
                {"municipality_id": "lampertheim", "metric": "total_population", "value": 33150},
            ],
            [
                {"municipality_id": "buerstadt", "facility_type": "grundschule", "count": 2},
                {"municipality_id": "buerstadt", "facility_type": "kita", "count": 5},
                {"municipality_id": "lampertheim", "facility_type": "gymnasium", "count": 1},
                {"municipality_id": "lampertheim", "facility_type": "kita", "count": 7},
            ],
        ]

        result = await get_demographic_summary(self.pool, year=2024)
        self.assertEqual(len(result), 2)

        bst = next(r for r in result if r.municipality_id == "buerstadt")
        self.assertEqual(bst.total_population, 16980)
        self.assertEqual(bst.population_density, 492.7)
        self.assertEqual(bst.foreign_share_pct, 15.8)
        self.assertEqual(bst.net_migration, 125)
        self.assertEqual(bst.schools_count, 2)
        self.assertEqual(bst.kitas_count, 5)

        la = next(r for r in result if r.municipality_id == "lampertheim")
        self.assertEqual(la.total_population, 33150)
        self.assertEqual(la.schools_count, 1)
        self.assertEqual(la.kitas_count, 7)

    async def test_get_municipality_timeseries(self):
        now = datetime.now(timezone.utc)
        self.cursor.fetchall.return_value = [
            {
                "municipality_id": "buerstadt",
                "year": 2024,
                "category": "population",
                "metric": "total_population",
                "value": 16980,
                "unit": "count",
                "dimension": "total",
                "source": "hsl_statistik_hessen",
                "source_url": None,
                "recorded_at": now,
            }
        ]

        result = await get_municipality_timeseries(
            municipality_id="buerstadt",
            pool=self.pool,
            category="population",
            metric=None,
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].metric, "total_population")
        self.assertEqual(result[0].value, 16980)

    async def test_get_municipality_commuters(self):
        self.cursor.fetchall.return_value = [
            {
                "year": 2024,
                "home_municipality_id": "buerstadt",
                "partner_ags": "08222000",
                "partner_name": "Mannheim",
                "direction": "outbound",
                "commuter_count": 1650,
                "source": "bundesagentur_fuer_arbeit_pendleratlas",
            },
            {
                "year": 2024,
                "home_municipality_id": "buerstadt",
                "partner_ags": "07319000",
                "partner_name": "Worms",
                "direction": "outbound",
                "commuter_count": 1280,
                "source": "bundesagentur_fuer_arbeit_pendleratlas",
            },
        ]

        result = await get_municipality_commuters(
            municipality_id="buerstadt",
            pool=self.pool,
            direction="outbound",
            year=2024,
        )
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].partner_name, "Mannheim")
        self.assertEqual(result[0].commuter_count, 1650)
        self.assertEqual(result[1].partner_name, "Worms")

    async def test_list_educational_facilities(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "sch-bst-eks",
                "name": "Erich-Kästner-Schule (IGS)",
                "facility_type": "gesamtschule",
                "municipality_id": "buerstadt",
                "district": "Bürstadt",
                "address": "Wolfstraße 23, 68642 Bürstadt",
                "latitude": 49.6483,
                "longitude": 8.4615,
                "operator": "kreis_bergstrasse",
                "operator_name": "Kreis Bergstraße Schulamt",
                "capacity": 1000,
                "current_enrollment": 950,
                "min_age_years": 10,
                "max_age_years": 17,
                "opening_hours": "Mo-Fr 07:30–16:00",
                "website_url": "https://eks-buerstadt.de",
                "reporting_year": 2025,
                "is_active": True,
            }
        ]

        result = await list_educational_facilities(
            pool=self.pool,
            municipality_id="buerstadt",
            facility_type="gesamtschule",
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].id, "sch-bst-eks")
        self.assertEqual(result[0].capacity, 1000)
        self.assertEqual(result[0].current_enrollment, 950)
        self.assertEqual(result[0].utilization_rate, 95.0)

    async def test_ingest_demographic_snapshot(self):
        payload = IngestSnapshotPayload(
            municipality_id="buerstadt",
            year=2024,
            category="population",
            metric="total_population",
            value=17000,
        )
        resp = await ingest_demographic_snapshot(payload, self.pool, "dummy_token")
        self.assertEqual(resp["status"], "ok")
        self.cursor.execute.assert_called_once()

    async def test_ingest_educational_facility(self):
        payload = IngestFacilityPayload(
            id="sch-test",
            name="Testschule",
            facility_type="grundschule",
            municipality_id="buerstadt",
            address="Teststr. 1",
            latitude=49.64,
            longitude=8.45,
            operator="kreis_bergstrasse",
            capacity=200,
            current_enrollment=180,
        )
        resp = await ingest_educational_facility(payload, self.pool, "dummy_token")
        self.assertEqual(resp["status"], "ok")
        self.cursor.execute.assert_called_once()


if __name__ == "__main__":
    unittest.main()
