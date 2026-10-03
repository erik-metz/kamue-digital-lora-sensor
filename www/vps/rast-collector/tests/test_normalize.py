import unittest
from datetime import UTC, datetime

from config import Settings
from normalize import normalize, parse_timestamp


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            roads=("A67", "A5"),
            poll_seconds=900,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.00,
            min_lon=8.25,
            max_lon=8.80,
        )

    def test_normalize_valid_site(self):
        raw = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [8.553497, 49.64408],
                    },
                    "properties": {
                        "datex_id": "DE-HE-670010",
                        "name": "Lorsch Ost",
                        "road_identifier": "A67",
                        "road_destination": "Darmstadt",
                        "operator_name": "Niederlassung Südwest",
                        "total_spaces": 77,
                        "official_spaces": 77,
                        "vacant_spaces": None,
                        "occupancy_pct": 105,
                        "site_status": "full",
                        "opening_status": "open",
                        "occupancy_detection_type": "modelBased",
                        "fetched_at": "2026-10-03T13:30:02.496Z",
                    },
                }
            ],
        }
        sites, skipped = normalize(raw, self.settings)
        self.assertEqual(len(sites), 1)
        self.assertEqual(skipped, 0)
        s = sites[0]
        self.assertEqual(s.datex_id, "DE-HE-670010")
        self.assertEqual(s.sensor_id, "rast-de-he-670010")
        self.assertEqual(s.name, "Lorsch Ost")
        self.assertEqual(s.friendly_name, "Rastplatz Lorsch Ost (A67)")
        self.assertEqual(s.road, "A67")
        self.assertEqual(s.destination, "Darmstadt")
        self.assertEqual(s.latitude, 49.64408)
        self.assertEqual(s.longitude, 8.553497)
        self.assertEqual(s.capacity, 77)
        self.assertEqual(s.occupancy_pct, 105.0)
        # 77 * 105% = 81 occupied, free = 0
        self.assertEqual(s.occupied_spaces, 81)
        self.assertEqual(s.free_spaces, 0)
        self.assertEqual(s.site_status, "full")
        self.assertEqual(s.opening_status, "open")
        self.assertEqual(s.detection_type, "modelBased")
        self.assertEqual(s.observed_at.year, 2026)

    def test_vacant_spaces_direct(self):
        raw = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [8.559411, 49.595793],
                    },
                    "properties": {
                        "datex_id": "DE-HE-670011",
                        "name": "Wildbahn",
                        "road_identifier": "A67",
                        "total_spaces": 37,
                        "vacant_spaces": 15,
                        "occupancy_pct": 59,
                    },
                }
            ],
        }
        sites, _skipped = normalize(raw, self.settings)
        self.assertEqual(len(sites), 1)
        s = sites[0]
        self.assertEqual(s.free_spaces, 15)
        self.assertEqual(s.occupied_spaces, 22)

    def test_out_of_bounds_filtered(self):
        raw = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [13.06, 52.70],  # Berlin area
                    },
                    "properties": {
                        "datex_id": "DE-BB-002398",
                        "name": "Krämer Forst",
                        "road_identifier": "A10",
                    },
                }
            ],
        }
        sites, skipped = normalize(raw, self.settings)
        self.assertEqual(len(sites), 0)
        self.assertEqual(skipped, 1)

    def test_road_filtered(self):
        raw = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [8.55, 49.65],
                    },
                    "properties": {
                        "datex_id": "DE-HE-999999",
                        "name": "Random",
                        "road_identifier": "A3",  # Not in allowed roads
                    },
                }
            ],
        }
        sites, skipped = normalize(raw, self.settings)
        self.assertEqual(len(sites), 0)
        self.assertEqual(skipped, 1)

    def test_parse_timestamp(self):
        dt = parse_timestamp("2026-10-03T13:30:02.496Z")
        self.assertEqual(dt.tzinfo, UTC)
        self.assertEqual(dt.hour, 13)
        self.assertEqual(dt.minute, 30)

        fallback = parse_timestamp("invalid")
        self.assertIsInstance(fallback, datetime)
