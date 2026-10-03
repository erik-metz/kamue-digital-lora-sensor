import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import httpx
from health import check_health, record_status, write_json
from runtime import retry_delay


class HealthTests(unittest.TestCase):
    def test_failures_preserve_last_success_and_cadence_controls_staleness(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "status.json"
            status = record_status(path, {}, details={"accepted": 0})
            failed = record_status(path, status, error=ValueError("source"))
            self.assertEqual(failed["last_success"], status["last_success"])
            self.assertEqual(failed["consecutive_failures"], 1)
            failed["last_success"] = (
                datetime.now(UTC) - timedelta(minutes=30)
            ).isoformat()
            write_json(path, failed)
            self.assertEqual(check_health(path, 3600), 0)
            self.assertEqual(check_health(path, 60), 1)
            with patch("health.write_json", side_effect=OSError("disk")):
                self.assertEqual(record_status(path, failed)["status"], "healthy")

    def test_retry_after_is_a_minimum_and_retry_does_not_accelerate_polling(self):
        response = httpx.Response(
            429,
            headers={"Retry-After": "1000"},
            request=httpx.Request("GET", "https://example.org"),
        )
        error = httpx.HTTPStatusError(
            "limited", request=response.request, response=response
        )
        self.assertGreaterEqual(retry_delay(60, 1, error), 1000)
        self.assertGreaterEqual(retry_delay(60, 1, ValueError()), 60)
