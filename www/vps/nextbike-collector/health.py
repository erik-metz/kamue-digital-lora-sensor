"""Local collector status contract; writes never change a committed batch outcome."""

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
        data = json.loads(Path(path).read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def record_status(path, previous, *, error=None, details=None):
    now = datetime.now(UTC).isoformat()
    status = {**previous, "last_attempt": now}
    if error is None:
        status.update(
            status="healthy",
            last_success=now,
            consecutive_failures=0,
            error_category=None,
            **(details or {}),
        )
    else:
        status.update(
            status="degraded",
            consecutive_failures=previous.get("consecutive_failures", 0) + 1,
            error_category=type(error).__name__,
        )
    try:
        write_json(path, status)
    except OSError:
        LOG.exception("Status file write failed; database outcome is unchanged")
    return status


def check_health(path, poll_seconds, source_max_age=None):
    data = read_status(path)
    try:
        success = datetime.fromisoformat(data["last_success"])
        age = (datetime.now(UTC) - success).total_seconds()
        if source_max_age is not None:
            observed = datetime.fromisoformat(data["latest_observed_at"])
            source_age = (datetime.now(UTC) - observed).total_seconds()
            if not 0 <= source_age <= source_max_age:
                return 1
        return 0 if 0 <= age <= max(300, 3 * poll_seconds) else 1
    except (KeyError, TypeError, ValueError):
        return 1
