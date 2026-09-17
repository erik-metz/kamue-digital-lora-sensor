import sys
import unittest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from importlib.util import find_spec

if "psycopg_pool" not in sys.modules and find_spec("psycopg_pool") is None:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules and find_spec("psycopg") is None:
    sys.modules["psycopg"] = MagicMock()

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

from endpoints.economy import (
    IngestCompanyPayload,
    get_economy_overview,
    list_business_registrations,
    list_companies,
    list_industry_structure,
    list_startup_initiatives,
    list_tax_rates,
    upsert_company,
)


class EconomyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.fetchone = AsyncMock(return_value=None)
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.cursor = MagicMock(return_value=MagicMock(__aenter__=AsyncMock(return_value=self.cursor), __aexit__=AsyncMock()))
        self.pool = MagicMock()
        self.pool.connection = MagicMock(return_value=MagicMock(__aenter__=AsyncMock(return_value=self.conn), __aexit__=AsyncMock()))

    async def test_get_economy_overview(self):
        self.cursor.fetchone.side_effect = [
            (2640, 2380, 260), # registrations
            (82500,),          # employees
            (15,),             # companies count
            (392.5, 380, 420), # tax stats
        ]
        self.cursor.fetchall.return_value = [
            ("buerstadt", "Bürstadt", 380, 480, 9450000, 1085.50, 184, 26),
            ("lampertheim", "Lampertheim", 400, 520, 22800000, 1265.40, 324, 26),
        ]

        res = await get_economy_overview(self.pool, year=2024)
        self.assertEqual(res.year, 2024)
        self.assertEqual(res.county_registrations_total, 2640)
        self.assertEqual(res.county_deregistrations_total, 2380)
        self.assertEqual(res.county_net_balance, 260)
        self.assertEqual(res.county_total_employees, 82500)
        self.assertEqual(res.total_companies_cataloged, 15)
        self.assertEqual(len(res.key_municipalities), 2)
        self.assertEqual(res.key_municipalities[0]["municipality_id"], "buerstadt")

    async def test_list_companies(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            (
                "comp-erdt-gruppe", "ERDT Gruppe", "GmbH & Co. KG", "buerstadt", "Bürstadt",
                "Bürstadt-Ost", "Industriestraße 18", "68642", 49.6468, 8.4625,
                "Logistik & Medizintechnik", "52.10", "250-499", "50-100 Mio. €",
                "Führender Dienstleister", "https://erdt.de", True, "bundesanzeiger", None,
                now, now,
            )
        ]

        comps = await list_companies(self.pool, municipality_id="buerstadt")
        self.assertEqual(len(comps), 1)
        self.assertEqual(comps[0].id, "comp-erdt-gruppe")
        self.assertEqual(comps[0].name, "ERDT Gruppe")
        self.assertEqual(comps[0].municipality_id, "buerstadt")
        self.assertEqual(comps[0].employee_range, "250-499")

    async def test_list_tax_rates(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            (
                1, "buerstadt", "Bürstadt", 2024,
                380, 350, 480,
                9450000, 38000, 2480000, 1085.50,
                "haushalt_2024", None, now,
            )
        ]

        taxes = await list_tax_rates(self.pool, year=2024, municipality_id="buerstadt")
        self.assertEqual(len(taxes), 1)
        self.assertEqual(taxes[0].hebesatz_gewerbesteuer, 380)
        self.assertEqual(taxes[0].hebesatz_grundsteuer_b, 480)
        self.assertEqual(taxes[0].revenue_gewerbesteuer_eur, 9450000)

    async def test_list_business_registrations(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            (
                1, "buerstadt", "municipality", 2024,
                184, 152, 32, 158, 129, 29, 26,
                "hsl_d_i_1", now,
            )
        ]

        regs = await list_business_registrations(self.pool, region_code="buerstadt", year=2024)
        self.assertEqual(len(regs), 1)
        self.assertEqual(regs[0].registrations_total, 184)
        self.assertEqual(regs[0].deregistrations_total, 158)
        self.assertEqual(regs[0].net_balance, 26)

    async def test_list_industry_structure(self):
        self.cursor.fetchall.return_value = [
            (1, "kreis-bergstrasse", 2024, "B-F", "Produzierendes Gewerbe", 26800, 32.5, "hsl"),
            (2, "kreis-bergstrasse", 2024, "G-J", "Handel & Verkehr", 23100, 28.0, "hsl"),
        ]

        sectors = await list_industry_structure(self.pool, region_code="kreis-bergstrasse", year=2024)
        self.assertEqual(len(sectors), 2)
        self.assertEqual(sectors[0].sector_code, "B-F")
        self.assertEqual(sectors[0].employees_count, 26800)

    async def test_list_startup_initiatives(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            (
                "init-wfb", "WFB Gründungsberatung", "consulting", "WFB Bergstraße",
                "Kostenlose Erstberatung", "https://wfb.de", "Kostenlos", "Gründer", now,
            )
        ]

        startups = await list_startup_initiatives(self.pool)
        self.assertEqual(len(startups), 1)
        self.assertEqual(startups[0].id, "init-wfb")
        self.assertEqual(startups[0].organizer, "WFB Bergstraße")


if __name__ == "__main__":
    unittest.main()
