import copy
import os
import unittest
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import psycopg
from config import Settings
from db_support import DatabaseCase
from normalize import parse_nextbike_response
from storage import ingest_nextbike_data
from test_normalize import SAMPLE_PAYLOAD


class ConfigAndParsingTests(unittest.TestCase):
    def test_invalid_filters_fail_closed(self):
        for value in ("", "oops", "559,typo", "0"):
            with (
                patch.dict(os.environ, {"NEXTBIKE_CITY_IDS": value}, clear=True),
                self.assertRaises((ValueError, TypeError)),
            ):
                Settings.from_env()
        with patch.dict(os.environ, {"NEXTBIKE_CITY_IDS": "all"}, clear=True):
            self.assertEqual(Settings.from_env().city_ids, frozenset())

    def test_malformed_or_missing_city_and_duplicate_bikes_rejected(self):
        for data in ({}, {"countries": []}):
            with self.assertRaises((ValueError, TypeError)):
                parse_nextbike_response(data, {559})
        data = copy.deepcopy(SAMPLE_PAYLOAD)
        places = data["countries"][0]["cities"][0]["places"]
        places[1]["bike_list"] = places[0]["bike_list"]
        with self.assertRaises((ValueError, TypeError)):
            parse_nextbike_response(data, {559})


class StorageTests(DatabaseCase):
    async def test_replay_roster_change_metadata_and_staleness(self):
        now = datetime.now(UTC)
        stations = parse_nextbike_response(SAMPLE_PAYLOAD, {559}, now)
        first = await ingest_nextbike_data(self.conn, stations, city_ids={559})
        self.assertGreater(first["observations_inserted"], 0)
        again = await ingest_nextbike_data(self.conn, stations, city_ids={559})
        self.assertEqual(again["observations_inserted"], 0)
        await self.conn.execute(
            "UPDATE sensor_metadata SET friendly_name='Admin', latitude=50 WHERE id=%s",
            (stations[0].sensor_id,),
        )
        changed = replace(
            stations[0], timestamp=now + timedelta(seconds=60), bike_numbers=("new",)
        )
        counts = await ingest_nextbike_data(self.conn, [changed], city_ids={559})
        self.assertEqual(counts["observations_inserted"], 1)
        self.assertEqual(
            await self.scalar(
                "SELECT friendly_name FROM sensor_metadata WHERE id=%s",
                (changed.sensor_id,),
            ),
            "Admin",
        )
        await ingest_nextbike_data(
            self.conn, [], city_ids={559}, fetched_at=now + timedelta(hours=1)
        )
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM nextbike_bikes WHERE is_active"), 0
        )

    async def test_movement_is_replayable_and_failed_batch_rolls_back(self):
        now = datetime.now(UTC)
        stations = parse_nextbike_response(SAMPLE_PAYLOAD, {559}, now)
        await ingest_nextbike_data(self.conn, stations, city_ids={559})
        moved = replace(
            stations[1],
            timestamp=now + timedelta(seconds=60),
            bikes_detail=stations[0].bikes_detail,
        )
        result = await ingest_nextbike_data(self.conn, [moved], city_ids={559})
        self.assertEqual(result["trips_detected"], len(stations[0].bikes_detail))
        result = await ingest_nextbike_data(self.conn, [moved], city_ids={559})
        self.assertEqual(result["trips_detected"], 0)
        before = await self.scalar("SELECT count(*) FROM sensor_data")
        bad = replace(
            moved, sensor_id="x" * 100, timestamp=now + timedelta(seconds=120)
        )
        with self.assertRaises(psycopg.Error):
            await ingest_nextbike_data(
                self.conn, [replace(moved, bikes=99, timestamp=bad.timestamp), bad]
            )
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), before)
