"""Temperature tiles rendered only from verified archived native ECOSTRESS crops."""

import io
import json
import math
import threading
import zipfile

import numpy as np
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_bounds
from rasterio.warp import reproject

METHOD = "ecostress-v003-clear-land70-v1"
LOCK = threading.Lock()


def render_temperature_tile(body, z, x, y):
    if not 0 <= z <= 19 or not 0 <= x < 2**z or not 0 <= y < 2**z:
        raise ValueError("Invalid tile coordinates")
    if len(body) > 40 * 1024 * 1024:
        raise ValueError("Oversized crop")
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 40 * 1024 * 1024:
            raise ValueError("Oversized expanded crop")
    with np.load(io.BytesIO(body), allow_pickle=False) as archive:
        meta = json.loads(str(archive["metadata"]))
        shape = meta["shape"]
        if (meta["method"] != METHOD or meta["crs"] != "EPSG:32632"
                or meta["unit"] != "degC" or len(shape) != 2
                or not all(isinstance(v, int) and v > 0 for v in shape)
                or math.prod(shape) > 2_000_000
                or len(meta["transform"]) != 6
                or not all(math.isfinite(v) for v in meta["transform"])):
            raise ValueError("Invalid temperature crop")
        values, valid = archive["lst_celsius"], archive["valid"]
        if list(values.shape) != shape or valid.shape != values.shape or valid.dtype != np.bool_:
            raise ValueError("Invalid pixel masks")
        valid = valid & np.isfinite(values)
        rgba = np.zeros((*shape, 4), dtype="uint8")
        palette = np.array([[49, 54, 149], [69, 117, 180], [255, 255, 191], [244, 109, 67], [165, 0, 38]])
        for channel in range(3):
            rgba[:, :, channel] = np.interp(np.nan_to_num(values), [-10, 0, 20, 40, 60], palette[:, channel]).astype("uint8")
        rgba[:, :, 3] = valid.astype("uint8") * 255
        rgba[~valid, :3] = 0
    half = 20037508.342789244
    span = 2 * half / 2**z
    grid = from_bounds(-half + x * span, half - (y + 1) * span,
                       -half + (x + 1) * span, half - y * span, 256, 256)
    output = np.zeros((4, 256, 256), dtype="uint8")
    # GDAL rendering is serialized, just as in the existing Sentinel renderer.
    with LOCK:
        for channel in range(4):
            reproject(rgba[:, :, channel], output[channel],
                      src_transform=Affine(*meta["transform"]), src_crs=meta["crs"],
                      dst_transform=grid, dst_crs="EPSG:3857", resampling=Resampling.nearest)
    stream = io.BytesIO()
    Image.fromarray(np.moveaxis(output, 0, -1)).save(stream, format="PNG")
    return stream.getvalue()
