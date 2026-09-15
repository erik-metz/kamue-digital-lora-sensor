"""Set SMARTCITY_TEST_DATABASE_URL to a disposable PostgreSQL/Timescale database."""

import asyncio
import json
import os
import sys
import unittest
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import psycopg
from psycopg import sql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import Settings
from main import run
from normalize import normalize
from storage import ingest
from test_normalize import NOW, URL, dashboard

DSN = os.getenv("SMARTCITY_TEST_DATABASE_URL")
SCHEMA = Path(__file__).resolve().parents[2] / "api/v1/schema.sql"


@unittest.skipUnless(
    DSN, "Set SMARTCITY_TEST_DATABASE_URL for database integration tests"
)
class StorageTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.schema = "scs_test_" + uuid4().hex
        self.conn = await psycopg.AsyncConnection.connect(DSN, autocommit=True)
        if os.getenv("SMARTCITY_TEST_TIMESCALE") == "1":
            await self.conn.execute(
                "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"
            )
        await self.conn.execute(
            sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema))
        )
        await self.conn.execute(
            sql.SQL("SET search_path TO {}, public").format(sql.Identifier(self.schema))
        )
        schema = SCHEMA.read_text()
        if os.getenv("SMARTCITY_TEST_TIMESCALE") != "1":
            schema = schema.replace(
                "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;", ""
            )
            schema = schema.replace(
                "SELECT create_hypertable('sensor_data', 'timestamp', if_not_exists => TRUE);",
                "",
            )
        await self.conn.execute(schema)
        await self.conn.execute(schema)  # Startup migration is repeatable.
        await self.conn.execute("DELETE FROM sensor_metadata")
        self.item = normalize(dashboard(), "buerstadt", URL, NOW).observations[0]

    async def asyncTearDown(self):
        await self.conn.execute(
            sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema))
        )
        await self.conn.close()

    async def scalar(self, query):
        cur = await self.conn.execute(query)
        return (await cur.fetchone())[0]

    async def test_new_source_position_repairs_missing_coordinates_only(self):
        await ingest(self.conn, [self.item])
        located = replace(self.item, latitude=49.6, longitude=8.4)
        await ingest(self.conn, [located])
        self.assertEqual(
            await self.scalar("SELECT latitude FROM sensor_metadata"), 49.6
        )
        await self.conn.execute("UPDATE sensor_metadata SET latitude=50, longitude=9")
        await ingest(self.conn, [located])
        self.assertEqual(await self.scalar("SELECT latitude FROM sensor_metadata"), 50)

    async def test_replay_and_restart_are_idempotent(self):
        self.assertEqual((await ingest(self.conn, [self.item]))["inserted"], 1)
        async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as other:
            await other.execute(
                sql.SQL("SET search_path TO {}, public").format(
                    sql.Identifier(self.schema)
                )
            )
            self.assertEqual((await ingest(other, [self.item]))["duplicate"], 1)
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)

    async def test_same_value_at_new_timestamp_is_a_new_reading(self):
        later = replace(
            self.item,
            observed_at=NOW + timedelta(minutes=1),
            fetched_at=NOW + timedelta(minutes=2),
        )
        await ingest(self.conn, [self.item, later])
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 2)

    async def test_correction_updates_telemetry_and_records_previous_value(self):
        await ingest(self.conn, [self.item])
        correction = replace(
            self.item,
            value=19,
            fetched_at=NOW + timedelta(minutes=1),
            source_updated_at=NOW + timedelta(minutes=1),
        )
        self.assertEqual((await ingest(self.conn, [correction]))["revised"], 1)
        self.assertEqual(await self.scalar("SELECT value FROM sensor_data"), 19)
        self.assertEqual(
            await self.scalar("SELECT previous_value FROM smartcity_revisions"), 12
        )
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)
        self.assertEqual((await ingest(self.conn, [correction]))["duplicate"], 1)

    async def test_cached_old_source_does_not_revert_correction(self):
        current = replace(
            self.item,
            value=20,
            fetched_at=NOW + timedelta(minutes=2),
            source_updated_at=NOW + timedelta(minutes=1),
        )
        await ingest(self.conn, [current])
        old = replace(self.item, fetched_at=NOW + timedelta(minutes=3))
        self.assertEqual((await ingest(self.conn, [old]))["superseded"], 1)
        self.assertEqual(await self.scalar("SELECT value FROM sensor_data"), 20)

    async def test_mapping_change_rolls_back_entire_batch(self):
        await ingest(self.conn, [self.item])
        other = replace(self.item, entity_id="another")
        with self.assertRaises(ValueError):
            await ingest(self.conn, [other, replace(self.item, unit="F")])
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_metadata"), 1)
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)

    async def test_concurrent_initial_polls_insert_once(self):
        async def worker():
            async with await psycopg.AsyncConnection.connect(
                DSN, autocommit=True
            ) as conn:
                await conn.execute(
                    sql.SQL("SET search_path TO {}, public").format(
                        sql.Identifier(self.schema)
                    )
                )
                return await ingest(conn, [self.item])

        counts = await asyncio.gather(worker(), worker())
        self.assertEqual(sum(c["inserted"] for c in counts), 1)
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)

    async def test_admin_visibility_and_names_survive_polling(self):
        await ingest(self.conn, [self.item])
        await self.conn.execute(
            "UPDATE sensor_metadata SET is_hidden=TRUE, friendly_name='Custom'"
        )
        await ingest(self.conn, [self.item])
        self.assertTrue(await self.scalar("SELECT is_hidden FROM sensor_metadata"))
        self.assertEqual(
            await self.scalar("SELECT friendly_name FROM sensor_metadata"), "Custom"
        )

    async def test_ledger_mismatch_rolls_back_revision(self):
        await ingest(self.conn, [self.item])
        await self.conn.execute("DELETE FROM sensor_data")
        with self.assertRaises(RuntimeError):
            await ingest(self.conn, [replace(self.item, value=19)])
        self.assertEqual(
            await self.scalar("SELECT value FROM smartcity_observations"), 12
        )
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM smartcity_revisions"), 0
        )

    async def test_sensor_purge_cascades_collector_records(self):
        await ingest(self.conn, [self.item])
        await self.conn.execute("DELETE FROM sensor_data")
        await self.conn.execute("DELETE FROM sensor_metadata")
        self.assertEqual(await self.scalar("SELECT count(*) FROM smartcity_sources"), 0)
        self.assertEqual(
            await self.scalar("SELECT count(*) FROM smartcity_observations"), 0
        )

    async def test_full_poll_commits_and_writes_health_only_after_success(self):
        with TemporaryDirectory() as directory:
            settings = Settings(
                "buerstadt",
                URL,
                60,
                frozenset(),
                frozenset(),
                directory,
                {"conninfo": DSN, "options": f"-c search_path={self.schema},public"},
            )
            with patch("main.fetch", AsyncMock(return_value=dashboard())):
                await run(settings, once=True)
                await run(settings, once=True)
            status_file = Path(directory) / "status.json"
            status = json.loads(status_file.read_text())
            self.assertEqual(status["ingestion"]["duplicate"], 1)
            self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)
            with (
                patch("main.fetch", AsyncMock(side_effect=ValueError("bad response"))),
                self.assertRaises(ValueError),
            ):
                await run(settings, once=True)
            self.assertEqual(
                json.loads(status_file.read_text())["last_success"],
                status["last_success"],
            )


if __name__ == "__main__":
    unittest.main()
