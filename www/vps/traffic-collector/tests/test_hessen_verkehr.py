import unittest

from config import Settings
from hessen_verkehr import (
    parse_hessen_diva_feature,
    parse_hessen_roadworks_feature,
)


class HessenVerkehrTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            roads=("A67", "A5", "A6"),
            poll_seconds=180,
            state_dir="/tmp",
            db={},
            min_lat=49.45,
            max_lat=49.90,
            min_lon=8.25,
            max_lon=8.75,
        )

    def test_parse_hessen_diva_in_bounds(self):
        feat = {
            "id": "diva-123",
            "geometry": {
                "type": "Point",
                "coordinates": [8.6124, 49.6308],  # A5 near Heppenheim
            },
            "properties": {
                "street": "A5",
                "title": "A5 zwischen Heppenheim und Hemsbach 1 km Stau",
                "von": "Heppenheim",
                "bis": "Hemsbach",
                "description": "<p>1 km Stau<br/>5 min Reisezeitverlust</p>",
                "reisezeitverlust": 5,
                "staulaenge": 1.0,
                "sperrung": False,
            },
        }
        inc = parse_hessen_diva_feature(feat, self.settings)
        self.assertIsNotNone(inc)
        self.assertEqual(inc.id, "hessen-diva-diva-123")
        self.assertEqual(inc.road_name, "A5")
        self.assertEqual(inc.location_from, "Heppenheim")
        self.assertEqual(inc.location_to, "Hemsbach")
        self.assertEqual(inc.delay_seconds, 300)
        self.assertEqual(inc.length_meters, 1000)
        self.assertEqual(inc.source, "hessen_verkehrsservice")
        self.assertEqual(inc.severity, "moderate")
        self.assertEqual(inc.cause_type, "congestion")
        self.assertEqual(inc.coordinates, [[49.6308, 8.6124]])

    def test_parse_hessen_diva_out_of_bounds(self):
        feat = {
            "id": "diva-kassel",
            "geometry": {
                "type": "Point",
                "coordinates": [9.50, 51.30],  # Kassel (outside Ried)
            },
            "properties": {
                "street": "A7",
                "title": "Stau bei Kassel",
            },
        }
        inc = parse_hessen_diva_feature(feat, self.settings)
        self.assertIsNone(inc)

    def test_parse_hessen_roadworks_in_bounds(self):
        feat = {
            "id": "rw-456",
            "geometry": {
                "type": "Point",
                "coordinates": [8.5534, 49.6440],  # A67 near Lorsch
            },
            "properties": {
                "street": "A67",
                "title": "Dauerbaustelle",
                "von": "Darmstädter Kreuz",
                "bis": "Büttelborn",
                "kommentar": "Fahrbahninstandsetzung",
            },
        }
        inc = parse_hessen_roadworks_feature(feat, self.settings)
        self.assertIsNotNone(inc)
        self.assertEqual(inc.id, "hessen-rw-rw-456")
        self.assertEqual(inc.road_name, "A67")
        self.assertEqual(inc.source, "hessen_verkehrsservice")
        self.assertEqual(inc.category, "roadworks")
        self.assertEqual(inc.cause_type, "roadwork")
        self.assertIn("Fahrbahninstandsetzung", inc.description)
        self.assertEqual(inc.coordinates, [[49.6440, 8.5534]])
