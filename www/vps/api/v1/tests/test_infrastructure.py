import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()

from endpoints.infrastructure import (
    get_broadband_coverage,
    get_energy_summary,
    get_ev_charging_stations,
    get_road_conditions,
    get_wifi_hotspots,
)


class InfrastructureTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.cursor.return_value.__aenter__.return_value = self.cursor
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_get_road_conditions(self):
        now = datetime.now(timezone.utc)
        self.cursor.fetchall.return_value = [
            (
                "rc-bst-mainstr",
                "Mainstraße",
                "gemeindestrasse",
                "Bürstadt",
                "Kernstadt",
                1.8,
                "sehr_gut",
                0,
                "none",
                "asphalt",
                now,
                "zakb_fleet_ai",
                [[49.643, 8.451], [49.646, 8.454]],
            )
        ]

        result = await get_road_conditions(self.pool)
        self.assertEqual(result.summary.total_segments, 1)
        self.assertEqual(result.summary.average_condition_grade, 1.8)
        self.assertEqual(result.summary.good_condition_pct, 100.0)
        self.assertEqual(len(result.segments), 1)
        self.assertEqual(result.segments[0].road_name, "Mainstraße")
        self.assertEqual(result.segments[0].condition_grade, 1.8)

    async def test_get_energy_summary(self):
        self.cursor.fetchall.return_value = [
            (
                "nrg-zakb-huettenfeld-pv",
                "ZAKB Solarpark Hüttenfeld",
                "solar_pv",
                "ZAKB",
                "Lampertheim",
                "Heidenfahrt 1",
                49.5965,
                8.5845,
                3200.0,
                3400.0,
                "2018-06-01",
                "SEE984729104821",
                "Solarpark",
            ),
            (
                "nrg-zakb-buerstadt-biogas",
                "ZAKB Biogasanlage Bürstadt",
                "biogas",
                "ZAKB",
                "Bürstadt",
                "Außerhalb Biogasanlage 1",
                49.6385,
                8.4480,
                1200.0,
                8400.0,
                "2016-11-01",
                "SEE910293847561",
                "Biogasanlage",
            ),
        ]

        result = await get_energy_summary(self.pool)
        self.assertEqual(result.total_installed_capacity_kw, 4400.0)
        self.assertTrue(result.current_total_power_kw > 0)
        self.assertEqual(len(result.facilities), 2)
        self.assertIn("biogas", result.by_type_kw)

    async def test_get_broadband_coverage(self):
        self.cursor.fetchall.return_value = [
            (
                "bb-bst-gewerbe-ost",
                "Bürstadt",
                "Kernstadt",
                "Gewerbegebiet Ost",
                "ftth_fibre",
                1000,
                500,
                "active_available",
                100.0,
                "Deutsche Glasfaser",
                "2024-06-30",
                [[49.644, 8.456], [49.648, 8.465]],
            )
        ]

        result = await get_broadband_coverage(self.pool)
        self.assertEqual(result.total_areas, 1)
        self.assertEqual(result.active_fibre_areas, 1)
        self.assertEqual(result.areas[0].primary_provider, "Deutsche Glasfaser")

    async def test_get_ev_charging_stations(self):
        self.cursor.fetchall.return_value = [
            (
                "ev-bst-bahnhof",
                "DE*PWK*E009182",
                "Pfalzwerke Schnellladepark Bürstadt Bahnhof",
                "Pfalzwerke ecopower",
                "Wilhelminenstraße 2",
                "Bürstadt",
                "Kernstadt",
                49.6453,
                8.4580,
                4,
                150.0,
                True,
                ["CCS", "Type2"],
                True,
                3,
                1,
                "live_ocpi",
            )
        ]

        result = await get_ev_charging_stations(self.pool)
        self.assertEqual(result.total_stations, 1)
        self.assertEqual(result.total_charge_points, 4)
        self.assertEqual(result.available_charge_points, 3)
        self.assertEqual(result.fast_charging_stations, 1)

    async def test_get_wifi_hotspots(self):
        self.cursor.fetchall.return_value = [
            (
                "wifi-bst-marktplatz",
                "Hessen-WLAN Historisches Rathaus & Marktplatz",
                "Hessen-WLAN",
                "Stadt Bürstadt",
                "market_square",
                "Marktplatz 1",
                "Bürstadt",
                49.6414,
                8.4546,
                "outdoor",
                "captive_terms_only",
                100,
                True,
            )
        ]

        result = await get_wifi_hotspots(self.pool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].ssid, "Hessen-WLAN")
        self.assertEqual(result[0].municipality, "Bürstadt")


if __name__ == "__main__":
    unittest.main()
