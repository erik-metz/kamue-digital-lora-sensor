"""Configuration for BNetzA EMF Collector."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    poll_seconds: int
    db: dict
    # Default bounding box covering the Ried area (Bürstadt, Lampertheim, Biblis, Bensheim, etc.)
    min_lat: float = 49.50
    max_lat: float = 49.80
    min_lon: float = 8.35
    max_lon: float = 8.70
    base_url: str = "https://www.bundesnetzagentur.de"

    @classmethod
    def from_env(cls) -> "Settings":
        poll_seconds = int(os.getenv("EMF_POLL_SECONDS", "86400"))  # Daily by default
        min_lat = float(os.getenv("EMF_MIN_LAT", "49.50"))
        max_lat = float(os.getenv("EMF_MAX_LAT", "49.80"))
        min_lon = float(os.getenv("EMF_MIN_LON", "8.35"))
        max_lon = float(os.getenv("EMF_MAX_LON", "8.70"))

        if not (-90.0 <= min_lat <= max_lat <= 90.0):
            raise ValueError("Latitude bounds must satisfy -90 <= min_lat <= max_lat <= 90")
        if not (-180.0 <= min_lon <= max_lon <= 180.0):
            raise ValueError("Longitude bounds must satisfy -180 <= min_lon <= max_lon <= 180")

        return cls(
            poll_seconds=poll_seconds,
            db={
                "host": os.getenv("DB_HOST", "localhost"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "postgres"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", "postgres"),
            },
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            base_url=os.getenv("EMF_BASE_URL", "https://www.bundesnetzagentur.de").rstrip("/"),
        )
