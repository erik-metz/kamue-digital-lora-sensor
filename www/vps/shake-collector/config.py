"""Validated settings; legacy Compose aliases remain supported."""

import math
import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit


def env(name, default, legacy=None):
    return os.getenv(name, os.getenv(legacy, default) if legacy else default)


def boolean(value):
    if value.lower() not in ("true", "false", "1", "0", "yes", "no"):
        raise ValueError("Expected a boolean setting")
    return value.lower() in ("true", "1", "yes")


@dataclass(frozen=True)
class Settings:
    SHAKE_STATIONS: str
    SHAKE_NETWORK: str
    SHAKE_WS_URL: str
    SHAKE_FDSN_URL: str
    INGEST_MODE: str
    API_URL: str
    API_KEY: str
    ADMIN_API_KEY: str
    db: dict
    SAMPLING_INTERVAL_SEC: float
    STORE_RAW_WAVEFORM: bool
    RAW_DECIMATION_FACTOR: int
    RECONNECT_DELAY_SEC: float
    MAX_RECONNECT_DELAY_SEC: float
    state_dir: str
    queue_batches: int
    shutdown_seconds: int
    lateness_seconds: float

    @classmethod
    def from_env(cls):
        settings = cls(
            env(
                "SHAKE_STATIONS",
                "R498E,R82E7,R79F9,RB012,R021A,R5DFB,RC017,R2852,RB8D1,SC342",
            ),
            env("SHAKE_NETWORK", "AM"),
            env(
                "SHAKE_WS_URL",
                "wss://swarm:ujHsN9qbYiTAx69H@data.raspberryshake.org/caps/",
            ),
            env("SHAKE_FDSN_URL", "https://data.raspberryshake.org/fdsnws"),
            env("SHAKE_INGEST_MODE", "direct_db", "INGEST_MODE"),
            env("SHAKE_API_URL", "http://backend-api:8080/api/v1", "API_URL"),
            env("API_KEY", ""),
            env("ADMIN_API_KEY", ""),
            {
                "host": env("DB_HOST", "timescaledb"),
                "port": int(env("DB_PORT", "5432")),
                "dbname": env("DB_NAME", "mydatabase"),
                "user": env("DB_USER", "postgres"),
                "password": env("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
            float(env("SHAKE_SAMPLING_INTERVAL_SEC", "5", "SAMPLING_INTERVAL_SEC")),
            boolean(env("SHAKE_STORE_RAW_WAVEFORM", "false", "STORE_RAW_WAVEFORM")),
            int(env("SHAKE_RAW_DECIMATION_FACTOR", "10", "RAW_DECIMATION_FACTOR")),
            float(env("SHAKE_RECONNECT_DELAY_SEC", "5", "RECONNECT_DELAY_SEC")),
            float(
                env("SHAKE_MAX_RECONNECT_DELAY_SEC", "60", "MAX_RECONNECT_DELAY_SEC")
            ),
            env("SHAKE_STATE_DIR", "/data"),
            int(env("SHAKE_QUEUE_BATCHES", "120")),
            int(env("SHAKE_SHUTDOWN_SECONDS", "20")),
            float(env("SHAKE_LATENESS_SECONDS", "2")),
        )
        if settings.INGEST_MODE not in ("api", "direct_db"):
            raise ValueError("SHAKE_INGEST_MODE must be api or direct_db")
        if (
            not 1 <= settings.SAMPLING_INTERVAL_SEC <= 60
            or settings.RAW_DECIMATION_FACTOR < 1
        ):
            raise ValueError("Invalid Shake window or decimation")
        if (
            not 1 <= settings.queue_batches <= 1000
            or not 1 <= settings.shutdown_seconds <= 45
        ):
            raise ValueError("Invalid Shake queue/shutdown bounds")
        if not 0 <= settings.lateness_seconds <= 30:
            raise ValueError("Invalid Shake lateness")
        if not (
            math.isfinite(settings.RECONNECT_DELAY_SEC)
            and math.isfinite(settings.MAX_RECONNECT_DELAY_SEC)
            and 0
            < settings.RECONNECT_DELAY_SEC
            <= settings.MAX_RECONNECT_DELAY_SEC
            <= 3600
        ):
            raise ValueError("Invalid Shake retry bounds")
        if urlsplit(settings.SHAKE_WS_URL).scheme != "wss":
            raise ValueError("SHAKE_WS_URL must use wss")
        station_settings_list(settings)
        return settings


class StationSettings:
    def __init__(self, base, code):
        self.base = base
        self.SHAKE_STATION = code
        self.SHAKE_LOCATION = "00"
        self.SHAKE_CHANNEL = "EHZ"
        self.SENSOR_ID = f"shake-{code.lower()}"
        self.SENSOR_NAME = f"Raspberry Shake {code}"
        self.SENSOR_DESCRIPTION = f"Raspberry Shake {code}, vertical geophone"
        self.LATITUDE = None
        self.LONGITUDE = None

    def __getattr__(self, name):
        return getattr(self.base, name)

    @property
    def channel_identifier(self):
        return f"{self.SHAKE_NETWORK}.{self.SHAKE_STATION}.{self.SHAKE_LOCATION}.{self.SHAKE_CHANNEL}"


def station_settings_list(base):
    codes = list(
        dict.fromkeys(
            code.strip().upper()
            for code in base.SHAKE_STATIONS.split(",")
            if code.strip()
        )
    )
    if not codes or any(not re.fullmatch(r"[A-Z0-9]{5}", code) for code in codes):
        raise ValueError("SHAKE_STATIONS requires five-character station codes")
    return [StationSettings(base, code) for code in codes]
