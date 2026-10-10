"""Real provider regressions: planned phases must never become current congestion."""

import json
import unittest
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

from config import Settings
from db_support import DatabaseCase
from normalize import parse_autobahn_item
from storage import persist_traffic_incidents
from traffic_flow import RIED_CORRIDORS, estimate_corridor_flow

EVIDENCE = (
    Path(__file__).resolve().parents[4]
    / "docs/evidence/autobahn-api-2026-10-09/inventory.json"
)
SETTINGS = Settings(roads=("A67",), poll_seconds=180, state_dir="/tmp", db={})


def real_sample(kind, future=False):
    evidence = json.loads(EVIDENCE.read_text())
    endpoint = next(
        e for e in evidence["endpoints"] if e["road"] == "A67" and e["kind"] == kind
    )
    return endpoint["future_sample" if future else "sample"]


class EventParsingTests(unittest.TestCase):
    def test_real_phase_and_overall_end_are_distinct(self):
        inc = parse_autobahn_item(
            real_sample("roadworks"), "A67", SETTINGS, "roadworks"
        )
        self.assertEqual(inc.provider_start_at, datetime(2026, 10, 4, 18, tzinfo=UTC))
        self.assertEqual(inc.provider_end_at, datetime(2026, 10, 20, 4, tzinfo=UTC))
        self.assertEqual(str(inc.overall_end_date), "2027-03-26")
        self.assertEqual(inc.work_length_meters, 1330)
        self.assertEqual(inc.length_meters, 0)  # Construction length is not jam length.
        self.assertEqual(inc.direction, "Mannheim -> Darmstadt")
        self.assertEqual(inc.delay_kind, "unknown")

    def test_real_planned_entry_exit_closure(self):
        inc = parse_autobahn_item(
            real_sample("closure", True), "A67", SETTINGS, "closure"
        )
        self.assertEqual(inc.closure_kind, "entry_exit")
        self.assertNotEqual(inc.severity, "standstill")
        self.assertEqual(inc.event_status(datetime(2026, 10, 9, tzinfo=UTC)), "planned")
        self.assertEqual(inc.event_status(datetime(2026, 10, 17, tzinfo=UTC)), "active")
        self.assertEqual(inc.event_status(datetime(2026, 10, 27, tzinfo=UTC)), "ended")
        flow = estimate_corridor_flow(
            next(c for c in RIED_CORRIDORS if c.road == "A67"), [inc]
        )
        self.assertNotEqual(flow.status, "closed")

    def test_distant_destination_does_not_override_coordinates(self):
        item = {
            **real_sample("roadworks"),
            "coordinate": {"lat": 52, "long": 10},
            "geometry": None,
        }
        self.assertIsNone(parse_autobahn_item(item, "A67", SETTINGS, "roadworks"))

    def test_crossing_line_with_both_endpoints_outside_is_retained(self):
        item = {
            **real_sample("roadworks"),
            "coordinate": {"lat": 49.6, "long": 8.0},
            "geometry": {
                "type": "LineString",
                "coordinates": [[8.0, 49.6], [9.0, 49.6]],
            },
        }
        self.assertIsNotNone(parse_autobahn_item(item, "A67", SETTINGS, "roadworks"))
        item["geometry"]["coordinates"] = [[8.0, 52], [9.0, 52]]
        self.assertIsNone(parse_autobahn_item(item, "A67", SETTINGS, "roadworks"))

    def test_future_without_date_and_boolean_validation(self):
        item = {
            **real_sample("closure"),
            "future": "true",
            "startTimestamp": None,
            "description": [],
        }
        inc = parse_autobahn_item(item, "A67", SETTINGS, "closure")
        self.assertEqual(inc.event_status(datetime.now(UTC)), "planned")
        for bad in ("maybe", [], {}):
            with self.assertRaises(ValueError):
                parse_autobahn_item({**item, "future": bad}, "A67", SETTINGS, "closure")

    def test_long_year_dates_and_unknown_sperrung(self):
        item = {
            **real_sample("closure"),
            "display_type": "WEIGHT_LIMIT_35",
            "future": False,
            "startTimestamp": None,
            "description": ["Beginn: 01.12.2026 09:00", "Ende: 02.12.2026 18:00"],
        }
        inc = parse_autobahn_item(item, "A67", SETTINGS, "closure")
        self.assertEqual(inc.closure_kind, "restriction")
        self.assertEqual(inc.provider_start_at.hour, 8)
        self.assertEqual(inc.provider_end_at.hour, 17)


class EventStorageTests(DatabaseCase):
    async def test_lifecycle_read_model_and_current_snapshots(self):
        now = datetime.now(UTC)
        inc = parse_autobahn_item(
            real_sample("closure", True), "A67", SETTINGS, "closure"
        )
        inc = replace(
            inc,
            provider_start_at=now + timedelta(days=1),
            provider_end_at=now + timedelta(days=2),
        )
        await persist_traffic_incidents(self.conn, [inc], SETTINGS, now)
        self.assertEqual(
            await self.scalar(
                "SELECT event_status FROM traffic_events WHERE id=%s", (inc.id,)
            ),
            "planned",
        )
        self.assertEqual(
            await self.scalar(
                "SELECT active_incidents_count FROM traffic_corridor_snapshots ORDER BY timestamp DESC LIMIT 1"
            ),
            0,
        )
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM traffic_source_checks"), 1
        )
        # Date boundary works in the view without waiting for another collector cycle.
        await self.conn.execute(
            "UPDATE traffic_incidents SET provider_start_at=NOW()-INTERVAL '1 minute'"
        )
        self.assertEqual(
            await self.scalar("SELECT event_status FROM traffic_events"), "active"
        )
        inc = replace(inc, provider_start_at=now - timedelta(minutes=1))
        await persist_traffic_incidents(
            self.conn, [inc], SETTINGS, now + timedelta(seconds=1)
        )
        self.assertEqual(
            await self.scalar("SELECT start_time FROM traffic_incidents"), now
        )
        self.assertEqual(
            await self.scalar(
                "SELECT active_incidents_count FROM traffic_corridor_snapshots ORDER BY timestamp DESC LIMIT 1"
            ),
            1,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT delay_kind FROM traffic_corridor_snapshots ORDER BY timestamp DESC LIMIT 1"
            ),
            "unknown",
        )
        await self.conn.execute(
            "UPDATE traffic_incidents SET provider_end_at=NOW()-INTERVAL '1 second'"
        )
        self.assertEqual(
            await self.scalar("SELECT event_status FROM traffic_events"), "ended"
        )
        await self.conn.execute(
            "UPDATE traffic_incidents SET last_seen_at=NOW()-INTERVAL '11 minutes'"
        )
        self.assertTrue(await self.scalar("SELECT is_stale FROM traffic_events"))
        await persist_traffic_incidents(
            self.conn, [], SETTINGS, now + timedelta(minutes=15)
        )
        self.assertEqual(
            await self.scalar("SELECT event_status FROM traffic_events"), "resolved"
        )

    async def test_partial_hessen_snapshot_preserves_existing_incidents(self):
        now = datetime.now(UTC)
        inc = parse_autobahn_item(
            real_sample("roadworks"), "A67", SETTINGS, "roadworks"
        )
        inc = replace(
            inc,
            id="hessen-retained",
            source="hessen_verkehrsservice",
            provider_start_at=None,
            provider_end_at=None,
        )
        await persist_traffic_incidents(
            self.conn, [inc], SETTINGS, now - timedelta(minutes=20)
        )
        await persist_traffic_incidents(
            self.conn, [], SETTINGS, now, reconcile_hessen=False
        )
        self.assertTrue(
            await self.scalar(
                "SELECT is_active FROM traffic_incidents WHERE id='hessen-retained'"
            )
        )
        await persist_traffic_incidents(
            self.conn, [], SETTINGS, now, reconcile_hessen=True
        )
        self.assertFalse(
            await self.scalar(
                "SELECT is_active FROM traffic_incidents WHERE id='hessen-retained'"
            )
        )
