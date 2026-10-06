"""Bounded, reproducible Sentinel-2 C1 L2A AOI indices on the native 20 m SCL grid."""

import hashlib
import io
import json
import math
from urllib.parse import urlsplit

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform, transform_bounds
from rasterio.windows import Window, from_bounds

METHOD = "sentinel-c1-scl20-v1"
BBOX = (8.33, 49.54, 8.58, 49.75)  # west, south, east, north; not municipal boundaries
BANDS = ("blue", "green", "red", "nir", "swir16")
HOST = "e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com"
MAX_PIXELS = 2_000_000


def asset_manifest(feature):
    if feature.get("collection") != "sentinel-2-c1-l2a":
        raise ValueError("Only Sentinel-2 C1 L2A is supported")
    result = {}
    for key in (*BANDS, "scl"):
        asset = feature["assets"][key]
        url = urlsplit(asset["href"])
        if (
            url.scheme != "https"
            or url.netloc != HOST
            or url.query
            or url.fragment
            or not url.path.startswith("/sentinel-2-c1-l2a/")
            or not url.path.endswith(".tif")
        ):
            raise ValueError("Unsupported raster asset URL")
        band = asset["raster:bands"][0]
        scale = float(band.get("scale", 1 if key == "scl" else math.nan))
        offset = float(band.get("offset", 0 if key == "scl" else math.nan))
        if not math.isfinite(scale) or not math.isfinite(offset) or scale <= 0:
            raise ValueError("Missing or invalid explicit reflectance calibration")
        result[key] = {
            "href": asset["href"],
            "scale": scale,
            "offset": offset,
            "nodata": band["nodata"],
            "provider_checksum": asset.get("file:checksum"),
        }
    return result


def summarize(arrays, manifest, aoi):
    """Indices are computed per clear pixel before spatial aggregation."""
    valid = aoi & np.isin(arrays["scl"], [4, 5, 6])
    reflectance = {}
    for band in BANDS:
        raw = arrays[band]
        valid &= np.isfinite(raw) & (raw != manifest[band]["nodata"])
        reflectance[band] = raw * manifest[band]["scale"] + manifest[band]["offset"]
    blue, green, red, nir, swir = (reflectance[b] for b in BANDS)
    expressions = {
        "ndvi": (nir - red, nir + red),
        "ndwi": (green - nir, green + nir),  # McFeeters; distinct from NDMI
        "ndmi": (nir - swir, nir + swir),
        "evi": (2.5 * (nir - red), nir + 6 * red - 7.5 * blue + 1),
        "savi": (1.5 * (nir - red), nir + red + 0.5),
    }
    stats = {}
    indices = {}
    for name, (num, den) in expressions.items():
        good = valid & (den > 1e-7)
        values = np.full(den.shape, np.nan, dtype="float32")
        np.divide(num, den, out=values, where=good)
        good &= np.isfinite(values)
        if name in ("ndvi", "ndwi", "ndmi"):
            good &= (values >= -1) & (values <= 1)
        values[~good] = np.nan
        selected = values[good]
        stats[name] = {
            "mean": float(selected.mean(dtype="float64")) if selected.size else None,
            "p10": float(np.percentile(selected, 10)) if selected.size else None,
            "p90": float(np.percentile(selected, 90)) if selected.size else None,
            "valid_pixels": int(selected.size),
        }
        indices[name] = values
    total = int(aoi.sum())
    return {
        "method": METHOD,
        "resolution_m": 20,
        "aoi_bbox": list(BBOX),
        "aoi_pixels": total,
        "clear_pixels": int(valid.sum()),
        "clear_fraction": float(valid.sum() / total) if total else 0,
        "scl_classes": {
            str(i): int((aoi & (arrays["scl"] == i)).sum()) for i in range(12)
        },
        "indices": stats,
    }, indices


def read_scene(feature, *, opener=rasterio.open):
    """Read only the Ried window. No thumbnail, global cover estimate or mosaicking."""
    manifest = asset_manifest(feature)
    arrays = {}
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_TIMEOUT="20",
        GDAL_HTTP_MAX_RETRY="1",
        GDAL_HTTP_RETRY_DELAY="1",
        GDAL_CACHEMAX=64 * 1024 * 1024,
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
    ):
        with opener(manifest["scl"]["href"]) as src:
            if (
                src.crs != rasterio.crs.CRS.from_epsg(32632)
                or src.count != 1
                or src.res != (20, 20)
            ):
                raise ValueError("Unexpected SCL grid; expected EPSG:32632 at 20 m")
            bounds = transform_bounds("EPSG:4326", src.crs, *BBOX, densify_pts=21)
            raw_window = from_bounds(*bounds, src.transform)
            window = Window(
                math.floor(raw_window.col_off),
                math.floor(raw_window.row_off),
                math.ceil(raw_window.col_off + raw_window.width)
                - math.floor(raw_window.col_off),
                math.ceil(raw_window.row_off + raw_window.height)
                - math.floor(raw_window.row_off),
            )
            try:
                window = window.intersection(Window(0, 0, src.width, src.height))
            except rasterio.errors.WindowError:
                raise ValueError("Scene does not overlap AOI") from None
            width, height = int(window.width), int(window.height)
            if width * height > MAX_PIXELS:
                raise ValueError("Raster window exceeds bounded pixel budget")
            grid = src.window_transform(window)
            crs = src.crs
            arrays["scl"] = src.read(1, window=window)
        rows, cols = np.indices((height, width))
        x = grid.c + (cols + 0.5) * grid.a
        y = grid.f + (rows + 0.5) * grid.e
        lon, lat = transform(crs, "EPSG:4326", x.ravel().tolist(), y.ravel().tolist())
        lon, lat = (
            np.array(lon).reshape(height, width),
            np.array(lat).reshape(height, width),
        )
        aoi = (lon >= BBOX[0]) & (lon <= BBOX[2]) & (lat >= BBOX[1]) & (lat <= BBOX[3])
        for band in BANDS:
            with opener(manifest[band]["href"]) as src:
                if (
                    src.crs != crs
                    or src.count != 1
                    or src.res not in ((10, 10), (20, 20))
                    or src.nodata != manifest[band]["nodata"]
                ):
                    raise ValueError("Unexpected spectral raster grid or nodata")
                with WarpedVRT(
                    src,
                    crs=crs,
                    transform=grid,
                    width=width,
                    height=height,
                    resampling=Resampling.average,
                    nodata=manifest[band]["nodata"],
                ) as vrt:
                    arrays[band] = vrt.read(1, out_dtype="float32")
    stats, indices = summarize(arrays, manifest, aoi)
    metadata = {
        "method": METHOD,
        "scene_id": feature["id"],
        "datetime": feature["properties"]["datetime"],
        "assets": manifest,
        "crs": str(crs),
        "transform": list(grid)[:6],
        "shape": [height, width],
        "bbox": list(BBOX),
        "resampling": "average spectral; native nearest SCL",
        "license": "Copernicus Sentinel data terms",
        "stac_feature": feature,
    }
    output = io.BytesIO()
    np.savez_compressed(
        output,
        **arrays,
        **indices,
        aoi=aoi,
        metadata=np.array(json.dumps(metadata, sort_keys=True, allow_nan=False)),
    )
    body = output.getvalue()
    if len(body) > 40 * 1024 * 1024:
        raise ValueError("Raster archive exceeds byte budget")
    return stats, body, hashlib.sha256(body).hexdigest(), metadata
