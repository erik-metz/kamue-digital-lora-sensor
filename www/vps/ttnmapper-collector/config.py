"""Validated environment configuration for ttnmapper-collector."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    poll_seconds: int
    state_dir: str
    db: dict
    packetbroker_api_url: str = "https://mapper.packetbroker.net/api/v2/gateways"
    center_lat: float = 49.64
    center_lon: float = 8.53
    radius_meters: int = 25000
    min_lat: float = 49.45
    max_lat: float = 49.90
    min_lon: float = 8.25
    max_lon: float = 8.75

    @classmethod
    def from_env(cls):
        interval = int(os.getenv("TTNMAPPER_POLL_SECONDS", "3600"))
        if not 30 <= interval <= 86400:
            raise ValueError("TTNMAPPER_POLL_SECONDS must be between 30 and 86400")

        base_str = os.getenv(
            "TTNMAPPER_API_URL", "https://mapper.packetbroker.net/api/v2/gateways"
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
                "TTNMAPPER_API_URL must be a valid HTTP/HTTPS URL without credentials/query"
            )

        center_lat = float(os.getenv("TTNMAPPER_CENTER_LAT", "49.64"))
        center_lon = float(os.getenv("TTNMAPPER_CENTER_LON", "8.53"))
        radius_meters = int(os.getenv("TTNMAPPER_RADIUS_METERS", "25000"))

        min_lat = float(os.getenv("TTNMAPPER_MIN_LAT", "49.45"))
        max_lat = float(os.getenv("TTNMAPPER_MAX_LAT", "49.90"))
        min_lon = float(os.getenv("TTNMAPPER_MIN_LON", "8.25"))
        max_lon = float(os.getenv("TTNMAPPER_MAX_LON", "8.75"))

        if not (-90.0 <= min_lat <= max_lat <= 90.0):
            raise ValueError("Latitude bounds must satisfy -90 <= min_lat <= max_lat <= 90")
        if not (-180.0 <= min_lon <= max_lon <= 180.0):
            raise ValueError("Longitude bounds must satisfy -180 <= min_lon <= max_lon <= 180")
        if not (-90.0 <= center_lat <= 90.0) or not (-180.0 <= center_lon <= 180.0):
            raise ValueError("Center coordinate must be valid WGS84")
        if radius_meters <= 0:
            raise ValueError("Radius must be positive")

        return cls(
            poll_seconds=interval,
            state_dir=os.getenv("TTNMAPPER_STATE_DIR", "/data"),
            db={
                "host": os.getenv("DB_HOST", "localhost"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "postgres"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", "postgres"),
            },
            packetbroker_api_url=base_str,
            center_lat=center_lat,
            center_lon=center_lon,
            radius_meters=radius_meters,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
        )
