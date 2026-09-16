"""Validated environment configuration with no import-time side effects."""

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
    autobahn_api_base: str = "https://verkehr.autobahn.de/oapi/v1"
    min_lat: float = 49.45
    max_lat: float = 49.90
    min_lon: float = 8.25
    max_lon: float = 8.75

    @classmethod
    def from_env(cls):
        raw = os.getenv("TRAFFIC_ROADS", "A67,A5,A6")
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
            raise ValueError("TRAFFIC_ROADS must contain Autobahn IDs (e.g. A67,A5,A6)")
        roads = tuple(dict.fromkeys(v.strip().upper() for v in values))
        interval = int(os.getenv("TRAFFIC_POLL_SECONDS", "180"))
        if not 30 <= interval <= 86400:
            raise ValueError("TRAFFIC_POLL_SECONDS must be between 30 and 86400")
        base = os.getenv(
            "AUTOBAHN_API_BASE", "https://verkehr.autobahn.de/oapi/v1"
        ).rstrip("/")
        url = urlsplit(base)
        if (
            url.scheme != "https"
            or not url.netloc
            or url.username
            or url.query
            or url.fragment
        ):
            raise ValueError(
                "AUTOBAHN_API_BASE must be an HTTPS URL without credentials/query"
            )
        return cls(
            roads,
            interval,
            os.getenv("TRAFFIC_STATE_DIR", "/data"),
            {
                "host": os.getenv("DB_HOST", "timescaledb"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "mydatabase"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
            base,
        )
