"""Bounded ECOSTRESS V003 native-grid land temperature crops (never air temperature)."""

import hashlib
import io
import json
import logging
import math
import re
from contextlib import ExitStack, asynccontextmanager
from pathlib import PurePosixPath
from urllib.parse import urlsplit

import httpx
import numpy as np
from rasterio.io import MemoryFile
from rasterio.warp import transform, transform_bounds
from rasterio.windows import Window, from_bounds

METHOD = "ecostress-v003-clear-land70-v1"
BBOX = (8.33, 49.54, 8.58, 49.75)
HOST = "data.lpdaac.earthdatacloud.nasa.gov"
LAYERS = ("LST", "QC", "cloud", "water")
MAX_BYTES = 32 * 1024 * 1024  # per input; four files, at most two scenes per run
MAX_PIXELS = 2_000_000


def asset_url(url, granule_id, layer):
    parts = urlsplit(url)
    expected = (
        f"/lp-prod-protected/ECO_L2T_LSTE.003/{granule_id}/{granule_id}_{layer}.tif"
    )
    if (
        parts.scheme != "https"
        or parts.netloc != HOST
        or parts.path != expected
        or parts.query
        or parts.fragment
        or PurePosixPath(parts.path).name == ""
    ):
        raise ValueError("Unsupported ECOSTRESS asset URL")
    return url


DOWNLOAD_HOST = "d1nklfio7vscoe.cloudfront.net"


class SignedDownloadLogFilter(logging.Filter):
    def filter(self, record):
        return DOWNLOAD_HOST not in record.getMessage()


# Signed URL query parameters are credentials too; never emit the HTTPX request log.
logging.getLogger("httpx").addFilter(SignedDownloadLogFilter())


@asynccontextmanager
async def raster_response(client, url, token):
    async with client.stream(
        "GET", url, headers={"Authorization": f"Bearer {token}"},
        follow_redirects=False, timeout=60,
    ) as response:
        if response.status_code != 303:
            yield response
            return
        location = response.headers.get("location", "")
        parts = urlsplit(location)
        suffix = urlsplit(url).path.removeprefix("/lp-prod-protected/")
        expected = r"/s3-[0-9a-f]{32}/lp-prod-protected\.s3\.us-west-2\.amazonaws\.com/" + re.escape(suffix)
        if (parts.scheme != "https" or parts.netloc != DOWNLOAD_HOST
                or parts.fragment or not parts.query
                or not re.fullmatch(expected, parts.path)):
            response.raise_for_status()
            raise ValueError("Unsupported NASA download redirect")
        # A fresh Request carries neither the Bearer token nor client cookies.
        request = httpx.Request("GET", location, extensions={
            "timeout": {k: 60 for k in ("connect", "read", "write", "pool")},
        })
        redirected = await client.send(request, stream=True, follow_redirects=False)
        try:
            yield redirected
        finally:
            await redirected.aclose()


async def download_assets(client, scene, token):
    """One pinned signed download hop; Bearer stays on the NASA data host."""
    if not token or "\n" in token or "\r" in token:
        raise ValueError("Earthdata token unavailable")
    files = {}
    for layer in LAYERS:
        url = asset_url(scene["assets"][layer], scene["granule_id"], layer)
        async with raster_response(client, url, token) as response:
            response.raise_for_status()
            if response.status_code != 200:
                raise ValueError("Unexpected raster response")
            length = response.headers.get("content-length")
            if length is not None and int(length) > MAX_BYTES:
                raise ValueError("Raster exceeds download budget")
            data = bytearray()
            async for chunk in response.aiter_bytes():
                if len(data) + len(chunk) > MAX_BYTES:
                    raise ValueError("Raster exceeds download budget")
                data.extend(chunk)
            if bytes(data[:4]) not in (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"):
                raise ValueError("Response is not a TIFF")
            files[layer] = bytes(data)
    return files


def temperature_calibration(src):
    # Packed HDF/SDS and unpacked COG must never accidentally share a multiplier.
    dtype = src.dtypes[0]
    scale, offset = float(src.scales[0]), float(src.offsets[0])
    if dtype == "uint16":
        if not math.isclose(scale, 0.02) or offset != 0:
            raise ValueError("Packed LST requires explicit scale 0.02 and offset 0")
    elif dtype == "float32":
        if scale != 1 or offset != 0:
            raise ValueError("Unsupported floating LST calibration")
    else:
        raise ValueError("Unsupported LST encoding")
    unit = (
        src.units[0] or src.tags(1).get("units") or src.tags().get("units") or "K"
    ).lower()
    if unit not in {"k", "kelvin"}:
        raise ValueError("LST must be in Kelvin")
    return {"dtype": dtype, "scale": scale, "offset": offset, "unit": "K"}


def read_crop(scene, files):
    if set(files) != set(LAYERS) or any(len(b) > MAX_BYTES for b in files.values()):
        raise ValueError("Invalid bounded raster input")
    with ExitStack() as stack:
        datasets = {
            key: stack.enter_context(stack.enter_context(MemoryFile(body)).open())
            for key, body in files.items()
        }
        src = datasets["LST"]
        if (
            str(src.crs) != "EPSG:32632"
            or src.count != 1
            or not all(math.isclose(v, 70, abs_tol=0.05) for v in src.res)
            or src.transform.a <= 0
            or src.transform.e >= 0
            or src.transform.b != 0
            or src.transform.d != 0
        ):
            raise ValueError("Expected north-up native 70 m EPSG:32632 grid")
        calibration = temperature_calibration(src)
        bounds = transform_bounds("EPSG:4326", src.crs, *BBOX, densify_pts=21)
        raw = from_bounds(*bounds, src.transform)
        window = Window(
            math.floor(raw.col_off),
            math.floor(raw.row_off),
            math.ceil(raw.col_off + raw.width) - math.floor(raw.col_off),
            math.ceil(raw.row_off + raw.height) - math.floor(raw.row_off),
        )
        try:
            window = window.intersection(Window(0, 0, src.width, src.height))
        except ValueError:
            raise ValueError("Scene does not overlap AOI") from None
        if window.width * window.height > MAX_PIXELS:
            raise ValueError("Raster exceeds pixel budget")
        arrays = {}
        masks = {}
        for key, ds in datasets.items():
            if (
                ds.count != 1
                or ds.crs != src.crs
                or ds.transform != src.transform
                or ds.shape != src.shape
            ):
                raise ValueError("Quality raster grid mismatch")
            if key == "QC" and ds.dtypes[0] != "uint16":
                raise ValueError("Expected uint16 QC bit flags")
            if key in {"cloud", "water"} and ds.dtypes[0] != "uint8":
                raise ValueError("Expected uint8 binary mask")
            arrays[key] = ds.read(1, window=window)
            # QC=0 is a legitimate bitfield; some SDS docs call it fill ambiguously.
            masks[key] = (
                ds.read_masks(1, window=window) > 0
                if key != "QC"
                else arrays[key] != 65535
            )
        grid = src.window_transform(window)
        rows, cols = np.indices(arrays["LST"].shape)
        xs = grid.c + (cols.ravel() + 0.5) * grid.a
        ys = grid.f + (rows.ravel() + 0.5) * grid.e
        lon, lat = transform(src.crs, "EPSG:4326", xs, ys)
        lon, lat = np.array(lon).reshape(rows.shape), np.array(lat).reshape(rows.shape)
        aoi = (lon >= BBOX[0]) & (lon <= BBOX[2]) & (lat >= BBOX[1]) & (lat <= BBOX[3])
        kelvin = (
            arrays["LST"].astype("float64") * calibration["scale"]
            + calibration["offset"]
        )
        qc = arrays["QC"]
        valid = (
            aoi
            & masks["LST"]
            & masks["QC"]
            & masks["cloud"]
            & masks["water"]
            & np.isfinite(kelvin)
            & (kelvin >= 150)
            & (kelvin <= 400)
            & ((qc & 3) == 0)
            & (((qc >> 2) & 3) == 0)
            & (((qc >> 14) & 3) >= 2)
            & (arrays["cloud"] == 0)
            & (arrays["water"] == 0)
        )
        celsius = np.where(valid, kelvin - 273.15, np.nan).astype("float32")
        selected = celsius[valid]
        stats = {
            "valid_pixels": int(valid.sum()),
            "aoi_pixels": int(aoi.sum()),
            "valid_fraction": float(valid.sum() / aoi.sum()) if aoi.any() else 0,
            "mean_celsius": float(selected.mean(dtype="float64"))
            if selected.size
            else None,
            "p10_celsius": float(np.percentile(selected, 10))
            if selected.size
            else None,
            "p90_celsius": float(np.percentile(selected, 90))
            if selected.size
            else None,
        }
        metadata = {
            "method": METHOD,
            "granule_id": scene["granule_id"],
            "acquired_at": scene["acquired_at"],
            "version": "003",
            "unit": "degC",
            "crs": str(src.crs),
            "transform": list(grid)[:6],
            "shape": list(rows.shape),
            "resolution_m": 70,
            "aoi_bbox": list(BBOX),
            "calibration": calibration,
            "quality_policy": "mandatory QA=0, data quality=0, LST accuracy bits>=2, cloud=0, water=0; 150..400 K",
            "input_sha256": {
                key: hashlib.sha256(body).hexdigest() for key, body in files.items()
            },
            "assets": scene["assets"],
            "stats": stats,
        }
        output = io.BytesIO()
        np.savez_compressed(
            output,
            lst_celsius=celsius,
            valid=valid,
            aoi=aoi,
            qc=qc,
            cloud=arrays["cloud"],
            water=arrays["water"],
            metadata=json.dumps(metadata, allow_nan=False, sort_keys=True),
        )
        body = output.getvalue()
        if len(body) > 40 * 1024 * 1024:
            raise ValueError("Crop exceeds archive budget")
        return stats, body, hashlib.sha256(body).hexdigest(), metadata
