import unittest
from datetime import UTC, datetime

from config import Settings
from normalize import normalize, parse_timestamp


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            poll_seconds=300,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.00,
            min_lon=8.25,
            max_lon=8.80,
        )

    def test_normalize_valid_sensebox(self):
        now_iso = datetime.now(UTC).isoformat()
        raw = [
            {
                "_id": "58cd22d8c877fb0011774898",
                "name": "Bürstadt Wetterstation",
                "model": "homeWifiFeinstaub",
                "exposure": "outdoor",
                "currentLocation": {
                    "coordinates": [8.4552, 49.6425],
                    "type": "Point",
                },
                "updatedAt": now_iso,
                "sensors": [
                    {
                        "_id": "s1",
                        "title": "Temperatur",
                        "unit": "°C",
                        "sensorType": "HDC1080",
                        "lastMeasurement": {"value": "21.50", "createdAt": now_iso},
                    },
                    {
                        "_id": "s2",
                        "title": "rel. Luftfeuchte",
                        "unit": "%",
                        "sensorType": "HDC1080",
                        "lastMeasurement": {"value": "65.2", "createdAt": now_iso},
                    },
                    {
                        "_id": "s3",
                        "title": "Luftdruck",
                        "unit": "Pa",
                        "sensorType": "BMP280",
                        "lastMeasurement": {"value": "101325", "createdAt": now_iso},
                    },
                    {
                        "_id": "s4",
                        "title": "PM10",
                        "unit": "µg/m³",
                        "sensorType": "SDS011",
                        "lastMeasurement": {"value": "14.20", "createdAt": now_iso},
                    },
                    {
                        "_id": "s5",
                        "title": "PM2.5",
                        "unit": "µg/m³",
                        "sensorType": "SDS011",
                        "lastMeasurement": {"value": "7.80", "createdAt": now_iso},
                    },
                    {
                        "_id": "s6",
                        "title": "Beleuchtungsstärke",
                        "unit": "lx",
                        "sensorType": "TSL45315",
                        "lastMeasurement": {"value": "1250.0", "createdAt": now_iso},
                    },
                ],
            }
        ]

        boxes, skipped = normalize(raw, self.settings)
        self.assertEqual(len(boxes), 1)
        self.assertEqual(skipped, 0)

        box = boxes[0]
        self.assertEqual(box.box_id, "58cd22d8c877fb0011774898")
        self.assertEqual(box.sensor_id, "osem-58cd22d8c877fb0011774898")
        self.assertEqual(box.friendly_name, "senseBox: Bürstadt Wetterstation")
        self.assertEqual(box.model, "homeWifiFeinstaub")
        self.assertEqual(box.exposure, "outdoor")
        self.assertAlmostEqual(box.latitude, 49.6425)
        self.assertAlmostEqual(box.longitude, 8.4552)

        # 6 valid measurements mapped
        self.assertEqual(len(box.measurements), 6)
        m_map = {m.metric: m for m in box.measurements}

        self.assertIn("temperature", m_map)
        self.assertEqual(m_map["temperature"].value, 21.50)
        self.assertEqual(m_map["temperature"].unit, "°C")

        self.assertIn("relative_humidity", m_map)
        self.assertEqual(m_map["relative_humidity"].value, 65.2)
        self.assertEqual(m_map["relative_humidity"].unit, "%")

        # Luftdruck in Pa (101325) should be converted to hPa (1013.25)
        self.assertIn("pressure", m_map)
        self.assertEqual(m_map["pressure"].value, 1013.25)
        self.assertEqual(m_map["pressure"].unit, "hPa")

        self.assertIn("PM10", m_map)
        self.assertEqual(m_map["PM10"].value, 14.20)
        self.assertEqual(m_map["PM10"].unit, "µg/m³")

        self.assertIn("PM25", m_map)
        self.assertEqual(m_map["PM25"].value, 7.80)
        self.assertEqual(m_map["PM25"].unit, "µg/m³")

        self.assertIn("illuminance", m_map)
        self.assertEqual(m_map["illuminance"].value, 1250.0)
        self.assertEqual(m_map["illuminance"].unit, "lx")

    def test_out_of_bounds_filtered(self):
        raw = [
            {
                "_id": "berlin_box",
                "name": "Berlin Station",
                "currentLocation": {
                    "coordinates": [13.40, 52.52],  # Berlin
                    "type": "Point",
                },
                "sensors": [],
            }
        ]
        boxes, skipped = normalize(raw, self.settings)
        self.assertEqual(len(boxes), 0)
        self.assertEqual(skipped, 1)

    def test_stale_measurement_ignored(self):
        # Measurement from 2020 should be ignored as stale
        raw = [
            {
                "_id": "old_box",
                "name": "Alte Station",
                "currentLocation": {
                    "coordinates": [8.45, 49.65],
                    "type": "Point",
                },
                "sensors": [
                    {
                        "_id": "s_old",
                        "title": "Temperatur",
                        "unit": "°C",
                        "lastMeasurement": {
                            "value": "19.0",
                            "createdAt": "2020-01-01T00:00:00Z",
                        },
                    }
                ],
            }
        ]
        boxes, _skipped = normalize(raw, self.settings)
        self.assertEqual(len(boxes), 1)
        self.assertEqual(len(boxes[0].measurements), 0)

    def test_parse_timestamp(self):
        dt = parse_timestamp("2026-10-03T18:00:00Z")
        self.assertEqual(dt.tzinfo, UTC)
        self.assertEqual(dt.hour, 18)

        fallback = parse_timestamp("not a timestamp")
        self.assertIsInstance(fallback, datetime)
