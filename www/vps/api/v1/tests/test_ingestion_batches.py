import sys
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

import psycopg
from endpoints.telemetry import push_batch_sensor_data
from fastapi import HTTPException
from psycopg.rows import dict_row
from schemas import BatchSensorReadings, SensorReading

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tests"))
from db_support import DatabaseCase


class BatchTests(DatabaseCase):
    def pool(self):
        db = self.db

        class Pool:
            @asynccontextmanager
            async def connection(self):
                async with await psycopg.AsyncConnection.connect(
                    **db, row_factory=dict_row
                ) as conn:
                    yield conn

        return Pool()

    async def test_replay_conflict_and_atomic_receipt(self):
        reading = SensorReading(
            sensor_id="batch-station",
            metric="rms",
            value=2.45,
            unit="counts",
            timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        )
        batch = BatchSensorReadings(batch_id="repeatable", readings=[reading])
        self.assertEqual(
            (await push_batch_sensor_data(batch, self.pool()))["inserted_count"], 1
        )
        self.assertEqual(
            (await push_batch_sensor_data(batch, self.pool()))["status"], "duplicate"
        )
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 1)
        conflict = batch.model_copy(
            update={"readings": [reading.model_copy(update={"value": 99})]}
        )
        with self.assertRaises(HTTPException) as error:
            await push_batch_sensor_data(conflict, self.pool())
        self.assertEqual(error.exception.status_code, 409)
        bad = BatchSensorReadings(
            batch_id="failed",
            readings=[reading.model_copy(update={"sensor_id": "x" * 100})],
        )
        with self.assertRaises(psycopg.Error):
            await push_batch_sensor_data(bad, self.pool())
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM telemetry_ingest_batches WHERE batch_id='failed'"
            ),
            0,
        )

    async def test_no_receipt_keeps_legacy_append_behavior(self):
        batch = BatchSensorReadings(
            readings=[SensorReading(sensor_id="legacy", value=1, unit="counts")]
        )
        await push_batch_sensor_data(batch, self.pool())
        await push_batch_sensor_data(batch, self.pool())
        self.assertEqual(await self.scalar("SELECT count(*) FROM sensor_data"), 2)
        with self.assertRaises(HTTPException):
            await push_batch_sensor_data(
                batch.model_copy(update={"batch_id": "requires-time"}), self.pool()
            )

    async def test_collector_registration_preserves_admin_metadata(self):
        from endpoints.sensors import admin_create_sensor
        from schemas import SensorMetadataCreate

        await self.conn.execute(
            "INSERT INTO sensor_metadata(id,friendly_name,latitude,is_hidden) VALUES ('station','Admin',50,TRUE)"
        )
        await admin_create_sensor(
            SensorMetadataCreate(
                sensor_id="station",
                friendly_name="Source",
                latitude=49,
                longitude=8,
                preserve_existing=True,
            ),
            self.pool(),
        )
        self.assertEqual(
            await self.scalar(
                "SELECT friendly_name FROM sensor_metadata WHERE id='station'"
            ),
            "Admin",
        )
        self.assertEqual(
            await self.scalar(
                "SELECT latitude FROM sensor_metadata WHERE id='station'"
            ),
            50,
        )
        self.assertTrue(
            await self.scalar(
                "SELECT is_hidden FROM sensor_metadata WHERE id='station'"
            )
        )

    async def test_direct_db_receipt_matches_api_receipt(self):
        import hashlib
        import json

        readings = [
            {
                "sensor_id": "shake-test",
                "metric": "pgv",
                "value": 3.0,
                "unit": "counts",
                "timestamp": "2026-01-01T00:00:00+00:00",
            }
        ]
        digest = hashlib.sha256(
            json.dumps(readings, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        await self.conn.execute(
            "INSERT INTO telemetry_ingest_batches(batch_id,payload_hash) VALUES ('direct',%s)",
            (digest,),
        )
        result = await push_batch_sensor_data(
            BatchSensorReadings(batch_id="direct", readings=readings), self.pool()
        )
        self.assertEqual(result["status"], "duplicate")
