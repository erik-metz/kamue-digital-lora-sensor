import os
import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from config import Settings, station_settings_list
from source import discover_station
from test_metrics import config


class StationTests(unittest.IsolatedAsyncioTestCase):
    def test_independent_settings_and_duplicates(self):
        configs = station_settings_list(config().base)
        self.assertEqual(len(configs), 10)
        self.assertEqual(len({c.SENSOR_ID for c in configs}), 10)
        self.assertIsNone(configs[1].LATITUDE)
        self.assertEqual(
            len(
                station_settings_list(
                    replace(config().base, SHAKE_STATIONS="R498E,R498E,SC342")
                )
            ),
            2,
        )

    def test_invalid_settings_and_prefixed_names(self):
        for variables in (
            {"SHAKE_INGEST_MODE": "oops"},
            {"SHAKE_SAMPLING_INTERVAL_SEC": "0"},
            {"SHAKE_STATIONS": "bad"},
        ):
            with (
                patch.dict(os.environ, variables, clear=True),
                self.assertRaises(ValueError),
            ):
                Settings.from_env()
        with patch.dict(
            os.environ,
            {"SHAKE_INGEST_MODE": "api", "INGEST_MODE": "direct_db"},
            clear=True,
        ):
            self.assertEqual(Settings.from_env().INGEST_MODE, "api")

    async def test_discovers_actual_vertical_channel(self):
        station = config()
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get.return_value = SimpleNamespace(
            text="AM|R498E|00|SHZ|50.09|8.29|190", raise_for_status=lambda: None
        )
        with patch("source.httpx.AsyncClient", return_value=client):
            await discover_station(station)
        self.assertEqual(station.channel_identifier, "AM.R498E.00.SHZ")
        self.assertEqual((station.LATITUDE, station.LONGITUDE), (50.09, 8.29))
        client.get.return_value.text = ""
        with (
            patch("source.httpx.AsyncClient", return_value=client),
            self.assertRaises(ValueError),
        ):
            await discover_station(station)
