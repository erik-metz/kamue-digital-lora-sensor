"""Configuration settings for the traffic collector daemon."""

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="postgres", alias="DB_NAME")
    db_user: str = Field(default="postgres", alias="DB_USER")
    db_password: str = Field(default="postgres", alias="DB_PASSWORD")

    poll_seconds: int = Field(default=180, alias="TRAFFIC_POLL_SECONDS")
    health_file: Path = Field(default=Path("/data/health.json"), alias="TRAFFIC_HEALTH_FILE")

    autobahn_api_base: str = Field(
        default="https://verkehr.autobahn.de/oapi/v1",
        alias="AUTOBAHN_API_BASE",
    )
    roads: list[str] = Field(
        default=["A67", "A5", "A6"],
        alias="TRAFFIC_ROADS",
    )

    # Geographic bounding box for the Hessian Ried region
    # Bürstadt: 49.64, 8.46; Lampertheim: 49.59, 8.47; Darmstadt: 49.87; Mannheim: 49.48
    min_lat: float = 49.45
    max_lat: float = 49.90
    min_lon: float = 8.25
    max_lon: float = 8.75

    @property
    def db_url(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
