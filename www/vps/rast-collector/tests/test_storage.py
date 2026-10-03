from datetime import UTC, datetime

from config import Settings
from db_support import DatabaseCase
from normalize import RastSiteObservation
from storage import persist_rast_sites


def sample_site():
    return RastSiteObservation(
        datex_id="DE-HE-670010",
        sensor_id="rast-de-he-670010",
        name="Lorsch Ost",
        friendly_name="Rastplatz Lorsch Ost (A67)",
        road="A67",
        destination="Darmstadt",
        latitude=49.64408,
        longitude=8.553497,
        capacity=77,
        occupancy_pct=105.0,
        free_spaces=0,
        occupied_spaces=81,
        site_status="full",
        opening_status="open",
        detection_type="modelBased",
        operator="Niederlassung Südwest",
        observed_at=datetime(2026, 10, 3, 13, 30, tzinfo=UTC),
    )


class RastStorageTests(DatabaseCase):
    async def test_persist_rast_sites_schema_and_metadata(self):
        settings = Settings(
            roads=("A67",),
            poll_seconds=900,
            state_dir="/tmp",
            db={},
        )
        now = datetime.now(UTC)
        site = sample_site()

        stats = await persist_rast_sites(self.conn, [site], settings, now)
        self.assertEqual(stats["sites_updated"], 1)

        # Check legacy sensor_metadata
        meta = await (
            await self.conn.execute(
                "SELECT friendly_name, latitude, longitude FROM sensor_metadata WHERE id=%s",
                (site.sensor_id,),
            )
        ).fetchone()
        self.assertIsNotNone(meta)
        self.assertEqual(meta[0], "Rastplatz Lorsch Ost (A67)")
        self.assertAlmostEqual(float(meta[1]), 49.64408, places=4)
        self.assertAlmostEqual(float(meta[2]), 8.553497, places=4)

        # Check sensor_latest
        latest_free = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='parking_free'",
            (site.sensor_id,),
        )
        self.assertEqual(int(latest_free), 0)

        latest_occ = await self.scalar(
            "SELECT value FROM sensor_latest WHERE sensor_id=%s AND metric='parking_occupied'",
            (site.sensor_id,),
        )
        self.assertEqual(int(latest_occ), 81)

        # Check entities table if present
        has_entities = await self.scalar(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'entities'"
        )
        if has_entities:
            entity_name = await self.scalar(
                "SELECT name FROM entities WHERE id=%s",
                (f"sensor:{site.sensor_id}",),
            )
            self.assertEqual(entity_name, "Rastplatz Lorsch Ost (A67)")

        # Verify idempotency on second run
        stats2 = await persist_rast_sites(self.conn, [site], settings, now)
        self.assertEqual(stats2["sites_updated"], 1)
