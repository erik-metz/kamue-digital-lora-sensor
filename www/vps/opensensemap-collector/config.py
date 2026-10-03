"""Validated environment configuration for opensensemap-collector."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    poll_seconds: int
    state_dir: str
    db: dict
    opensensemap_url: str = "https://api.opensensemap.org/boxes"
    min_lat: float = 49.40
    max_lat: float = 50.00
    min_lon: float = 8.25
    max_lon: float = 8.80

    @classmethod
    def from_env(cls):
        interval = int(os.getenv("OPENSENSEMAP_POLL_SECONDS", "300"))
        if not 30 <= interval <= 86400:
            raise ValueError("OPENSENSEMAP_POLL_SECONDS must be between 30 and 86400")

        url_str = os.getenv("OPENSENSEMAP_URL", "https://api.opensensemap.org/boxes")
        url = urlsplit(url_str)
        if (
            url.scheme not in ("http", "https")
            or not url.netloc
            or url.username
            or url.query
            or url.fragment
        ):
            raise ValueError(
                "OPENSENSEMAP_URL must be a valid HTTP/HTTPS URL without credentials/query"
            )

        # Allow setting bbox as "min_lon,min_lat,max_lon,max_lat" or separately
        raw_bbox = os.getenv("OPENSENSEMAP_BBOX")
        if raw_bbox:
            parts = [float(p.strip()) for p in raw_bbox.split(",")]
            if len(parts) != 4:
                raise ValueError("OPENSENSEMAP_BBOX must contain min_lon,min_lat,max_lon,max_lat")
            min_lon, min_lat, max_lon, max_lat = parts
        else:
            min_lat = float(os.getenv("OPENSENSEMAP_MIN_LAT", "49.40"))
            max_lat = float(os.getenv("OPENSENSEMAP_MAX_LAT", "50.00"))
            min_lon = float(os.getenv("OPENSENSEMAP_MIN_LON", "8.25"))
            max_lon = float(os.getenv("OPENSENSEMAP_MAX_LON", "8.80"))

        if not (-90.0 <= min_lat <= max_lat <= 90.0):
            raise ValueError("Latitude bounds must satisfy -90 <= min_lat <= max_lat <= 90")
        if not (-180.0 <= min_lon <= max_lon <= 180.0):
            raise ValueError("Longitude bounds must satisfy -180 <= min_lon <= max_lon <= 180")

        return cls(
            poll_seconds=interval,
            state_dir=os.getenv("OPENSENSEMAP_STATE_DIR", "/data"),
            db={
                "host": os.getenv("DB_HOST", "timescaledb"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "mydatabase"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
            opensensemap_url=url_str,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
        )
