"""Environment configuration; importing this module has no side effects."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit
from uuid import UUID

from normalize import METRICS


def csv(value):
    return frozenset(part.strip() for part in value.split(",") if part.strip())


@dataclass(frozen=True)
class Settings:
    tenant: str
    dashboard_url: str
    poll_seconds: int
    entity_ids: frozenset[str]
    metrics: frozenset[str]
    state_dir: str
    db: dict

    @classmethod
    def from_env(cls):
        base = os.getenv(
            "SMARTCITY_BASE_URL", "https://dashboard-service.smartcity-system.de"
        ).rstrip("/")
        parsed = urlsplit(base)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                "SMARTCITY_BASE_URL must be an HTTPS base URL without credentials/query"
            )
        dashboard = str(
            UUID(
                os.getenv(
                    "SMARTCITY_DASHBOARD_ID", "76a90123-ba53-4d77-be9f-f11ef90dd63a"
                )
            )
        )
        interval = int(os.getenv("SMARTCITY_POLL_SECONDS", "60"))
        if not 30 <= interval <= 86400:
            raise ValueError("SMARTCITY_POLL_SECONDS must be between 30 and 86400")
        metrics = csv(os.getenv("SMARTCITY_METRICS", ""))
        known = {m.name for group in METRICS.values() for m in group.values()}
        if metrics - known:
            raise ValueError(
                "Unknown SMARTCITY_METRICS: " + ", ".join(sorted(metrics - known))
            )
        tenant = os.getenv("SMARTCITY_TENANT", "buerstadt").strip()
        if not tenant or len(tenant) > 64:
            raise ValueError("SMARTCITY_TENANT must contain 1–64 characters")
        return cls(
            tenant,
            f"{base}/dashboards/{dashboard}?includeContent=true",
            interval,
            csv(os.getenv("SMARTCITY_ENTITY_IDS", "")),
            metrics,
            os.getenv("SMARTCITY_STATE_DIR", "/data"),
            {
                "host": os.getenv("DB_HOST", "timescaledb"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "dbname": os.getenv("DB_NAME", "mydatabase"),
                "user": os.getenv("DB_USER", "postgres"),
                "password": os.getenv("DB_PASSWORD", ""),
                "connect_timeout": 10,
            },
        )
