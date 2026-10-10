import unittest
from datetime import UTC, datetime, timedelta

from traffic_semantics import summarize_corridor


class CorridorSemanticsTests(unittest.TestCase):
    def test_missing_coverage_is_not_free_traffic(self):
        self.assertEqual(summarize_corridor([])["status"], "unknown")
        now = datetime.now(UTC)
        result = summarize_corridor([], now, now)
        self.assertEqual(result["status"], "clear")
        self.assertIsNone(result["delay_minutes"])
        self.assertIn("keine Verkehrsmessung", result["description"])
        self.assertEqual(
            summarize_corridor([], now - timedelta(minutes=11), now)["status"],
            "unknown",
        )

    def test_unknown_delay_and_entry_exit_do_not_mean_full_closure(self):
        now = datetime.now(UTC)
        inc = {
            "delay_seconds": 0,
            "delay_kind": "unknown",
            "cause_type": "closure",
            "closure_kind": "entry_exit",
        }
        result = summarize_corridor([inc], now, now)
        self.assertEqual(result["status"], "sluggish")
        self.assertIsNone(result["delay_minutes"])
        result = summarize_corridor([{**inc, "closure_kind": "full"}], now, now)
        self.assertEqual(result["status"], "closure")
        self.assertIsNone(result["delay_minutes"])

    def test_estimate_label_and_stale_events(self):
        now = datetime.now(UTC)
        inc = {"delay_seconds": 1200, "delay_kind": "estimated"}
        result = summarize_corridor([inc], now, now)
        self.assertEqual(result["delay_minutes"], 20)
        self.assertIn("geschätzt", result["description"])
        result = summarize_corridor([{**inc, "is_stale": True}], now, now)
        self.assertEqual(result["active_incidents_count"], 0)
        self.assertIsNone(result["delay_minutes"])
