import sys
import unittest
from datetime import date
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

from endpoints.elections import get_election_detail, get_election_districts, list_elections


class TestElectionEndpoints(unittest.IsolatedAsyncioTestCase):
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

    async def test_list_elections(self):
        self.cursor.fetchall.return_value = [
            (
                "kw-2021-bst", "Bürstadt", "kommunalwahl", "Kommunalwahl 2021",
                date(2021, 3, 14), 12450, 6420, 51.57, 6185, 235, 31,
                {"parties": [{"name": "CDU", "votes": 75850, "percent": 45.8, "seats": 14}]},
                "votemanager", "https://votemanager.de",
            )
        ]
        res = await list_elections(self.pool, municipality="Bürstadt", election_type="kommunalwahl")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0].id, "kw-2021-bst")
        self.assertEqual(res[0].turnout_percent, 51.57)

    async def test_get_election_detail(self):
        self.cursor.fetchone.return_value = (
            "kw-2021-bst", "Bürstadt", "kommunalwahl", "Kommunalwahl 2021",
            date(2021, 3, 14), 12450, 6420, 51.57, 6185, 235, 31,
            {"parties": []}, "votemanager", "https://votemanager.de",
        )
        res = await get_election_detail("kw-2021-bst", self.pool)
        self.assertEqual(res.id, "kw-2021-bst")
        self.assertEqual(res.title, "Kommunalwahl 2021")

    async def test_get_election_districts(self):
        self.cursor.fetchone.return_value = ("kw-2021-bst", "Kommunalwahl 2021", "Bürstadt")
        self.cursor.fetchall.return_value = [
            (
                "ed-bst-01", "01", "Bürstadt 01 – Schillerschule", "Schillerschule",
                "Boxheimerhofstr. 18", 49.6495, 8.4615,
                {"type": "Polygon", "coordinates": [[[8.455, 49.646], [8.468, 49.646], [8.468, 49.654], [8.455, 49.654], [8.455, 49.646]]]},
                2150, 1140, 53.02, 1098, 42, {"CDU": 482, "SPD": 284}, "CDU",
            )
        ]
        res = await get_election_districts("kw-2021-bst", self.pool)
        self.assertEqual(res.election_id, "kw-2021-bst")
        self.assertEqual(len(res.features), 1)
        feat = res.features[0]
        self.assertEqual(feat.properties["name"], "Bürstadt 01 – Schillerschule")
        self.assertEqual(feat.properties["turnout_percent"], 53.02)
        self.assertEqual(feat.properties["winning_party"], "CDU")


if __name__ == "__main__":
    unittest.main()
