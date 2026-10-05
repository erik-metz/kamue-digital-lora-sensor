import unittest
from datetime import UTC, datetime, timedelta

from health import check_collector_health


class CollectorHealthTests(unittest.TestCase):
    def test_stale_station_does_not_fail_active_collector(self):
        self.assertEqual(
            check_collector_health(
                {
                    "heartbeat": datetime.now(UTC).isoformat(),
                    "status": "healthy",
                    "stations": {"R5DFB": "stale"},
                }
            ),
            0,
        )

    def test_missing_stalled_or_blocked_collector_fails(self):
        self.assertEqual(check_collector_health({}), 1)
        for age, status in [(100, "healthy"), (0, "unhealthy"), (-100, "healthy")]:
            self.assertEqual(
                check_collector_health(
                    {
                        "heartbeat": (
                            datetime.now(UTC) - timedelta(seconds=age)
                        ).isoformat(),
                        "status": status,
                    }
                ),
                1,
            )
