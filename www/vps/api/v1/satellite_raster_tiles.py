"""Render genuine archived Sentinel crops; no network access or unrelated imagery."""

import io
import json
import math
import threading
from functools import lru_cache

import numpy as np
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_bounds
from rasterio.warp import reproject

METHOD = "sentinel-c1-scl20-v1"
_RENDER_LOCK = threading.Lock()


def load_crop(body):
    if len(body) > 40 * 1024 * 1024:
        raise ValueError("Oversized raster archive")
    with np.load(io.BytesIO(body), allow_pickle=False) as archive:
        meta = json.loads(str(archive["metadata"]))
        if (
            meta["method"] != METHOD
            or meta["crs"] != "EPSG:32632"
            or math.prod(meta["shape"]) > 2_000_000
        ):
            raise ValueError("Invalid raster archive contract")
        keys = ("red", "green", "blue", "scl", "aoi", "ndvi")
        arrays = {key: archive[key] for key in keys}
        if any(list(a.shape) != meta["shape"] for a in arrays.values()):
            raise ValueError("Raster archive shape mismatch")
    return arrays, meta


@lru_cache(maxsize=2)
def rgba_crop(body, layer):
    arrays, meta = load_crop(body)
    valid = arrays["aoi"] & np.isin(arrays["scl"], [4, 5, 6])
    rgba = np.zeros((*meta["shape"], 4), dtype="uint8")
    if layer == "ndvi":
        values = arrays["ndvi"]
        valid &= np.isfinite(values)
        palette = np.array(
            [
                [33, 102, 172],
                [191, 129, 45],
                [246, 232, 195],
                [128, 205, 193],
                [1, 102, 94],
            ]
        )
        breaks = np.array([-1, 0, 0.25, 0.6, 1])
        for i in range(3):
            rgba[:, :, i] = np.interp(
                np.nan_to_num(values), breaks, palette[:, i]
            ).astype("uint8")
    else:
        for i, key in enumerate(("red", "green", "blue")):
            asset = meta["assets"][key]
            valid &= np.isfinite(arrays[key]) & (arrays[key] != asset["nodata"])
            value = arrays[key] * asset["scale"] + asset["offset"]
            rgba[:, :, i] = (np.sqrt(np.clip(value / 0.3, 0, 1)) * 255).astype("uint8")
    rgba[:, :, 3] = valid.astype("uint8") * 255
    rgba[~valid, :3] = 0
    return rgba, meta


def png_bytes(rgba):
    output = io.BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    return output.getvalue()


def _render_tile(body, layer, z, x, y):
    if not 0 <= z <= 19 or not 0 <= x < 2**z or not 0 <= y < 2**z:
        raise ValueError("Invalid tile coordinates")
    crop, meta = rgba_crop(body, layer)
    half = 20037508.342789244
    span = 2 * half / 2**z
    grid = from_bounds(
        -half + x * span,
        half - (y + 1) * span,
        -half + (x + 1) * span,
        half - y * span,
        256,
        256,
    )
    output = np.zeros((4, 256, 256), dtype="uint8")
    for i in range(4):
        reproject(
            crop[:, :, i],
            output[i],
            src_transform=Affine(*meta["transform"]),
            src_crs=meta["crs"],
            dst_transform=grid,
            dst_crs="EPSG:3857",
            resampling=Resampling.nearest,
        )
    return png_bytes(np.moveaxis(output, 0, -1))


def render_preview(body, layer):
    with _RENDER_LOCK:
        crop, _ = rgba_crop(body, layer)
        return png_bytes(crop)


def render_tile(body, layer, z, x, y):
    # Bound simultaneous decoded crops per API process; cache only two layer variants.
    with _RENDER_LOCK:
        return _render_tile(body, layer, z, x, y)
