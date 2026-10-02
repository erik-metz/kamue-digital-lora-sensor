import unittest
from unittest.mock import AsyncMock, MagicMock

from satellite_ml import (
    FEATURE_NAMES,
    RiedEarthObservationDataset,
    build_ml_sample,
    classify_drought_stress,
    compute_spectral_indices,
    extract_samples_from_three_table_db,
)


class SatelliteMlTests(unittest.TestCase):
    def test_compute_spectral_indices(self):
        # b02=0.05, b03=0.08, b04=0.07, b08=0.45, b11=0.15
        indices = compute_spectral_indices(
            b02_blue=0.05,
            b03_green=0.08,
            b04_red=0.07,
            b08_nir=0.45,
            b11_swir=0.15,
        )
        self.assertIn("ndvi", indices)
        self.assertIn("ndwi", indices)
        self.assertIn("evi", indices)
        self.assertIn("savi", indices)
        self.assertIn("ndmi", indices)

        # Expected NDVI: (0.45 - 0.07) / (0.45 + 0.07) = 0.38 / 0.52 = 0.7308
        self.assertAlmostEqual(indices["ndvi"], 0.7308, places=2)
        # Expected NDMI: (0.45 - 0.15) / (0.45 + 0.15) = 0.30 / 0.60 = 0.50
        self.assertAlmostEqual(indices["ndmi"], 0.50, places=2)

    def test_classify_drought_stress(self):
        healthy = classify_drought_stress(0.65)
        self.assertEqual(healthy["class_id"], 0)
        self.assertEqual(healthy["severity"], "none")
        self.assertEqual(healthy["is_stressed"], 0)

        moderate = classify_drought_stress(0.35)
        self.assertEqual(moderate["class_id"], 1)
        self.assertEqual(moderate["severity"], "medium")
        self.assertEqual(moderate["is_stressed"], 1)

        severe = classify_drought_stress(0.18)
        self.assertEqual(severe["class_id"], 2)
        self.assertEqual(severe["severity"], "high")
        self.assertEqual(severe["is_stressed"], 1)

    def test_build_ml_sample(self):
        sample = build_ml_sample(
            scene_id="test-scene-2026",
            date="2026-06-15",
            b02_blue=0.04,
            b03_green=0.07,
            b04_red=0.06,
            b08_nir=0.42,
            b11_swir=0.18,
            cloud_cover=2.5,
            groundwater_level=87.4,
            rain_30d=55.0,
        )
        self.assertEqual(sample["scene_id"], "test-scene-2026")
        self.assertEqual(sample["date"], "2026-06-15")
        self.assertEqual(sample["target_class"], 0)
        self.assertGreater(sample["ndvi"], 0.5)

    def test_dataset_and_scikit_learn_export(self):
        samples = [
            build_ml_sample(f"scene-{i}", "2026-06-15", 0.04, 0.07, 0.06, 0.2 + i * 0.05, 0.15)
            for i in range(10)
        ]
        dataset = RiedEarthObservationDataset(samples)
        self.assertEqual(len(dataset), 10)

        item = dataset[0]
        self.assertIn("features", item)
        self.assertEqual(len(item["features"]), len(FEATURE_NAMES))
        self.assertIn("target", item)

        X, y, names = dataset.to_scikit_learn()
        self.assertEqual(len(X), 10)
        self.assertEqual(len(y), 10)
        self.assertEqual(names, FEATURE_NAMES)

        train, val, test = dataset.train_val_test_split(test_size=0.2, val_size=0.2)
        self.assertEqual(len(train) + len(val) + len(test), 10)
        self.assertGreater(len(train), 0)
        self.assertGreater(len(val), 0)
        self.assertGreater(len(test), 0)


class DatabaseExtractionTests(unittest.IsolatedAsyncioTestCase):
    async def test_extract_samples_from_three_table_db(self):
        conn = MagicMock()
        cursor = MagicMock()
        cursor.fetchall = AsyncMock(
            return_value=[
                {
                    "id": "satellite-scene-sentinel2-20260615",
                    "name": "Sentinel-2 Szene 2026-06-15",
                    "metadata": {"date": "2026-06-15"},
                    "ndvi_mean": 0.52,
                    "cloud_cover": 2.1,
                    "gw_level": 87.5,
                }
            ]
        )
        conn.execute = AsyncMock(return_value=cursor)

        samples = await extract_samples_from_three_table_db(conn, limit=10)
        self.assertEqual(len(samples), 1)
        self.assertEqual(samples[0]["scene_id"], "satellite-scene-sentinel2-20260615")
        self.assertAlmostEqual(samples[0]["ndvi"], 0.52, places=1)


if __name__ == "__main__":
    unittest.main()
