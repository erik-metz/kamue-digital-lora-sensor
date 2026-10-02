"""Unit tests for Copernicus Sentinel-2 satellite scene adapter."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from satellite import parse_satellite_scenes


class SatelliteAdapterTests(unittest.TestCase):
    def test_parse_satellite_scenes_filters_and_extracts_assets(self):
        sample_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "S2C_T32UMA_20260930T103323_L2A",
                    "properties": {
                        "datetime": "2026-09-30T10:37:04.163000Z",
                        "platform": "sentinel-2c",
                        "eo:cloud_cover": 16.2,
                        "s2:vegetation_percentage": 52.8,
                        "s2:water_percentage": 0.8,
                        "mgrs:grid_square": "UMA",
                        "proj:centroid": {"lat": 49.6425, "lon": 8.4552},
                    },
                    "assets": {
                        "visual": {
                            "href": "https://example.org/sentinel2/TCI.tif",
                            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                        },
                        "red": {
                            "href": "https://example.org/sentinel2/B04.tif",
                            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                        },
                        "nir": {
                            "href": "https://example.org/sentinel2/B08.tif",
                            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                        },
                        "thumbnail": {
                            "href": "https://example.org/sentinel2/preview.jpg",
                            "type": "image/jpeg",
                        },
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [8.30, 49.50],
                                [8.60, 49.50],
                                [8.60, 49.80],
                                [8.30, 49.80],
                                [8.30, 49.50],
                            ]
                        ],
                    },
                },
                {
                    # Too cloudy (should be filtered out by max_cloud_cover=20.0)
                    "type": "Feature",
                    "id": "S2C_T32UMA_20260920T103323_L2A",
                    "properties": {
                        "datetime": "2026-09-20T10:37:04.163000Z",
                        "platform": "sentinel-2c",
                        "eo:cloud_cover": 85.0,
                        "s2:vegetation_percentage": 20.0,
                        "mgrs:grid_square": "UMA",
                    },
                    "assets": {
                        "visual": {"href": "https://example.org/sentinel2/cloudy.tif"}
                    },
                },
            ],
        }

        body = json.dumps(sample_payload).encode("utf-8")
        _now, scenes, geojson, summary = parse_satellite_scenes(body, max_cloud_cover=20.0)

        self.assertEqual(len(scenes), 1)

        s = scenes[0]
        self.assertEqual(s["id"], "satellite-scene-s2c-t32uma-20260930t103323-l2a")
        self.assertEqual(s["date"], "2026-09-30")
        self.assertEqual(s["cloudCoverPercent"], 16.2)
        self.assertEqual(s["vegetationPercent"], 52.8)
        self.assertEqual(s["gridSquare"], "UMA")
        self.assertEqual(s["lat"], 49.6425)
        self.assertEqual(s["lng"], 8.4552)
        self.assertEqual(s["assets"]["visualCog"], "https://example.org/sentinel2/TCI.tif")
        self.assertEqual(s["assets"]["redCog"], "https://example.org/sentinel2/B04.tif")
        self.assertEqual(s["assets"]["nirCog"], "https://example.org/sentinel2/B08.tif")
        self.assertEqual(s["assets"]["thumbnailUrl"], "https://example.org/sentinel2/preview.jpg")

        # GeoJSON FeatureCollection
        self.assertEqual(geojson["type"], "FeatureCollection")
        self.assertEqual(len(geojson["features"]), 1)
        self.assertEqual(geojson["features"][0]["properties"]["cloudCover"], 16.2)

        # Summary
        self.assertEqual(summary["total_scenes"], 1)
        self.assertEqual(summary["latest_scene_date"], "2026-09-30")
        self.assertEqual(summary["latest_scene_cloud_cover"], 16.2)
        self.assertEqual(summary["latest_scene_vegetation"], 52.8)


if __name__ == "__main__":
    unittest.main()
