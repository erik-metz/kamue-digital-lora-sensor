from datetime import UTC, datetime

from config import Settings
from db_support import DatabaseCase
from normalize import OpenSenseBoxObservation, OpenSenseMeasurement
from storage import persist_boxes


def sample_box():
    now = datetime(2026, 10, 3, 14, 0, tzinfo=UTC)
    return OpenSenseBoxObservation(
        box_id="58cd22d8c877fb0011774898",
        sensor_id="osem-58cd22d8c877fb0011774898",
        name="Bürstadt Wetterstation",
        friendly_name="senseBox: Bürstadt Wetterstation",
        model="homeWifiFeinstaub",
        exposure="outdoor",
        latitude=49.6425,
        longitude=8.4552,
        updated_at=now,
        measurements=[
            OpenSenseMeasurement(
                metric="temperature",
                value=21.5,
                unit="°C",
                observed_at=now,
                sensor_id="s1",
                sensor_title="Temperatur",
                sensor_type="HDC1080",
            ),
            OpenSenseMeasurement(
                metric="PM25",
                value=8.2,
                unit="µg/m³",
                observed_at=now,
                sensor_id="s2",
                sensor_title="PM2.5",
                sensor_type="SDS011",
            ),
        ],
        description="openSenseMap / senseBox Station Bürstadt",
    )


class OpenSenseStorageTests(DatabaseCase):
    async def test_persist_boxes_schema_and_metadata(self):
        settings = Settings(
            poll_seconds=300,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.00,
            min_lon=8.25,
            max_lon=8.80,
        )
        now = datetime.now(UTC)
        box = sample_box()

        stats = await persist_boxes(
            self.conn,
            [box],
            settings,
            now=now,
            payload_bytes=b'{"test": true}',
            payload_sha256="testsha256",
        )
        self.assertEqual(stats["boxes_updated"], 1)

        # Check sensor_metadata
        meta = await (
            await self.conn.execute(
                "SELECT friendly_name, latitude, longitude FROM sensor_metadata WHERE id=%s",
                (box.sensor_id,),
            )
        ).fetchone()
        self.assertIsNotNone(meta)
        self.assertEqual(meta[0], "senseBox: Bürstadt Wetterstation")
        self.assertAlmostEqual(float(meta[1]), 49.6425, places=4)
        self.assertAlmostEqual(float(meta[2]), 8.4552, places=4)

        # Check sensor_latest for temperature
        latest_temp = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='temperature'",
            (box.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_temp), 21.5)

        # Check sensor_latest for PM25 and mirrored PM2.5
        latest_pm25 = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='PM25'",
            (box.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_pm25), 8.2)

        latest_pm25_mirror = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='PM2.5'",
            (box.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_pm25_mirror), 8.2)

        # Check collection_sources was registered
        src = await (
            await self.conn.execute(
                "SELECT id, adapter, enabled FROM collection_sources WHERE id='opensensemap'"
            )
        ).fetchone()
        self.assertIsNotNone(src)
        self.assertEqual(src[0], "opensensemap")
        self.assertTrue(src[2])

        # Check entities table if present
        row = await (
            await self.conn.execute(
                """SELECT 1 FROM information_schema.tables
                WHERE table_name = 'entities' AND table_schema = current_schema()"""
            )
        ).fetchone()
        if row:
            entity_name = await self.scalar(
                "SELECT name FROM entities WHERE id=%s",
                (f"sensor:{box.sensor_id}",),
            )
            self.assertEqual(entity_name, "senseBox: Bürstadt Wetterstation")

        # Verify idempotency on second run
        stats2 = await persist_boxes(
            self.conn,
            [box],
            settings,
            now=now,
            payload_bytes=b'{"test": true}',
            payload_sha256="testsha256",
        )
        self.assertEqual(stats2["boxes_updated"], 1)
