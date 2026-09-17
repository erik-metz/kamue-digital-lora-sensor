"""Database storage operations and sync audit logging."""

import json
import logging
from datetime import UTC, datetime
from typing import Any

try:
    import psycopg
except ImportError:
    psycopg = None

LOG = logging.getLogger(__name__)


async def record_sync_log(
    conn: Any,
    job_name: str,
    status: str,
    started_at: datetime,
    finished_at: datetime | None = None,
    rows_ingested: int = 0,
    rows_updated: int = 0,
    source_url: str | None = None,
    error_message: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> int:
    """Records an audit log entry in collector_sync_logs."""
    meta_json = json.dumps(metadata or {})
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO collector_sync_logs (
                job_name, status, started_at, finished_at,
                rows_ingested, rows_updated, source_url, error_message, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING id
            """,
            (
                job_name,
                status,
                started_at,
                finished_at or datetime.now(UTC),
                rows_ingested,
                rows_updated,
                source_url,
                error_message,
                meta_json,
            ),
        )
        row = await cur.fetchone()
        await conn.commit()
        return row[0] if row else 0
