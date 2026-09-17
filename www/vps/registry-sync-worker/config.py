"""Configuration settings for registry-sync-worker."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db: dict[str, str | int]
    state_dir: Path
    timezone: str = "Europe/Berlin"
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
        raw_state_dir = os.getenv("SYNC_STATE_DIR")
        if raw_state_dir:
            state_dir = Path(raw_state_dir)
        elif Path("/data").exists() and os.access("/data", os.W_OK):
            state_dir = Path("/data")
        else:
            state_dir = Path(__file__).resolve().parent / "state"
        timezone = os.getenv("SYNC_TIMEZONE", "Europe/Berlin")
        timeout = float(os.getenv("SYNC_REQUEST_TIMEOUT", "30.0"))
        return cls(
            db=db,
            state_dir=state_dir,
            timezone=timezone,
            request_timeout=timeout,
        )
