"""OMM/SGP4 propagation; geodetic coordinates in WGS84, UTC throughout."""
import hashlib
import json
import math
from datetime import UTC, datetime, timedelta
from functools import lru_cache

from sgp4 import omm
from sgp4.api import Satrec, jday

MAX_ELEMENT_AGE = timedelta(days=10)

def utc(value):
    stamp = datetime.fromisoformat(str(value))
    return stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)

def element(raw):
    return _element(json.dumps(raw, sort_keys=True, separators=(",", ":")))

@lru_cache(maxsize=32768)
def _element(serialized):
    raw = json.loads(serialized)
    data = dict(raw)
    norad = int(data["NORAD_CAT_ID"])
    if not 1 <= norad <= 999999999:
        raise ValueError("Invalid NORAD identifier")
    for field in ("MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT"):
        if not math.isfinite(float(data[field])):
            raise ValueError("Non-finite orbital element")
    if not 0 < float(data["MEAN_MOTION"]) <= 20 or not 0 <= float(data["INCLINATION"]) <= 180:
        raise ValueError("Invalid orbit")
    epoch = utc(data["EPOCH"])
    # Space-Track GP JSON uses OMM fields, without the OMM header defaults.
    data.setdefault("CENTER_NAME", "EARTH")
    data.setdefault("REF_FRAME", "TEME")
    data.setdefault("TIME_SYSTEM", "UTC")
    data.setdefault("MEAN_ELEMENT_THEORY", "SGP4")
    if any(data[key] != expected for key, expected in (
        ("CENTER_NAME", "EARTH"), ("REF_FRAME", "TEME"),
        ("TIME_SYSTEM", "UTC"), ("MEAN_ELEMENT_THEORY", "SGP4"))):
        raise ValueError("Unsupported OMM frame or model")
    data["EPOCH"] = epoch.replace(tzinfo=None).isoformat()
    sat = Satrec()
    omm.initialize(sat, data)
    if not 0 < sat.no_kozai or not 0 <= sat.ecco < 1:
        raise ValueError("Invalid orbit")
    version = hashlib.sha256(json.dumps(raw, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return norad, epoch, sat, version

def position(raw, at):
    norad, epoch, sat, version = element(raw)
    return propagated_position((norad, epoch, sat, version), at)

def propagated_position(elements, at):
    norad, epoch, sat, version = elements
    if at < epoch or at - epoch > MAX_ELEMENT_AGE:
        return None
    jd, fraction = jday(at.year, at.month, at.day, at.hour, at.minute, at.second + at.microsecond / 1e6)
    error, r, v = sat.sgp4(jd, fraction)
    if error or not all(math.isfinite(n) for n in (*r, *v)):
        return None
    # TEME -> Earth fixed via Greenwich mean sidereal time (no polar motion).
    t = (jd + fraction - 2451545.0) / 36525
    theta = math.radians((280.46061837 + 360.98564736629 * (jd + fraction - 2451545.0)
                          + .000387933 * t*t - t*t*t / 38710000) % 360)
    x = r[0] * math.cos(theta) + r[1] * math.sin(theta)
    y = -r[0] * math.sin(theta) + r[1] * math.cos(theta)
    z = r[2]
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - 0.00669437999014))
    for _ in range(8):
        n = 6378.137 / math.sqrt(1 - 0.00669437999014 * math.sin(lat)**2)
        lat = math.atan2(z + 0.00669437999014 * n * math.sin(lat), p)
    n = 6378.137 / math.sqrt(1 - 0.00669437999014 * math.sin(lat)**2)
    height = p * math.cos(lat) + z * math.sin(lat) - n * (1 - 0.00669437999014 * math.sin(lat)**2)
    if height < 0:
        return None
    return {"norad_id": norad, "latitude": math.degrees(lat),
            "longitude": math.degrees(math.atan2(y, x)), "altitude_km": height,
            "speed_km_s": math.sqrt(sum(n*n for n in v)), "timestamp": at.isoformat(),
            "element_epoch": epoch.isoformat(), "element_age_seconds": (at-epoch).total_seconds(),
            "element_version": version, "basis": "model", "source": "space-track"}

# Same geographic bounds as the existing Ried map, inclusive at the border.
RIED_BOUNDS = (49.45, 8.15, 49.90, 8.80)

def in_ried(sample):
    return (sample is not None and RIED_BOUNDS[0] <= sample["latitude"] <= RIED_BOUNDS[2]
            and RIED_BOUNDS[1] <= sample["longitude"] <= RIED_BOUNDS[3])

def regional_position(elements, at):
    """Cheap TEME latitude/longitude gate before iterative WGS84 projection."""
    _, epoch, sat, _ = elements
    if at < epoch or at - epoch > MAX_ELEMENT_AGE:
        return None
    jd, fraction = jday(at.year, at.month, at.day, at.hour, at.minute, at.second + at.microsecond / 1e6)
    error, r, _ = sat.sgp4(jd, fraction)
    if error:
        return None
    latitude = math.degrees(math.atan2(r[2], math.hypot(r[0], r[1])))
    if not RIED_BOUNDS[0] - 0.3 <= latitude <= RIED_BOUNDS[2] + 0.3:
        return None
    t = (jd + fraction - 2451545.0) / 36525
    theta = (280.46061837 + 360.98564736629 * (jd + fraction - 2451545.0)
             + .000387933*t*t - t*t*t/38710000) % 360
    longitude = (math.degrees(math.atan2(r[1], r[0])) - theta + 180) % 360 - 180
    if not RIED_BOUNDS[1] <= longitude <= RIED_BOUNDS[3]:
        return None
    sample = propagated_position(elements, at)
    return sample if in_ried(sample) else None
