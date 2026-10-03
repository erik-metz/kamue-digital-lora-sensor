import os
import unittest
from unittest.mock import patch

from config import Settings


class ConfigTests(unittest.TestCase):
    def test_default_config(self):
        with patch.dict(os.environ, {}, clear=True):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 1800)
            self.assertEqual(s.state_dir, "/data")
            self.assertEqual(
                s.uba_api_base, "https://luftdaten.umweltbundesamt.de/api/air-data/v4"
            )
            self.assertAlmostEqual(s.min_lat, 49.40)
            self.assertAlmostEqual(s.max_lat, 50.05)
            self.assertAlmostEqual(s.min_lon, 8.25)
            self.assertAlmostEqual(s.max_lon, 8.85)

    def test_custom_bbox(self):
        with patch.dict(
            os.environ,
            {
                "UBA_BBOX": "8.30,49.50,8.70,49.90",
                "UBA_POLL_SECONDS": "600",
            },
            clear=True,
        ):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 600)
            self.assertAlmostEqual(s.min_lon, 8.30)
            self.assertAlmostEqual(s.min_lat, 49.50)
            self.assertAlmostEqual(s.max_lon, 8.70)
            self.assertAlmostEqual(s.max_lat, 49.90)

    def test_invalid_poll_interval(self):
        with (
            patch.dict(os.environ, {"UBA_POLL_SECONDS": "5"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_url(self):
        with (
            patch.dict(os.environ, {"UBA_API_BASE": "ftp://example.com"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_lat_bounds(self):
        with (
            patch.dict(
                os.environ,
                {"UBA_MIN_LAT": "50.0", "UBA_MAX_LAT": "49.0"},
                clear=True,
            ),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()
