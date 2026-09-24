"""Configuration for the Environment Collector."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db: dict[str, str | int]
    poll_seconds: int = 300
    state_dir: Path = Path("/data")
    pegelonline_url: str = "https://pegelonline.wsv.de/webservices/rest-api/v2/stations/WORMS.json?includeTimeseries=true&includeCurrentMeasurement=true"
    weather_url: str = "https://api.open-meteo.com/v1/dwd-icon?latitude=49.6425&longitude=8.4552&current=temperature_2m,relative_humidity_2m,precipitation&timezone=UTC"
    request_timeout: float = 30.0

    @classmethod
    def from_env(cls) -> "Settings":
        db = {
            "host": os.getenv("DB_HOST", "timescaledb"),
            "port": int(os.getenv("DB_PORT", "5432")),
            "dbname": os.getenv("DB_NAME", "mydatabase"),
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD", ""),
            "connect_timeout": 10,
        }
        poll_seconds = int(os.getenv("ENVIRONMENT_POLL_SECONDS", "300"))
        state_dir = Path(os.getenv("ENVIRONMENT_STATE_DIR", "/data"))
        return cls(
            db=db,
            poll_seconds=poll_seconds,
            state_dir=state_dir,
            pegelonline_url=os.getenv(
                "PEGELONLINE_URL",
                "https://pegelonline.wsv.de/webservices/rest-api/v2/stations/WORMS.json?includeTimeseries=true&includeCurrentMeasurement=true",
            ),
            weather_url=os.getenv(
                "WEATHER_URL",
                "https://api.open-meteo.com/v1/dwd-icon?latitude=49.6425&longitude=8.4552&current=temperature_2m,relative_humidity_2m,precipitation&timezone=UTC",
            ),
        )
