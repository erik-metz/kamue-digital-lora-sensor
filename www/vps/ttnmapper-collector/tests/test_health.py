import json
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from health import check_health, read_status, record_status


class HealthTests(unittest.TestCase):
    def test_status_lifecycle(self):
        with TemporaryDirectory() as tmp:
            p = Path(tmp) / "status.json"
            self.assertEqual(read_status(p), {})

            s1 = record_status(p, {}, details={"gateways_count": 5})
            self.assertEqual(s1["status"], "healthy")
            self.assertEqual(s1["gateways_count"], 5)
            self.assertEqual(s1["consecutive_failures"], 0)

            s2 = record_status(p, s1, error=RuntimeError("connection error"))
            self.assertEqual(s2["status"], "degraded")
            self.assertEqual(s2["consecutive_failures"], 1)
            self.assertEqual(s2["error_category"], "RuntimeError")

    def test_check_health(self):
        with TemporaryDirectory() as tmp:
            p = Path(tmp) / "status.json"
            self.assertEqual(check_health(p, 300), 1)

            now = datetime.now(UTC)
            p.write_text(json.dumps({"last_success": now.isoformat()}))
            self.assertEqual(check_health(p, 300), 0)

            stale = now - timedelta(seconds=2000)
            p.write_text(json.dumps({"last_success": stale.isoformat()}))
            self.assertEqual(check_health(p, 300), 1)
