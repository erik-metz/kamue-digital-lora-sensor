"""Unit tests for HLNUG groundwater monitoring station adapter."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from groundwater import parse_hlnug_groundwater


class GroundwaterAdapterTests(unittest.TestCase):
    def test_parse_hlnug_groundwater_filters_and_formats(self):
        sample_payload = {
            "features": [
                {
                    "attributes": {
                        "ID": 17754,
                        "MESSTELLENNAME": "HOFHEIM",
                        "KURZNAME": "HOFH",
                        "BETREIBER_NAME": "Regierungspräsidium Darmstadt",
                        "GEMEINDE_NAME": "Lampertheim",
                        "MASSGEBL_ZWECK": "Grundwassermonitoring",
                        "MESSSTELLENART": "Beobachtungsrohr",
                    },
                    "geometry": {"x": 8.3881, "y": 49.6534},
                },
                {
                    "attributes": {
                        "ID": 12890,
                        "MESSTELLENNAME": "BIBLIS (alt)",
                        "KURZNAME": "BIBL",
                        "BETREIBER_NAME": "Regierungspräsidium Darmstadt",
                        "GEMEINDE_NAME": "Biblis",
                        "MASSGEBL_ZWECK": "Grundwassermonitoring",
                        "MESSSTELLENART": "Beobachtungsrohr",
                    },
                    "geometry": {"x": 8.4289, "y": 49.7028},
                },
                {
                    # Outside targeted municipality
                    "attributes": {
                        "ID": 99999,
                        "MESSTELLENNAME": "WIESBADEN",
                        "GEMEINDE_NAME": "Wiesbaden",
                        "BETREIBER_NAME": "HLNUG",
                        "MESSSTELLENART": "Brunnen",
                    },
                    "geometry": {"x": 8.24, "y": 50.08},
                },
            ]
        }
        body = json.dumps(sample_payload).encode("utf-8")
        municipalities = ["Bürstadt", "Lampertheim", "Biblis", "Groß-Rohrheim"]
        bbox = [49.54, 8.33, 49.75, 8.58]

        _now, stations, geojson = parse_hlnug_groundwater(body, municipalities=municipalities, bbox=bbox)

        self.assertEqual(len(stations), 2)
        self.assertEqual(stations[0]["id"], "hlnug-gw-17754")
        self.assertEqual(stations[0]["name"], "HOFHEIM")
        self.assertEqual(stations[0]["municipality"], "Lampertheim")
        self.assertEqual(stations[0]["lat"], 49.6534)
        self.assertEqual(stations[0]["lng"], 8.3881)
        self.assertEqual(stations[0]["operator"], "Regierungspräsidium Darmstadt")

        self.assertEqual(stations[1]["id"], "hlnug-gw-12890")
        self.assertEqual(stations[1]["name"], "BIBLIS (alt)")
        self.assertEqual(stations[1]["municipality"], "Biblis")

        self.assertEqual(geojson["type"], "FeatureCollection")
        self.assertEqual(len(geojson["features"]), 2)
        self.assertEqual(geojson["features"][0]["geometry"]["coordinates"], [8.3881, 49.6534])
        self.assertEqual(geojson["features"][0]["properties"]["id"], "hlnug-gw-17754")


if __name__ == "__main__":
    unittest.main()
