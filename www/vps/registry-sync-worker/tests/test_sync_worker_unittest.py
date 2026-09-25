"""Standard library unit tests for registry-sync-worker."""

import asyncio
import tempfile
import unittest
from pathlib import Path

from config import Settings
from health import read_status, record_job_status
from scheduler import REGISTERED_JOBS, run_all_jobs


class TestSyncWorker(unittest.TestCase):
    def test_registered_jobs_completeness(self):
        expected_jobs = {
            "infrastructure",
            "environment",
            "realestate",
            "demographics",
            "economy",
            "finance",
            "social",
        "transport",
        "waste",
        "statistics",
        "elections",
        "maps",
        }
        self.assertEqual(set(REGISTERED_JOBS.keys()), expected_jobs)

    def test_health_recording(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            health_file = Path(tmp_dir) / "health.json"
            status = record_job_status(health_file, "infrastructure", success=True, rows_ingested=15)
            self.assertEqual(status["overall_status"], "healthy")
            self.assertIn("infrastructure", status["jobs"])
            self.assertEqual(status["jobs"]["infrastructure"]["rows_ingested"], 15)

            read_back = read_status(health_file)
            self.assertEqual(read_back["jobs"]["infrastructure"]["status"], "success")

    def test_dry_run_all_jobs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            settings = Settings(
                db={"host": "localhost", "port": 5432, "dbname": "test", "user": "postgres", "password": ""},
                state_dir=Path(tmp_dir),
            )
            results = asyncio.run(run_all_jobs(settings, dry_run=True))
            self.assertEqual(len(results), len(REGISTERED_JOBS))
            for res in results:
                self.assertEqual(res["status"], "validated")
                self.assertEqual(res["rows_ingested"], 0)


if __name__ == "__main__":
    unittest.main()
