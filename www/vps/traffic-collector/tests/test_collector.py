import copy
import os
import unittest
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import psycopg
from config import Settings
from db_support import DatabaseCase
from main import poll_cycle
from normalize import normalize
from source import fetch
from storage import persist_traffic_incidents


def settings():
    with patch.dict(os.environ, {}, clear=True):
        return Settings.from_env()


def snapshot():
    return {
        road: {
            category: {category: []} for category in ("warning", "roadworks", "closure")
        }
        for road in settings().roads
    }


def incident():
    return {
        "identifier": "one",
        "title": "A67 bei Lorsch",
        "coordinate": {"lat": "49.6", "long": "8.5"},
    }


class SourceTests(unittest.IsolatedAsyncioTestCase):
    async def test_partial_failure_does_not_open_database(self):
        def response(request):
            category = request.url.path.rsplit("/", 1)[-1]
            return (
                httpx.Response(503)
                if category == "closure"
                else httpx.Response(200, json={category: []})
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            with patch(
                "main.psycopg.AsyncConnection.connect", new_callable=AsyncMock
            ) as connect:
                with self.assertRaises(httpx.HTTPStatusError):
                    await poll_cycle(client, settings())
                connect.assert_not_called()

    async def test_empty_success_and_dry_run(self):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, json={request.url.path.rsplit("/", 1)[-1]: []}
                )
            )
        ) as client:
            payload = await fetch(client, settings())
            self.assertEqual(
                normalize(payload, settings()), ([], {"outside_region": 0})
            )
            with patch(
                "main.psycopg.AsyncConnection.connect", new_callable=AsyncMock
            ) as connect:
                self.assertEqual(
                    (await poll_cycle(client, settings(), dry_run=True))["accepted"], 0
                )
                connect.assert_not_called()

    def test_invalid_snapshot_never_means_empty(self):
        for payload in ({}, {"A67": {}}, {**snapshot(), "A67": {"warning": {}}}):
            with self.assertRaises((ValueError, TypeError)):
                normalize(payload, settings())
        payload = snapshot()
        payload["A67"]["warning"]["warning"] = [
            {
                "identifier": "bad",
                "geometry": {"type": "LineString", "coordinates": [[None, 3]]},
            }
        ]
        with self.assertRaises((ValueError, TypeError)):
            normalize(payload, settings())

    def test_bad_coordinates_cannot_look_like_a_valid_empty_snapshot(self):
        for coordinate in (
            {"lat": "invalid", "long": "8.5"},
            {"lat": "NaN", "long": "8.5"},
        ):
            payload = snapshot()
            payload["A67"]["warning"]["warning"] = [
                {**incident(), "coordinate": coordinate}
            ]
            with self.assertRaises(ValueError):
                normalize(payload, settings())

    def test_deduplicates_and_does_not_invent_location_or_delay(self):
        payload = snapshot()
        payload["A67"]["warning"]["warning"] = [incident()]
        payload["A67"]["closure"]["closure"] = [incident()]
        parsed, _ = normalize(payload, settings())
        self.assertEqual(len(parsed), 1)
        self.assertEqual((parsed[0].location_from, parsed[0].location_to), ("", ""))
        self.assertEqual(
            (parsed[0].delay_seconds, parsed[0].delay_kind), (0, "unknown")
        )
        self.assertEqual(parsed[0].cause_type, "closure")

    def test_csv_and_json_settings_and_validation(self):
        for raw in ("A67,A5,A6", '["A67","A5","A6"]'):
            with patch.dict(os.environ, {"TRAFFIC_ROADS": raw}, clear=True):
                self.assertEqual(Settings.from_env().roads, ("A67", "A5", "A6"))
        for raw in ("", "typo", "A67,"):
            with (
                patch.dict(os.environ, {"TRAFFIC_ROADS": raw}, clear=True),
                self.assertRaises((ValueError, TypeError)),
            ):
                Settings.from_env()


class StorageTests(DatabaseCase):
    async def test_resolution_is_scoped_and_rollback_recovers(self):
        payload = snapshot()
        payload["A67"]["warning"]["warning"] = [incident()]
        records, _ = normalize(payload, settings())
        now = datetime.now(UTC)
        records[0] = replace(records[0], direction='Direction ' * 30,
                             location_from='Origin ' * 30, location_to='Destination ' * 30)
        other = replace(records[0], id="external", source="other")
        other_road = replace(records[0], id="a8", road_name="A8")
        await persist_traffic_incidents(
            self.conn,
            records + [other, other_road],
            settings(),
            now - timedelta(minutes=10),
        )
        await persist_traffic_incidents(self.conn, [], settings(), now)
        self.assertFalse(
            await self.scalar(
                "SELECT is_active FROM traffic_incidents WHERE id=%s", (records[0].id,)
            )
        )
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM traffic_incidents WHERE is_active"),
            2,
        )
        bad = copy.copy(records[0])
        bad.id = "x" * 200
        before = await self.scalar("SELECT count(*) FROM traffic_corridor_snapshots")
        with self.assertRaises(psycopg.Error):
            await persist_traffic_incidents(
                self.conn, [records[0], bad], settings(), now
            )
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM traffic_corridor_snapshots"), before
        )
        self.assertFalse(
            await self.scalar(
                "SELECT is_active FROM traffic_incidents WHERE id=%s", (records[0].id,)
            )
        )
        await persist_traffic_incidents(self.conn, records, settings(), now)
        cursor = await self.conn.execute(
            'SELECT direction,location_from,location_to FROM traffic_incidents WHERE id=%s',
            (records[0].id,))
        self.assertEqual(await cursor.fetchone(),
                         (records[0].direction, records[0].location_from, records[0].location_to))
        self.assertTrue(
            await self.scalar(
                "SELECT is_active FROM traffic_incidents WHERE id=%s", (records[0].id,)
            )
        )
