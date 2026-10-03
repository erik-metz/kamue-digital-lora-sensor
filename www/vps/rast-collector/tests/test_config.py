import os
import unittest
from unittest.mock import patch

from config import Settings


class ConfigTests(unittest.TestCase):
    def test_default_config(self):
        with patch.dict(os.environ, {}, clear=True):
            s = Settings.from_env()
            self.assertIn("A67", s.roads)
            self.assertIn("A5", s.roads)
            self.assertEqual(s.poll_seconds, 900)
            self.assertEqual(s.rast_monitor_url, "https://rast-monitor.de/api/sites")
            self.assertEqual(s.min_lat, 49.40)
            self.assertEqual(s.max_lat, 50.00)

    def test_custom_roads_and_intervals(self):
        env = {
            "RAST_ROADS": "A67,A5",
            "RAST_POLL_SECONDS": "600",
            "RAST_MONITOR_URL": "https://custom.rast-monitor.de/api/sites",
        }
        with patch.dict(os.environ, env, clear=True):
            s = Settings.from_env()
            self.assertEqual(s.roads, ("A67", "A5"))
            self.assertEqual(s.poll_seconds, 600)
            self.assertEqual(s.rast_monitor_url, "https://custom.rast-monitor.de/api/sites")

    def test_invalid_road_rejected(self):
        with (
            patch.dict(os.environ, {"RAST_ROADS": "invalid_road"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()

    def test_invalid_url_rejected(self):
        with (
            patch.dict(os.environ, {"RAST_MONITOR_URL": "ftp://bad-url"}, clear=True),
            self.assertRaises(ValueError),
        ):
            Settings.from_env()
