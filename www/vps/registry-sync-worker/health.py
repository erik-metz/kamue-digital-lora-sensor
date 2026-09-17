"""Health and status tracking contract for registry-sync-worker."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

LOG = logging.getLogger(__name__)


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(data, default=str, ensure_ascii=False), encoding="utf-8"
    )
    temporary.replace(path)


def read_status(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def record_job_status(path, job_name, *, success=True, rows_ingested=0, error=None, details=None):
    now = datetime.now(UTC).isoformat()
    previous = read_status(path)
    jobs = previous.get("jobs", {})

    jobs[job_name] = {
        "last_run": now,
        "status": "success" if success else "failed",
        "rows_ingested": rows_ingested,
        "error": str(error) if error else None,
        **(details or {}),
    }

    status = {
        "last_heartbeat": now,
        "overall_status": "healthy" if all(j.get("status") == "success" for j in jobs.values()) else "degraded",
        "jobs": jobs,
    }

    try:
        write_json(path, status)
    except OSError:
        LOG.exception("Health status file write failed")
    return status
