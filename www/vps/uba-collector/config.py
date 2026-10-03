"""Validated environment configuration for uba-collector."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    poll_seconds: int
    state_dir: str
    db: dict
    uba_api_base: str = "https://luftdaten.umweltbundesamt.de/api/air-data/v4"
    min_lat: float = 49.40
    max_lat: float = 50.05
    min_lon: float = 8.25
    max_lon: float = 8.85

    @classmethod
    def from_env(cls):
        interval = int(os.getenv("UBA_POLL_SECONDS", "1800"))
        if not 30 <= interval <= 86400:
            raise ValueError("UBA_POLL_SECONDS must be between 30 and 86400")

        base_str = os.getenv(
            "UBA_API_BASE", "https://luftdaten.umweltbundesamt.de/api/air-data/v4"
        ).rstrip("/")
        url = urlsplit(base_str)
        if (
            url.scheme not in ("http", "https")
            or not url.netloc
            or url.username
            or url.query
            or url.fragment
        ):
            raise ValueError(
                "UBA_API_BASE must be a valid HTTP/HTTPS URL without credentials/query"
            )

        raw_bbox = os.getenv("UBA_BBOX")
        if raw_bbox:
            parts = [float(p.strip()) for p in raw_bbox.split(",")]
            if len(parts) != 4:
                raise ValueError("UBA_BBOX must contain min_lon,min_lat,max_lon,max_lat")
            min_lon, min_lat, max_lon, max_lat = parts
        else:
            min_lat = float(os.getenv("UBA_MIN_LAT", "49.40"))
            max_lat = float(os.getenv("UBA_MAX_LAT", "50.05"))
            min_lon = float(os.getenv("UBA_MIN_LON", "8.25"))
            max_lon = float(os.getenv("UBA_MAX_LON", "8.85"))

        if not (-90.0 <= min_lat <= max_lat <= 90.0):
            raise ValueError("Latitude bounds must satisfy -90 <= min_lat <= max_lat <= 90")
        if not (-180.0 <= min_lon <= max_lon <= 180.0):
            raise ValueError("Longitude bounds must satisfy -180 <= min_lon <= max_lon <= 180")

        return cls(
            poll_seconds=interval,
            state_dir=os.getenv("UBA_STATE_DIR", "/data"),
            db={
                "host": os.getenv("DB_HOST", "timescaledb"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "mydatabase"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
            uba_api_base=base_str,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
        )
