import sys
import unittest
from datetime import UTC, datetime, timedelta
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


from endpoints.street_closures import (
    IngestClosurePayload,
    SyncClosuresPayload,
    UpdateClosurePayload,
    get_street_closure,
    list_street_closures,
    sync_street_closures,
    update_closure,
)


class StreetClosuresTests(unittest.IsolatedAsyncioTestCase):
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

    async def test_list_street_closures(self):
        now = datetime.now(UTC)
        start = now - timedelta(days=1)
        end = now + timedelta(days=10)
        self.cursor.fetchall.return_value = [
            {
                "id": "closure-lampertheim-hospitalstr",
                "municipality": "Lampertheim",
                "district": "Mitte",
                "street_name": "Hospitalstraße",
                "location_from": "Eugen-Schreiber-Straße",
                "location_to": "Carl-Ulrich-Straße",
                "closure_type": "full",
                "status": "active",
                "start_time": start,
                "end_time": end,
                "is_active": True,
                "reason": "Straßeneinbruch",
                "description": "Vollsperrung wegen Fahrbahneinbruchs",
                "detour": "Umleitung über Parkstraße",
                "coordinates": [49.593, 8.468],
                "source": "stadt_lampertheim",
                "source_url": "https://www.lampertheim.de",
                "created_at": start,
                "updated_at": now,
            }
        ]

        result = await list_street_closures(self.pool, municipality="Lampertheim")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].street_name, "Hospitalstraße")
        self.assertEqual(result[0].municipality, "Lampertheim")
        self.assertEqual(result[0].closure_type, "full")
        self.assertTrue(result[0].is_currently_active)

    async def test_get_street_closure_found(self):
        now = datetime.now(UTC)
        self.cursor.fetchone.return_value = {
            "id": "closure-rosengarten-b47",
            "municipality": "Lampertheim",
            "district": "Rosengarten",
            "street_name": "B47 (Rheinbrücke / Wehrzollhaus)",
            "location_from": "Worms Ost",
            "location_to": "Wehrzollhaus",
            "closure_type": "partial",
            "status": "active",
            "start_time": now - timedelta(days=2),
            "end_time": now + timedelta(days=5),
            "is_active": True,
            "reason": "Brückenbauarbeiten",
            "description": "Einspurige Verkehrsführung",
            "detour": None,
            "coordinates": [49.632, 8.365],
            "source": "hessen_mobil",
            "source_url": None,
            "created_at": now - timedelta(days=2),
            "updated_at": now,
        }

        result = await get_street_closure("closure-rosengarten-b47", self.pool)
        self.assertEqual(result.id, "closure-rosengarten-b47")
        self.assertEqual(result.district, "Rosengarten")
        self.assertTrue(result.is_currently_active)

    async def test_sync_street_closures(self):
        now = datetime.now(UTC)
        payload = SyncClosuresPayload(
            closures=[
                IngestClosurePayload(
                    id="closure-buerstadt-mainstr",
                    municipality="Bürstadt",
                    district="Bobstadt",
                    street_name="Mainstraße",
                    location_from="Bahnhof",
                    location_to="Frankenstraße",
                    closure_type="full",
                    status="scheduled",
                    start_time=now + timedelta(days=2),
                    end_time=now + timedelta(days=6),
                    is_active=True,
                    reason="Gleisbauarbeiten",
                    description="Bahnübergang gesperrt",
                    detour="Über B47 Umgehung",
                    coordinates=[49.648, 8.455],
                    source="deutsche_bahn",
                )
            ]
        )

        resp = await sync_street_closures(payload, self.pool)
        self.assertEqual(resp["status"], "synced")
        self.assertEqual(resp["count"], 1)
        self.assertTrue(self.cursor.execute.called)

    async def test_update_closure(self):
        now = datetime.now(UTC)
        payload = UpdateClosurePayload(
            end_time=now + timedelta(days=20),
            status="extended",
            reason="Verzögerung Lieferengpass Asphalt",
        )
        resp = await update_closure("closure-1", payload, self.pool)
        self.assertEqual(resp["status"], "updated")
        self.assertEqual(resp["id"], "closure-1")


if __name__ == "__main__":
    unittest.main()
