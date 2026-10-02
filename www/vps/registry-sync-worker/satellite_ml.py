"""Machine Learning Dataset & Feature Pipeline for Copernicus Sentinel-2 EO Data.

Provides standard dataset loaders and feature extraction for PyTorch and Scikit-Learn
drought classification, soil moisture estimation, and vegetative health prediction
over the Hessisches Ried.

Adheres strictly to the Three-Table Core Schema (entities, measurement_definitions, readings).
"""

from __future__ import annotations

import math
from typing import Any


def compute_spectral_indices(
    b02_blue: float,
    b03_green: float,
    b04_red: float,
    b08_nir: float,
    b11_swir: float | None = None,
) -> dict[str, float]:
    """Compute standard Earth Observation vegetative and moisture indices.

    Reflectance inputs are expected in range [0.0 .. 1.0] (or Sentinel L2A BOA / 10000.0).
    """
    eps = 1e-7

    # Normalized Difference Vegetation Index (NDVI)
    ndvi = (b08_nir - b04_red) / (b08_nir + b04_red + eps)
    ndvi = max(-1.0, min(1.0, ndvi))

    # Normalized Difference Water Index (NDWI - Gao 1996 / McFeeters 1996)
    ndwi = (b03_green - b08_nir) / (b03_green + b08_nir + eps)
    ndwi = max(-1.0, min(1.0, ndwi))

    # Enhanced Vegetation Index (EVI)
    evi_denom = b08_nir + 6.0 * b04_red - 7.5 * b02_blue + 1.0
    evi = 2.5 * (b08_nir - b04_red) / (evi_denom + eps)
    evi = max(-1.0, min(2.5, evi))

    # Soil-Adjusted Vegetation Index (SAVI, L=0.5)
    savi = 1.5 * (b08_nir - b04_red) / (b08_nir + b04_red + 0.5 + eps)
    savi = max(-1.0, min(1.5, savi))

    indices: dict[str, float] = {
        "ndvi": round(ndvi, 4),
        "ndwi": round(ndwi, 4),
        "evi": round(evi, 4),
        "savi": round(savi, 4),
    }

    # Normalized Difference Moisture Index (NDMI - Gao 1996)
    if b11_swir is not None:
        ndmi = (b08_nir - b11_swir) / (b08_nir + b11_swir + eps)
        indices["ndmi"] = round(max(-1.0, min(1.0, ndmi)), 4)
    else:
        indices["ndmi"] = 0.0

    return indices


def classify_drought_stress(ndvi: float, moisture_index: float | None = None) -> dict[str, Any]:
    """Classify drought stress level into multi-class and binary targets."""
    if ndvi < 0.25 or (moisture_index is not None and moisture_index < -0.15):
        return {
            "class_id": 2,
            "label": "severe_drought",
            "is_stressed": 1,
            "severity": "high",
            "description": "Schwerer Trockenstress / Dürreschaden / Vegetationsausfall",
        }
    if ndvi < 0.45 or (moisture_index is not None and moisture_index < 0.05):
        return {
            "class_id": 1,
            "label": "moderate_drought",
            "is_stressed": 1,
            "severity": "medium",
            "description": "Moderater Trockenstress / verminderte Biomasseaktivität",
        }
    return {
        "class_id": 0,
        "label": "healthy_vegetation",
        "is_stressed": 0,
        "severity": "none",
        "description": "Vitale Vegetation / normale Wasserversorgung",
    }


FEATURE_NAMES = [
    "ndvi",
    "ndwi",
    "evi",
    "savi",
    "ndmi",
    "cloud_cover",
    "groundwater_level",
    "rain_30d",
    "solar_radiation",
]


class RiedEarthObservationDataset:
    """Standard Machine Learning Dataset for Earth Observation & Drought Monitoring.

    Compatible with both Scikit-Learn (X, y matrices) and PyTorch (torch.utils.data.Dataset).
    """

    def __init__(self, samples: list[dict[str, Any]]) -> None:
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        item = self.samples[idx]
        features = [float(item.get(name, 0.0)) for name in FEATURE_NAMES]
        target = int(item.get("target_class", 0))
        regression_target = float(item.get("target_moisture", item.get("ndvi", 0.0)))
        return {
            "features": features,
            "target": target,
            "regression_target": regression_target,
            "scene_id": item.get("scene_id", f"sample_{idx}"),
            "date": item.get("date", ""),
        }

    def to_scikit_learn(self) -> tuple[list[list[float]], list[int], list[str]]:
        """Export dataset as (X, y, feature_names) for Scikit-Learn / XGBoost."""
        X: list[list[float]] = []
        y: list[int] = []
        for sample in self.samples:
            row = [float(sample.get(name, 0.0)) for name in FEATURE_NAMES]
            X.append(row)
            y.append(int(sample.get("target_class", 0)))
        return X, y, list(FEATURE_NAMES)

    def train_val_test_split(
        self,
        test_size: float = 0.2,
        val_size: float = 0.1,
        random_seed: int = 42,
    ) -> tuple[RiedEarthObservationDataset, RiedEarthObservationDataset, RiedEarthObservationDataset]:
        """Split dataset reproducibly into train, validation, and test subsets."""
        n = len(self.samples)
        if n < 3:
            return self, self, self

        indices = list(range(n))
        # Simple deterministic pseudo-random permutation
        def pseudo_shuffle(arr: list[int], seed: int) -> list[int]:
            res = list(arr)
            for i in range(len(res) - 1, 0, -1):
                j = (seed * (i + 1) * 1103515245 + 12345) % (i + 1)
                res[i], res[j] = res[j], res[i]
            return res

        shuffled = pseudo_shuffle(indices, random_seed)
        n_test = max(1, int(n * test_size))
        n_val = max(1, int(n * val_size))
        n_train = n - n_test - n_val

        train_idx = shuffled[:n_train]
        val_idx = shuffled[n_train : n_train + n_val]
        test_idx = shuffled[n_train + n_val :]

        train_set = RiedEarthObservationDataset([self.samples[i] for i in train_idx])
        val_set = RiedEarthObservationDataset([self.samples[i] for i in val_idx])
        test_set = RiedEarthObservationDataset([self.samples[i] for i in test_idx])

        return train_set, val_set, test_set


def build_ml_sample(
    scene_id: str,
    date: str,
    b02_blue: float,
    b03_green: float,
    b04_red: float,
    b08_nir: float,
    b11_swir: float | None = None,
    cloud_cover: float = 0.0,
    groundwater_level: float = 87.0,
    rain_30d: float = 40.0,
    solar_radiation: float = 200.0,
) -> dict[str, Any]:
    """Build a single machine learning sample dictionary."""
    indices = compute_spectral_indices(b02_blue, b03_green, b04_red, b08_nir, b11_swir)
    drought_class = classify_drought_stress(indices["ndvi"], indices.get("ndmi"))

    sample: dict[str, Any] = {
        "scene_id": scene_id,
        "date": date,
        **indices,
        "cloud_cover": round(cloud_cover, 2),
        "groundwater_level": round(groundwater_level, 2),
        "rain_30d": round(rain_30d, 2),
        "solar_radiation": round(solar_radiation, 2),
        "target_class": drought_class["class_id"],
        "target_label": drought_class["label"],
        "is_stressed": drought_class["is_stressed"],
        "target_moisture": indices.get("ndmi", 0.0),
    }
    return sample


async def extract_samples_from_three_table_db(conn: Any, limit: int = 500) -> list[dict[str, Any]]:
    """Extract training samples from Three-Table database (entities and readings)."""
    cursor = await conn.execute(
        """SELECT e.id, e.name, e.metadata,
                  COALESCE((SELECT r.value FROM readings r 
                            JOIN measurement_definitions m ON r.definition_id = m.id 
                            WHERE r.entity_id = e.id AND m.metric = 'ndvi_mean' 
                            ORDER BY r.observed_at DESC LIMIT 1), 0.45) as ndvi_mean,
                  COALESCE((SELECT r.value FROM readings r 
                            JOIN measurement_definitions m ON r.definition_id = m.id 
                            WHERE r.entity_id = e.id AND m.metric = 'cloud_cover' 
                            ORDER BY r.observed_at DESC LIMIT 1), 5.0) as cloud_cover,
                  COALESCE((SELECT r.value FROM readings r 
                            JOIN measurement_definitions m ON r.definition_id = m.id 
                            WHERE m.metric = 'groundwater_level' 
                            ORDER BY r.observed_at DESC LIMIT 1), 87.2) as gw_level
           FROM entities e
           WHERE e.entity_type = 'satellite_scene'
           ORDER BY e.created_at DESC
           LIMIT %s""",
        (limit,),
    )
    rows = await cursor.fetchall()

    samples: list[dict[str, Any]] = []
    for r in rows:
        meta = r.get("metadata", {})
        date_str = meta.get("date", "2026-06-15")
        ndvi = float(r.get("ndvi_mean") or 0.45)
        cloud = float(r.get("cloud_cover") or 5.0)
        gw = float(r.get("gw_level") or 87.2)

        # Reconstruct approximate BOA bands around the mean NDVI
        b04_red = 0.08
        b08_nir = (b04_red * (1.0 + ndvi)) / max(0.01, (1.0 - ndvi))
        b02_blue = 0.05
        b03_green = 0.07
        b11_swir = 0.12

        sample = build_ml_sample(
            scene_id=r["id"],
            date=date_str,
            b02_blue=b02_blue,
            b03_green=b03_green,
            b04_red=b04_red,
            b08_nir=b08_nir,
            b11_swir=b11_swir,
            cloud_cover=cloud,
            groundwater_level=gw,
            rain_30d=45.0,
            solar_radiation=220.0,
        )
        samples.append(sample)

    return samples
