"""Validated environment configuration for rast-collector."""

import json
import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    roads: tuple[str, ...]
    poll_seconds: int
    state_dir: str
    db: dict
    rast_monitor_url: str = "https://rast-monitor.de/api/sites"
    min_lat: float = 49.40
    max_lat: float = 50.00
    min_lon: float = 8.25
    max_lon: float = 8.80

    @classmethod
    def from_env(cls):
        raw = os.getenv("RAST_ROADS", "A67,A5,A6,A659,A61")
        values = json.loads(raw) if raw.lstrip().startswith("[") else raw.split(",")
        if (
            not isinstance(values, list)
            or not values
            or any(
                not isinstance(v, str)
                or not re.fullmatch(r"A[0-9]{1,3}", v.strip().upper())
                for v in values
            )
        ):
            raise ValueError("RAST_ROADS must contain Autobahn IDs (e.g. A67,A5,A6)")
        roads = tuple(dict.fromkeys(v.strip().upper() for v in values))
        interval = int(os.getenv("RAST_POLL_SECONDS", "900"))
        if not 30 <= interval <= 86400:
            raise ValueError("RAST_POLL_SECONDS must be between 30 and 86400")
        url_str = os.getenv("RAST_MONITOR_URL", "https://rast-monitor.de/api/sites")
        url = urlsplit(url_str)
        if (
            url.scheme not in ("http", "https")
            or not url.netloc
            or url.username
            or url.query
            or url.fragment
        ):
            raise ValueError(
                "RAST_MONITOR_URL must be a valid HTTP/HTTPS URL without credentials/query"
            )
        min_lat = float(os.getenv("RAST_MIN_LAT", "49.40"))
        max_lat = float(os.getenv("RAST_MAX_LAT", "50.00"))
        min_lon = float(os.getenv("RAST_MIN_LON", "8.25"))
        max_lon = float(os.getenv("RAST_MAX_LON", "8.80"))

        return cls(
            roads=roads,
            poll_seconds=interval,
            state_dir=os.getenv("RAST_STATE_DIR", "/data"),
            db={
                "host": os.getenv("DB_HOST", "timescaledb"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "mydatabase"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
            rast_monitor_url=url_str,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
        )
