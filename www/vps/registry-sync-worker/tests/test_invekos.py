"""Unit tests for Hessen INVEKOS agricultural parcels adapter."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from invekos import parse_invekos_parcels


class InvekosAdapterTests(unittest.TestCase):
    def test_parse_invekos_parcels_filters_and_structures(self):
        sample_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "Landwirtschaftliche Parzellen 2025.1",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [8.4500, 49.6400],
                                [8.4520, 49.6400],
                                [8.4520, 49.6420],
                                [8.4500, 49.6420],
                                [8.4500, 49.6400],
                            ]
                        ],
                    },
                    "properties": {
                        "id": "DE.HE.AP.DEHELI0000891234",
                        "declaredArea": 2.45,
                        "declaredArea_uom": "ha",
                        "mainCrop": "GT",
                        "mainCrop_txt": "Getreide",
                        "organicFarming": False,
                        "validFrom": "01.01.2025",
                        "validTo": "31.12.2025",
                    },
                },
                {
                    "type": "Feature",
                    "id": "Landwirtschaftliche Parzellen 2025.2",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [8.4600, 49.6500],
                                [8.4630, 49.6500],
                                [8.4630, 49.6530],
                                [8.4600, 49.6530],
                                [8.4600, 49.6500],
                            ]
                        ],
                    },
                    "properties": {
                        "id": "DE.HE.AP.DEHELI0000895678",
                        "declaredArea": 3.12,
                        "declaredArea_uom": "ha",
                        "mainCrop": "GL",
                        "mainCrop_txt": "Dauergrünland",
                        "organicFarming": True,
                        "validFrom": "01.01.2025",
                        "validTo": "31.12.2025",
                    },
                },
                {
                    # Outside bounding box (e.g. Kassel / north Hessen)
                    "type": "Feature",
                    "id": "Landwirtschaftliche Parzellen 2025.99",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [9.5000, 51.3100],
                                [9.5050, 51.3100],
                                [9.5050, 51.3150],
                                [9.5000, 51.3150],
                                [9.5000, 51.3100],
                            ]
                        ],
                    },
                    "properties": {
                        "id": "DE.HE.AP.DEHELI0000999999",
                        "declaredArea": 5.0,
                        "mainCrop": "GT",
                        "mainCrop_txt": "Getreide",
                    },
                },
            ],
        }

        body = json.dumps(sample_payload).encode("utf-8")
        bbox = [49.54, 8.33, 49.75, 8.58]

        _now, parcels, geojson, summary = parse_invekos_parcels(body, bbox=bbox)

        self.assertEqual(len(parcels), 2)

        p1 = parcels[0]
        self.assertEqual(p1["id"], "invekos-de-he-ap-deheli0000891234")
        self.assertEqual(p1["flik"], "DE.HE.AP.DEHELI0000891234")
        self.assertEqual(p1["cropCode"], "GT")
        self.assertEqual(p1["cropName"], "Getreide")
        self.assertEqual(p1["areaHa"], 2.45)
        self.assertAlmostEqual(p1["lat"], 49.6408, places=3)
        self.assertAlmostEqual(p1["lng"], 8.4508, places=3)
        self.assertFalse(p1["organicFarming"])

        p2 = parcels[1]
        self.assertEqual(p2["id"], "invekos-de-he-ap-deheli0000895678")
        self.assertEqual(p2["cropName"], "Dauergrünland")
        self.assertTrue(p2["organicFarming"])

        # GeoJSON validation
        self.assertEqual(geojson["type"], "FeatureCollection")
        self.assertEqual(len(geojson["features"]), 2)
        self.assertEqual(
            geojson["features"][0]["properties"]["id"],
            "invekos-de-he-ap-deheli0000891234",
        )
        self.assertEqual(
            geojson["features"][0]["properties"]["cropName"], "Getreide"
        )

        # Summary statistics
        self.assertEqual(summary["total_parcels"], 2)
        self.assertAlmostEqual(summary["total_area_ha"], 5.57, places=2)
        self.assertEqual(summary["crop_counts"]["Getreide"], 1)
        self.assertEqual(summary["crop_counts"]["Dauergrünland"], 1)
        self.assertEqual(summary["organic_count"], 1)


if __name__ == "__main__":
    unittest.main()
