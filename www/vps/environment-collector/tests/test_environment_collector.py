"""Tests for EnvironmentCollector normalization and healthcheck."""

import unittest
from config import Settings
from normalize import normalize


class TestEnvironmentCollector(unittest.TestCase):
    def test_normalize_pegel_and_weather(self):
        settings = Settings(db={})
        sample_payload = {
            "pegel": {
                "number": "WORMS",
                "shortname": "WORMS",
                "currentMeasurement": {"timestamp":"2026-09-22T10:00:00+02:00", "value": 284, "stateMnwMhw": "normal"},
            },
            "weather": {
                "current": {
                    "time":"2026-09-22T08:00", "temperature_2m": 18.5,
                    "relative_humidity_2m": 65,
                    "precipitation": 0.0,
                }
            },
        }
        gauges, weather_list = normalize(sample_payload, settings)
        self.assertEqual(len(gauges), 1)
        self.assertEqual(gauges[0].id, "pegel-rhein-worms")
        self.assertEqual(gauges[0].level_m, 2.84)
        self.assertEqual(gauges[0].status, "unknown")

        self.assertEqual(len(weather_list), 1)
        self.assertEqual(weather_list[0].sensor_id, "weather-dwd-ried")
        self.assertEqual(weather_list[0].temperature, 18.5)
        self.assertEqual(gauges[0].measured_at.isoformat(), "2026-09-22T10:00:00+02:00")
        self.assertEqual(weather_list[0].timestamp.isoformat(), "2026-09-22T08:00:00+00:00")

    def test_normalize_pegel_high_stage(self):
        settings = Settings(db={})
        sample_payload = {
            "pegel": {
                "number": "WORMS",
                "currentMeasurement": {"timestamp":"2026-09-22T10:00:00+02:00", "value": 560},
            }
        }
        gauges, _ = normalize(sample_payload, settings)
        self.assertEqual(len(gauges), 1)
        self.assertEqual(gauges[0].level_m, 5.60)
        self.assertEqual(gauges[0].status, "unknown")


if __name__ == "__main__":
    unittest.main()
