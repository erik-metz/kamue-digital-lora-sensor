"""Configuration settings for the Raspberry Shake Telemetry Collector."""

import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        # Raspberry Shake station settings
        SHAKE_NETWORK: str = "AM"
        SHAKE_STATION: str = "R498E"
        SHAKE_LOCATION: str = "00"
        SHAKE_CHANNEL: str = "EHZ"
        SHAKE_WS_URL: str = "wss://swarm:ujHsN9qbYiTAx69H@data.raspberryshake.org/caps/"
        SHAKE_FDSN_URL: str = "https://data.raspberryshake.org/fdsnws"

        # Station metadata in Open Ried Sens
        SENSOR_ID: str = "shake-r498e"
        SENSOR_NAME: str = "Station 5: Bürstadt Seismometer (Raspberry Shake R498E)"
        SENSOR_DESCRIPTION: str = "Raspberry Shake 1D Seismograph (Vertical Geophone Channel EHZ, Bürstadt/Bobstadt)"
        LATITUDE: float = 49.65766
        LONGITUDE: float = 8.43426

        # Ingestion destination: "api" (recommended) or "direct_db"
        INGEST_MODE: str = "api"
        API_URL: str = "http://backend-api:8080/api/v1"
        API_KEY: str = ""
        ADMIN_API_KEY: str = ""

        # Direct TimescaleDB settings (used if INGEST_MODE=direct_db)
        DB_HOST: str = "timescaledb"
        DB_PORT: int = 5432
        DB_NAME: str = "mydatabase"
        DB_USER: str = "postgres"
        DB_PASSWORD: str = ""

        # Metric & windowing settings
        SAMPLING_INTERVAL_SEC: float = 5.0
        STORE_RAW_WAVEFORM: bool = False
        RAW_DECIMATION_FACTOR: int = 10  # e.g., if 100 Hz, 10 decimation = 10 Hz

        # Connection retry settings
        RECONNECT_DELAY_SEC: float = 5.0
        MAX_RECONNECT_DELAY_SEC: float = 60.0

        model_config = SettingsConfigDict(
            env_file=".env",
            extra="ignore",
        )

        @property
        def channel_identifier(self) -> str:
            return f"{self.SHAKE_NETWORK}.{self.SHAKE_STATION}.{self.SHAKE_LOCATION}.{self.SHAKE_CHANNEL}"

except ImportError:
    class Settings:  # type: ignore[no-redef]
        def __init__(self, **kwargs):
            self.SHAKE_NETWORK = kwargs.get("SHAKE_NETWORK", os.getenv("SHAKE_NETWORK", "AM"))
            self.SHAKE_STATION = kwargs.get("SHAKE_STATION", os.getenv("SHAKE_STATION", "R498E"))
            self.SHAKE_LOCATION = kwargs.get("SHAKE_LOCATION", os.getenv("SHAKE_LOCATION", "00"))
            self.SHAKE_CHANNEL = kwargs.get("SHAKE_CHANNEL", os.getenv("SHAKE_CHANNEL", "EHZ"))
            self.SHAKE_WS_URL = kwargs.get("SHAKE_WS_URL", os.getenv("SHAKE_WS_URL", "wss://swarm:ujHsN9qbYiTAx69H@data.raspberryshake.org/caps/"))
            self.SHAKE_FDSN_URL = kwargs.get("SHAKE_FDSN_URL", os.getenv("SHAKE_FDSN_URL", "https://data.raspberryshake.org/fdsnws"))

            self.SENSOR_ID = kwargs.get("SENSOR_ID", os.getenv("SHAKE_SENSOR_ID", "shake-r498e"))
            self.SENSOR_NAME = kwargs.get("SENSOR_NAME", os.getenv("SHAKE_SENSOR_NAME", "Station 5: Bürstadt Seismometer (Raspberry Shake R498E)"))
            self.SENSOR_DESCRIPTION = kwargs.get("SENSOR_DESCRIPTION", os.getenv("SHAKE_SENSOR_DESCRIPTION", "Raspberry Shake 1D Seismograph (Vertical Geophone Channel EHZ, Bürstadt/Bobstadt)"))
            self.LATITUDE = float(kwargs.get("LATITUDE", os.getenv("SHAKE_LATITUDE", "49.65766")))
            self.LONGITUDE = float(kwargs.get("LONGITUDE", os.getenv("SHAKE_LONGITUDE", "8.43426")))

            self.INGEST_MODE = kwargs.get("INGEST_MODE", os.getenv("SHAKE_INGEST_MODE", "api"))
            self.API_URL = kwargs.get("API_URL", os.getenv("API_URL", "http://backend-api:8080/api/v1"))
            self.API_KEY = kwargs.get("API_KEY", os.getenv("API_KEY", ""))
            self.ADMIN_API_KEY = kwargs.get("ADMIN_API_KEY", os.getenv("ADMIN_API_KEY", ""))

            self.DB_HOST = kwargs.get("DB_HOST", os.getenv("DB_HOST", "timescaledb"))
            self.DB_PORT = int(kwargs.get("DB_PORT", os.getenv("DB_PORT", "5432")))
            self.DB_NAME = kwargs.get("DB_NAME", os.getenv("DB_NAME", "mydatabase"))
            self.DB_USER = kwargs.get("DB_USER", os.getenv("DB_USER", "postgres"))
            self.DB_PASSWORD = kwargs.get("DB_PASSWORD", os.getenv("DB_PASSWORD", ""))

            self.SAMPLING_INTERVAL_SEC = float(kwargs.get("SAMPLING_INTERVAL_SEC", os.getenv("SHAKE_SAMPLING_INTERVAL_SEC", "5.0")))
            self.STORE_RAW_WAVEFORM = kwargs.get("STORE_RAW_WAVEFORM", os.getenv("SHAKE_STORE_RAW_WAVEFORM", "false")).lower() in ("true", "1", "yes")
            self.RAW_DECIMATION_FACTOR = int(kwargs.get("RAW_DECIMATION_FACTOR", os.getenv("SHAKE_RAW_DECIMATION_FACTOR", "10")))

            self.RECONNECT_DELAY_SEC = float(kwargs.get("RECONNECT_DELAY_SEC", "5.0"))
            self.MAX_RECONNECT_DELAY_SEC = float(kwargs.get("MAX_RECONNECT_DELAY_SEC", "60.0"))

        @property
        def channel_identifier(self) -> str:
            return f"{self.SHAKE_NETWORK}.{self.SHAKE_STATION}.{self.SHAKE_LOCATION}.{self.SHAKE_CHANNEL}"


settings = Settings()
