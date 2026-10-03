from datetime import UTC, datetime

from config import Settings
from db_support import DatabaseCase
from normalize import NormalizedGateway, RiedCoverageSnapshot
from storage import persist_gateways


def sample_gateway():
    now = datetime(2026, 10, 4, 12, 0, tzinfo=UTC)
    return NormalizedGateway(
        gateway_id="eui-58a0cbfffe801234",
        sensor_id="ttn-gw-eui-58a0cbfffe801234",
        eui="58a0cbfffe801234",
        net_id="000013",
        tenant_id="ttn",
        cluster_id="eu1.cloud.thethings.network",
        latitude=49.682,
        longitude=8.618,
        altitude=120.5,
        antenna_placement="OUTDOOR",
        online=True,
        updated_at=now,
        friendly_name="LoRaWAN Gateway eui-58a0cbfffe801234",
        description="LoRaWAN Gateway in Bensheim",
    )


def sample_snapshot(gateways: list[NormalizedGateway]):
    now = datetime(2026, 10, 4, 12, 0, tzinfo=UTC)
    total = len(gateways)
    active = sum(1 for g in gateways if g.online)
    return RiedCoverageSnapshot(
        observed_at=now,
        total_gateways=total,
        active_gateways=active,
        outdoor_gateways=total,
        indoor_gateways=0,
        online_ratio_pct=100.0 if total > 0 else 0.0,
    )


class TTNMapperStorageTests(DatabaseCase):
    async def test_persist_gateways_and_core_schema(self):
        settings = Settings(
            poll_seconds=900,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.00,
            min_lon=8.25,
            max_lon=8.80,
            center_lat=49.64,
            center_lon=8.53,
            radius_meters=25000,
        )
        gw = sample_gateway()
        snapshot = sample_snapshot([gw])

        stats = await persist_gateways(
            self.conn,
            [gw],
            snapshot,
            settings,
            payload_bytes=b"{}",
            payload_sha256="fake_sha",
        )

        self.assertEqual(stats["gateways_updated"], 1)
        self.assertGreater(stats["measurements_written"], 0)
        self.assertGreater(stats["area_metrics_written"], 0)

        # Check collection_sources was registered
        src = await (
            await self.conn.execute(
                "SELECT id, adapter, enabled FROM collection_sources WHERE id='ttnmapper'"
            )
        ).fetchone()
        self.assertIsNotNone(src)
        self.assertEqual(src[0], "ttnmapper")
        self.assertTrue(src[2])

        # Verify entity created if table exists
        async with self.conn.cursor() as cur:
            await cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_name = 'entities'"
            )
            if (await cur.fetchone()) is not None:
                await cur.execute(
                    "SELECT id, entity_type FROM entities WHERE id = 'lora:gateway:eui-58a0cbfffe801234'"
                )
                row = await cur.fetchone()
                self.assertIsNotNone(row)
                self.assertEqual(row[1], "lora_gateway")

                # Verify regional entity created
                await cur.execute(
                    "SELECT id, entity_type FROM entities WHERE id = 'lora:area:hessisches_ried'"
                )
                area_row = await cur.fetchone()
                self.assertIsNotNone(area_row)
                self.assertEqual(area_row[1], "lora_coverage_area")

            # Verify sensor_metadata for map compatibility
            await cur.execute(
                "SELECT id, latitude, longitude FROM sensor_metadata WHERE id = %s",
                (gw.sensor_id,),
            )
            meta_row = await cur.fetchone()
            self.assertIsNotNone(meta_row)
            self.assertAlmostEqual(meta_row[1], 49.682, places=3)
            self.assertAlmostEqual(meta_row[2], 8.618, places=3)

            # Verify sensor_latest
            await cur.execute(
                "SELECT sensor_id, metric, value FROM sensor_latest WHERE sensor_id = %s",
                (gw.sensor_id,),
            )
            latest_row = await cur.fetchone()
            self.assertIsNotNone(latest_row)
            self.assertEqual(latest_row[1], "online_status")
            self.assertEqual(latest_row[2], 1.0)

        # Verify idempotency on second run
        stats2 = await persist_gateways(
            self.conn,
            [gw],
            snapshot,
            settings,
            payload_bytes=b"{}",
            payload_sha256="fake_sha",
        )
        self.assertEqual(stats2["gateways_updated"], 1)
