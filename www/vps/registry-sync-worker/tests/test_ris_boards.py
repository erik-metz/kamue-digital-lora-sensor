"""Synthetic contract fixtures; never used as published train data."""

import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from ris_boards import (
    CONTRACT,
    import_ris_boards,
    load_crosswalk,
    match_schedule,
    parse_board,
)

NOW = datetime(2026, 10, 6, 12, tzinfo=UTC)


def event(event_type="departure", **overrides):
    return {
        "journeyID": "ris-opaque-instance",
        event_type + "ID": "event-1",
        "station": {"evaNumber": "8000503", "name": "Biblis"},
        "transport": {
            "journeyID": "ris-opaque-instance",
            "type": "REGIONAL_TRAIN",
            "journeyDescription": "RE 70",
            "destination": {"name": "Mannheim Hbf"},
            "origin": {"name": "Frankfurt Hbf"},
        },
        "timeSchedule": "2026-10-06T14:00:00+02:00",
        "time": "2026-10-06T14:04:00+02:00",
        "timeType": "PREVIEW",
        "canceled": False,
        "platform": "2",
        **overrides,
    }


def link(**overrides):
    return {
        "journey_id": "ris-opaque-instance",
        "event_id": "event-1",
        "eva_number": "8000503",
        "event_type": "departure",
        "schedule_source": "gtfs-test",
        "trip_id": "opaque-trip",
        "service_date": "2026-10-05",
        "stop_id": "gtfs-stop",
        "stop_sequence": 2,
        "scheduled_at": "2026-10-06T12:00:00Z",
        "evidence": "Verified provider trip crosswalk",
        **overrides,
    }


def schedule():
    return (
        "train",
        {
            "stop_times": [
                {
                    "stop_id": "gtfs-stop",
                    "sequence": 2,
                    "departure": NOW.timestamp(),
                    "arrival": NOW.timestamp() - 60,
                }
            ]
        },
    )


class RisBoardsContractTests(unittest.TestCase):
    def test_documented_times_identity_and_public_description(self):
        rows = parse_board({"departures": [event()]}, "departure", {"8000503"})
        self.assertEqual(rows[0]["journey_id"], "ris-opaque-instance")
        self.assertEqual(rows[0]["delay_seconds"], 240)
        self.assertEqual(rows[0]["time_basis"], "PREVIEW")
        self.assertEqual(rows[0]["scheduled_at"], "2026-10-06T12:00:00+00:00")
        self.assertEqual(rows[0]["gtfs_link"], {"status": "unmapped"})
        self.assertNotIn("service_date", rows[0])
        self.assertNotIn("categoryInternal", rows[0])

    def test_schedule_is_not_zero_delay_realtime_and_cancellation_is_a_stop(self):
        row = parse_board(
            {
                "arrivals": [
                    event(
                        "arrival",
                        time="2026-10-06T14:00:00+02:00",
                        timeType="SCHEDULE",
                        canceled=True,
                    )
                ]
            },
            "arrival",
            {"8000503"},
        )[0]
        self.assertIsNone(row["delay_seconds"])
        self.assertTrue(row["cancelled"])
        self.assertEqual(row["event_type"], "arrival")

    def test_unexpected_eva_identity_duplicates_and_naive_times_fail(self):
        for row in [
            event(station={"evaNumber": "wrong"}),
            event(transport={"journeyID": "other"}),
            event(timeSchedule="2026-10-06T12:00:00"),
            event(timeType="UNKNOWN"),
            event(canceled="false"),
            event(timeType="SCHEDULE"),
        ]:
            with self.assertRaises(ValueError):
                parse_board({"departures": [row]}, "departure", {"8000503"})
        with self.assertRaises(ValueError):
            parse_board({"departures": [event(), event()]}, "departure", {"8000503"})
        with self.assertRaises(ValueError):
            parse_board({}, "departure", {"8000503"})

    def test_non_train_entries_do_not_become_train_events(self):
        row = event()
        row["transport"]["type"] = "BUS"
        self.assertEqual(
            parse_board({"departures": [row]}, "departure", {"8000503"}), []
        )

    def test_explicit_overnight_service_day_survives_exact_schedule_match(self):
        row = parse_board({"departures": [event()]}, "departure", {"8000503"})[0]
        result = match_schedule(row, link(), schedule())
        self.assertEqual(result["status"], "matched")
        self.assertEqual(result["service_date"], "2026-10-05")
        self.assertEqual(result["trip_id"], "opaque-trip")
        self.assertEqual(
            match_schedule(row, link(), None)["status"], "schedule_missing"
        )
        self.assertEqual(
            match_schedule(row, link(stop_sequence=3), schedule())["status"],
            "schedule_mismatch",
        )
        self.assertEqual(
            match_schedule(row, link(scheduled_at="2026-10-06T12:01:00Z"), schedule())[
                "status"
            ],
            "schedule_mismatch",
        )
        self.assertEqual(
            match_schedule(row, link(), ("bus", schedule()[1]))["status"],
            "schedule_mismatch",
        )

    def test_crosswalk_requires_evidence_and_one_trip_instance_per_journey(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "links.json"
            path.write_text(json.dumps({"version": 1, "links": [link()]}))
            records, digest = load_crosswalk(path)
            self.assertEqual(len(records), 1)
            self.assertEqual(len(digest), 64)
            for rows in [
                [link(), link()],
                [link(), link(event_id="event-2", trip_id="other")],
                [link(evidence="")],
                [link(), link(journey_id="other", event_id="event-2")],
            ]:
                path.write_text(json.dumps({"version": 1, "links": rows}))
                with self.assertRaises(ValueError):
                    load_crosswalk(path)
        self.assertEqual(load_crosswalk(""), ({}, None))


class RisBoardsImportTests(unittest.IsolatedAsyncioTestCase):
    def connection(self):
        conn = MagicMock()
        conn.execute = AsyncMock()
        conn.commit = AsyncMock()
        conn.transaction.return_value = AsyncMock()
        return conn

    async def test_contract_confirmation_and_credentials_are_preflight_requirements(
        self,
    ):
        conn, client = self.connection(), AsyncMock()
        with self.assertRaises(ValueError):
            await import_ris_boards(
                conn, client, {"contract": CONTRACT, "contract_confirmed": False}
            )
        client.get.assert_not_called()
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(ValueError):
            await import_ris_boards(
                conn,
                client,
                {
                    "contract": CONTRACT,
                    "contract_confirmed": True,
                    "eva_numbers": ["8000503"],
                    "url": "https://apis.deutschebahn.com/ris",
                    "header_env": {"DB-Api-Key": "DB_API_KEY"},
                },
            )
        client.get.assert_not_called()

    async def test_partial_request_failure_never_publishes_or_changes_predictions(self):
        conn = self.connection()
        with (
            patch(
                "ris_boards.acquire",
                AsyncMock(
                    side_effect=[
                        (
                            httpx.Response(200, json={"departures": [event()]}),
                            "hash",
                            1,
                        ),
                        ValueError("arrival failed"),
                    ]
                ),
            ),
            patch("ris_boards.publish", AsyncMock()) as publish,
        ):
            with self.assertRaises(ValueError):
                await import_ris_boards(
                    conn,
                    AsyncMock(),
                    {
                        "contract": CONTRACT,
                        "contract_confirmed": True,
                        "eva_numbers": ["8000503"],
                        "url": "https://apis.deutschebahn.com/ris",
                    },
                )
            publish.assert_not_called()
        self.assertFalse(
            any("movement_" in str(call.args) for call in conn.execute.call_args_list)
        )

    async def test_atomic_board_publication_archives_bundle_and_matches_exact_date(
        self,
    ):
        conn = self.connection()
        conn.execute.return_value.fetchone = AsyncMock(return_value=schedule())
        key = ("ris-opaque-instance", "event-1", "8000503", "departure")
        with (
            patch(
                "ris_boards.load_crosswalk",
                return_value=({key: link()}, "crosswalk-hash"),
            ),
            patch(
                "ris_boards.acquire",
                AsyncMock(
                    side_effect=[
                        (
                            httpx.Response(200, json={"departures": [event()]}),
                            "hash-departure",
                            1,
                        ),
                        (httpx.Response(200, json={"arrivals": []}), "hash-arrival", 2),
                    ]
                ),
            ) as acquire,
            patch("ris_boards.publish", AsyncMock()) as publish,
        ):
            await import_ris_boards(
                conn,
                AsyncMock(),
                {
                    "contract": CONTRACT,
                    "contract_confirmed": True,
                    "eva_numbers": ["8000503"],
                    "url": "https://apis.deutschebahn.com/ris",
                },
            )
        body = publish.call_args.args[3]
        self.assertEqual(body["events"][0]["gtfs_link"]["service_date"], "2026-10-05")
        self.assertEqual(body["timestamp_basis"], "fetched")
        self.assertEqual(body["payload_sha256s"], ["hash-departure", "hash-arrival"])
        self.assertTrue(
            any(
                "INSERT INTO collected_payloads" in call.args[0]
                for call in conn.execute.call_args_list
            )
        )
        self.assertFalse(
            any(
                "INSERT INTO movement_" in call.args[0]
                for call in conn.execute.call_args_list
            )
        )
        self.assertIn("includeStationGroup=false", acquire.call_args_list[0].args[3])
