"""Regional Tankerkönig configuration; credentials never appear in repr."""
import math
import os
from dataclasses import dataclass, field
from uuid import UUID


@dataclass(frozen=True)
class Settings:
    api_key: str = field(repr=False)
    latitude: float
    longitude: float
    radius: float
    poll_seconds: int
    state_dir: str
    db: dict = field(repr=False)

    @classmethod
    def from_env(cls):
        key = os.getenv("TANKERKOENIG_API_KEY", "").strip()
        try:
            UUID(key)
        except ValueError:
            raise ValueError("TANKERKOENIG_API_KEY must be a UUID") from None
        lat = float(os.getenv("FUEL_LATITUDE", "49.62"))
        lng = float(os.getenv("FUEL_LONGITUDE", "8.46"))
        radius = float(os.getenv("FUEL_RADIUS_KM", "25"))
        interval = int(os.getenv("FUEL_POLL_SECONDS", "300"))
        if not all(math.isfinite(v) for v in (lat, lng, radius)) or not (-90 <= lat <= 90 and -180 <= lng <= 180 and 0 < radius <= 25):
            raise ValueError("Invalid fuel search region (radius must be <=25 km)")
        if not 60 <= interval <= 3600:
            raise ValueError("FUEL_POLL_SECONDS must be between 60 and 3600")
        return cls(key, lat, lng, radius, interval, os.getenv("FUEL_STATE_DIR", "/data"), {
            "host": os.getenv("DB_HOST", "timescaledb"), "port": int(os.getenv("DB_PORT", "5432")),
            "dbname": os.getenv("DB_NAME", "mydatabase"), "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD", ""), "connect_timeout": 10,
        })
