from dataclasses import replace
from unittest.mock import AsyncMock, patch

import httpx
import psycopg
from db_support import DatabaseCase
from normalize import Windows
from storage import Writer
from test_metrics import config


class StorageTests(DatabaseCase):
    async def test_replay_after_commit_and_failed_batch_rolls_back_receipt(self):
        station = config()
        station.base = replace(station.base, db=self.db)
        writer = Writer(station)
        try:
            windows = Windows(station)
            windows.add([(1000, -3), (1001, 3)])
            batch = next(iter(windows.ready(1005)))
            self.assertEqual((await writer.persist(batch))["inserted"], 2)
            self.assertEqual((await writer.persist(batch))["duplicate"], 2)
            self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 2)
            conflict = {**batch, "readings": [{**batch["readings"][0], "value": 999}]}
            with self.assertRaises((ValueError, TypeError)):
                await writer.persist(conflict)
            bad = {
                **batch,
                "batch_id": "bad",
                "readings": [{**batch["readings"][0], "metric": "x" * 100}],
            }
            with self.assertRaises(psycopg.Error):
                await writer.persist(bad)
            self.assertEqual(
                await self.scalar(
                    "SELECT count(*) FROM telemetry_ingest_batches WHERE batch_id='bad'"
                ),
                0,
            )
            self.assertEqual((await writer.persist(batch))["duplicate"], 2)
        finally:
            await writer.close()

    async def test_api_failure_is_not_acknowledged(self):
        station = config(INGEST_MODE="api")
        writer = Writer(station)
        writer.registered = True
        response = httpx.Response(
            503, request=httpx.Request("POST", "http://example.org")
        )
        with (
            patch.object(writer.client, "post", AsyncMock(return_value=response)),
            self.assertRaises(httpx.HTTPStatusError),
        ):
            await writer.persist({"batch_id": "test", "readings": []})
        await writer.close()
