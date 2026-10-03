import os
import unittest
from unittest.mock import patch

from config import Settings


class ConfigTests(unittest.TestCase):
    def test_default_config(self):
        with patch.dict(os.environ, {}, clear=True):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 300)
            self.assertEqual(s.state_dir, "/data")
            self.assertEqual(s.opensensemap_url, "https://api.opensensemap.org/boxes")
            self.assertAlmostEqual(s.min_lat, 49.40)
            self.assertAlmostEqual(s.max_lat, 50.00)
            self.assertAlmostEqual(s.min_lon, 8.25)
            self.assertAlmostEqual(s.max_lon, 8.80)

    def test_custom_bbox(self):
        with patch.dict(
            os.environ,
            {
                "OPENSENSEMAP_BBOX": "8.30,49.50,8.70,49.90",
                "OPENSENSEMAP_POLL_SECONDS": "120",
            },
            clear=True,
        ):
            s = Settings.from_env()
            self.assertEqual(s.poll_seconds, 120)
            self.assertAlmostEqual(s.min_lon, 8.30)
            self.assertAlmostEqual(s.min_lat, 49.50)
            self.assertAlmostEqual(s.max_lon, 8.70)
            self.assertAlmostEqual(s.max_lat, 49.90)

    def test_invalid_poll_interval(self):
        with (
            patch.dict(os.environ, {"OPENSENSEMAP_POLL_SECONDS": "5"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_url(self):
        with (
            patch.dict(os.environ, {"OPENSENSEMAP_URL": "ftp://example.com"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_lat_bounds(self):
        with (
            patch.dict(
                os.environ,
                {"OPENSENSEMAP_MIN_LAT": "50.0", "OPENSENSEMAP_MAX_LAT": "49.0"},
                clear=True,
            ),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()
