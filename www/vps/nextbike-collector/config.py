"""Configuration for Nextbike collector service."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


def parse_city_ids(raw: str) -> set[int]:
    """Parse comma-separated city IDs into a set of integers."""
    if raw.strip().lower() == "all":
        return set()
    values = raw.split(",")
    if any(not value.strip().isdigit() or int(value) <= 0 for value in values):
        raise ValueError("NEXTBIKE_CITY_IDS requires positive IDs, or explicit 'all'")
    return {int(value) for value in values}


@dataclass(frozen=True)
class Settings:
    base_url: str
    city_ids: frozenset[int]
    poll_seconds: int
    state_dir: str
    db: dict

    @property
    def api_url(self) -> str:
        """Construct the URL with city parameter if cities are specified."""
        if len(self.city_ids) == 1:
            city_id = next(iter(self.city_ids))
            return f"{self.base_url}?city={city_id}"
        elif len(self.city_ids) > 1:
            # Multi-city query
            city_param = ",".join(str(cid) for cid in sorted(self.city_ids))
            return f"{self.base_url}?city={city_param}"
        return self.base_url

    @classmethod
    def from_env(cls) -> "Settings":
        base_url = os.getenv(
            "NEXTBIKE_BASE_URL", "https://maps.nextbike.net/maps/nextbike-live.json"
        ).strip()
        parsed = urlsplit(base_url)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("NEXTBIKE_BASE_URL must be a valid HTTP/HTTPS URL")

        raw_cities = os.getenv("NEXTBIKE_CITY_IDS", "559")  # 559 is Lampertheim
        city_ids = frozenset(parse_city_ids(raw_cities))

        poll_seconds = int(os.getenv("NEXTBIKE_POLL_SECONDS", "60"))
        if not 10 <= poll_seconds <= 3600:
            raise ValueError("NEXTBIKE_POLL_SECONDS must be between 10 and 3600")

        state_dir = os.getenv("NEXTBIKE_STATE_DIR", "/data")

        db = {
            "host": os.getenv("DB_HOST", "timescaledb"),
            "port": int(os.getenv("DB_PORT", "5432")),
            "dbname": os.getenv("DB_NAME", "mydatabase"),
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD", ""),
            "connect_timeout": 10,
        }

        return cls(
            base_url=base_url,
            city_ids=city_ids,
            poll_seconds=poll_seconds,
            state_dir=state_dir,
            db=db,
        )
