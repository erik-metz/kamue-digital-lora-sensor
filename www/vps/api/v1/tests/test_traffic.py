import sys
import unittest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()

from endpoints.traffic import (
    IngestIncidentPayload,
    SyncTrafficPayload,
    get_corridor_statuses,
    list_active_incidents,
    list_traffic_history,
    sync_traffic_incidents,
)


class TrafficTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.cursor.execute = AsyncMock()
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.conn.cursor.return_value.__aenter__.return_value = self.cursor
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_list_active_incidents(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            {
                "id": "autobahn-a67-001",
                "road_name": "A67",
                "direction": "Darmstadt -> Viernheim",
                "location_from": "AS Lorsch",
                "location_to": "AD Viernheim",
                "start_time": now,
                "end_time": None,
                "last_seen_at": now,
                "is_active": True,
                "delay_seconds": 900,
                "length_meters": 4500,
                "severity": "major",
                "cause_type": "congestion",
                "description": "4.5 km Stau nach Unfall",
                "coordinates": [[49.654, 8.560], [49.580, 8.540]],
                "source": "autobahn_api",
            }
        ]

        result = await list_active_incidents(self.pool, road="A67")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].road_name, "A67")
        self.assertEqual(result[0].delay_minutes, 15)
        self.assertEqual(result[0].length_km, 4.5)
        self.assertTrue(result[0].is_active)

    async def test_list_traffic_history(self):
        t1 = datetime(2026, 9, 14, 7, 30, tzinfo=UTC)
        t2 = datetime(2026, 9, 14, 8, 15, tzinfo=UTC)
        self.cursor.fetchall.return_value = [
            {
                "id": "autobahn-a67-old",
                "road_name": "A67",
                "direction": "Viernheim -> Darmstadt",
                "location_from": "AD Viernheim",
                "location_to": "AS Lorsch",
                "start_time": t1,
                "end_time": t2,
                "delay_seconds": 1200,
                "length_meters": 5000,
                "severity": "major",
                "cause_type": "congestion",
                "description": "Morgenstau im Berufsverkehr",
            }
        ]

        result = await list_traffic_history(self.pool, road="A67", days=7)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].duration_minutes, 45)
        self.assertEqual(result[0].location_from, "AD Viernheim")
        self.assertEqual(result[0].location_to, "AS Lorsch")

    async def test_get_corridor_statuses(self):
        self.cursor.fetchall.return_value = [
            {
                "road_name": "A67",
                "active_count": 2,
                "max_delay": 1080,
                "max_severity_rank": 3,
            },
            {
                "road_name": "B47",
                "active_count": 1,
                "max_delay": 420,
                "max_severity_rank": 2,
            },
        ]

        result = await get_corridor_statuses(self.pool)
        self.assertTrue(len(result) >= 4)
        a67 = next((c for c in result if c.road_name == "A67"), None)
        b47 = next((c for c in result if c.road_name == "B47"), None)
        b44 = next((c for c in result if c.road_name == "B44"), None)

        self.assertIsNotNone(a67)
        self.assertEqual(a67.status, "congestion")
        self.assertEqual(a67.delay_minutes, 18)

        self.assertIsNotNone(b47)
        self.assertEqual(b47.status, "sluggish")
        self.assertEqual(b47.delay_minutes, 7)

        self.assertIsNotNone(b44)
        self.assertEqual(b44.status, "clear")

    async def test_sync_traffic_incidents(self):
        payload = SyncTrafficPayload(
            incidents=[
                IngestIncidentPayload(
                    id="inc-1",
                    road_name="B47",
                    direction="Worms -> Bürstadt",
                    location_from="Rheinbrücke Worms",
                    location_to="Bürstadt-West",
                    delay_seconds=600,
                    length_meters=2000,
                    severity="moderate",
                    cause_type="congestion",
                    description="Zähflüssiger Feierabendverkehr Rheinbrücke",
                    coordinates=[[49.632, 8.360], [49.642, 8.430]],
                    source="probe",
                )
            ]
        )

        resp = await sync_traffic_incidents(payload, self.pool)
        self.assertEqual(resp["status"], "synced")
        self.assertEqual(resp["count"], 1)
        self.assertTrue(self.cursor.execute.called)


if __name__ == "__main__":
    unittest.main()
