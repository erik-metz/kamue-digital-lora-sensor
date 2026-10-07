from datetime import UTC, datetime

from config import Settings
from db_support import DatabaseCase
from normalize import UbaMeasurement, UbaStationObservation
from storage import persist_stations


def sample_station():
    now = datetime(2026, 10, 3, 20, 0, tzinfo=UTC)
    return UbaStationObservation(
        station_id="671",
        station_code="DEHE043",
        sensor_id="uba-dehe043",
        name="Riedstadt",
        friendly_name="UBA Luftgütestation Riedstadt (Riedstadt)",
        city="Riedstadt",
        network="Hessen",
        station_type="Hintergrund",
        latitude=49.8252,
        longitude=8.5168,
        updated_at=now,
        measurements=[
            UbaMeasurement(
                metric="air_quality_index",
                value=1.0,
                unit="index",
                observed_at=now,
                index_value=1,
            ),
            UbaMeasurement(
                metric="PM10",
                value=12.0,
                unit="µg/m³",
                observed_at=now,
            ),
            UbaMeasurement(
                metric="PM25",
                value=5.0,
                unit="µg/m³",
                observed_at=now,
            ),
            UbaMeasurement(
                metric="NO2",
                value=16.0,
                unit="µg/m³",
                observed_at=now,
            ),
        ],
        description="Amtliche Luftgütemessstation Riedstadt",
    )


class UbaStorageTests(DatabaseCase):
    async def test_persist_stations_schema_and_metadata(self):
        settings = Settings(
            poll_seconds=1800,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.05,
            min_lon=8.25,
            max_lon=8.85,
        )
        now = datetime.now(UTC)
        st = sample_station()

        stats = await persist_stations(
            self.conn,
            [st],
            settings,
            now=now,
            payload_bytes=b'{"test": true}',
            payload_sha256="testsha256uba",
        )
        self.assertEqual(stats["stations_updated"], 1)

        # Check sensor_metadata
        meta = await (
            await self.conn.execute(
                "SELECT friendly_name, latitude, longitude FROM sensor_metadata WHERE id=%s",
                (st.sensor_id,),
            )
        ).fetchone()
        self.assertIsNotNone(meta)
        self.assertEqual(meta[0], "UBA Luftgütestation Riedstadt (Riedstadt)")
        self.assertAlmostEqual(float(meta[1]), 49.8252, places=4)
        self.assertAlmostEqual(float(meta[2]), 8.5168, places=4)

        # Check sensor_latest for air_quality_index
        latest_aqi = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='air_quality_index'",
            (st.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_aqi), 1.0)

        # Check sensor_latest for PM10
        latest_pm10 = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='PM10'",
            (st.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_pm10), 12.0)

        # Check sensor_latest for PM25 and mirrored PM2.5
        latest_pm25 = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='PM25'",
            (st.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_pm25), 5.0)

        latest_pm25_mirror = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='PM2.5'",
            (st.sensor_id,),
        )
        self.assertAlmostEqual(float(latest_pm25_mirror), 5.0)

        # Check collection_sources was registered
        src = await (
            await self.conn.execute(
                "SELECT id, adapter, enabled FROM collection_sources WHERE id='uba'"
            )
        ).fetchone()
        self.assertIsNotNone(src)
        self.assertEqual(src[0], "uba")
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
                (f"sensor:{st.sensor_id}",),
            )
            self.assertEqual(entity_name, "UBA Luftgütestation Riedstadt (Riedstadt)")

        # Verify idempotency on second run
        stats2 = await persist_stations(
            self.conn,
            [st],
            settings,
            now=now,
            payload_bytes=b'{"test": true}',
            payload_sha256="testsha256uba",
        )
        self.assertEqual(stats2["stations_updated"], 1)
