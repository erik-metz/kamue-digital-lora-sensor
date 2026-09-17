import sys
import unittest
from datetime import UTC, datetime
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
    sys.modules["dependencies"] = mock_dep

from endpoints.finance import compare_finances, get_budgets, get_spending


class TestFinanceEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.execute = AsyncMock()
        self.cursor.fetchall = AsyncMock()
        self.cursor.fetchone = AsyncMock()

        self.conn = MagicMock()
        self.conn.cursor = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=self.cursor),
            __aexit__=AsyncMock(return_value=None),
        ))

        self.pool = MagicMock()
        self.pool.connection = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=self.conn),
            __aexit__=AsyncMock(return_value=None),
        ))

    async def test_get_budgets(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            (
                "bst-2024-plan", "Bürstadt", 2024, "plan", 39850000.0, 41200000.0, -1350000.0,
                9200000.0, 48000.0, 3450000.0, 11400000.0, 1680000.0,
                400, 380, 495, 17800000.0, 1048.0, 4100000.0, "https://buerstadt.de", now,
            )
        ]
        res = await get_budgets(self.pool, municipality="Bürstadt", year=2024, record_type="plan")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].municipality, "Bürstadt")
        self.assertEqual(res[0].fiscal_year, 2024)
        self.assertEqual(res[0].hebesatz_gewerbesteuer, 400)

    async def test_get_spending(self):
        self.cursor.fetchall.return_value = [
            (
                1, "bst-2024-plan", "Bürstadt", 2024, "03", "schools",
                "Schulträgeraufgaben", 2650000.0, 2590000.0, 850000.0, "Grundschulen",
            )
        ]
        res = await get_spending(self.pool, municipality="Bürstadt", year=2024, category="schools")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].category_name, "schools")
        self.assertEqual(res[0].expense_budgeted_eur, 2650000.0)

    async def test_compare_finances(self):
        self.cursor.fetchall.return_value = [
            (
                "Bürstadt", 2024, 39850000.0, 41200000.0, -1350000.0,
                9200000.0, 3450000.0, 400, 495, 17800000.0, 1048.0, 4100000.0,
            )
        ]
        res = await compare_finances(self.pool, year=2024, record_type="plan")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].municipality, "Bürstadt")
        self.assertEqual(res[0].debt_per_capita_eur, 1048.0)


if __name__ == "__main__":
    unittest.main()
