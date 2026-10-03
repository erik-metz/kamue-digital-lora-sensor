import os
import unittest
from unittest.mock import patch

from config import Settings


class ConfigTests(unittest.TestCase):
    def test_default_config(self):
        with patch.dict(os.environ, {}, clear=True):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 3600)
            self.assertEqual(s.state_dir, "/data")
            self.assertEqual(
                s.packetbroker_api_url, "https://mapper.packetbroker.net/api/v2/gateways"
            )
            self.assertAlmostEqual(s.center_lat, 49.64)
            self.assertAlmostEqual(s.center_lon, 8.53)
            self.assertEqual(s.radius_meters, 25000)
            self.assertAlmostEqual(s.min_lat, 49.45)
            self.assertAlmostEqual(s.max_lat, 49.90)
            self.assertAlmostEqual(s.min_lon, 8.25)
            self.assertAlmostEqual(s.max_lon, 8.75)

    def test_custom_values(self):
        with patch.dict(
            os.environ,
            {
                "TTNMAPPER_POLL_SECONDS": "1800",
                "TTNMAPPER_CENTER_LAT": "49.70",
                "TTNMAPPER_CENTER_LON": "8.60",
                "TTNMAPPER_RADIUS_METERS": "15000",
            },
            clear=True,
        ):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 1800)
            self.assertAlmostEqual(s.center_lat, 49.70)
            self.assertAlmostEqual(s.center_lon, 8.60)
            self.assertEqual(s.radius_meters, 15000)

    def test_invalid_poll_interval(self):
        with (
            patch.dict(os.environ, {"TTNMAPPER_POLL_SECONDS": "10"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_url(self):
        with (
            patch.dict(os.environ, {"TTNMAPPER_API_URL": "ftp://example.com"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_lat_bounds(self):
        with (
            patch.dict(
                os.environ,
                {"TTNMAPPER_MIN_LAT": "50.0", "TTNMAPPER_MAX_LAT": "49.0"},
                clear=True,
            ),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()
