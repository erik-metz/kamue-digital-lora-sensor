import sys
import unittest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()

from endpoints.buses import (
    BusPositionRecord,
    RecordBusPositionsPayload,
    get_latest_bus_positions,
    list_bus_lines,
    list_bus_stops,
    record_bus_positions,
)


class BusesTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_list_bus_stops(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "stop-bst-eks",
                "name": "Bürstadt Erich-Kästner-Schule",
                "municipality": "Bürstadt",
                "latitude": 49.6385,
                "longitude": 8.4610,
                "lines": ["642", "652"],
                "is_school_stop": True,
                "nearby_school_name": "Erich-Kästner-Schule",
                "is_train_hub": False,
                "platforms": ["Steig 1", "Steig 2"],
            }
        ]
        result = await list_bus_stops(self.pool, municipality="Bürstadt", school_stops_only=True)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "Bürstadt Erich-Kästner-Schule")
        self.assertTrue(result[0]["is_school_stop"])

    async def test_list_bus_lines(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "vrn-641",
                "line_number": "641",
                "operator": "VRN / VGG",
                "route_name": "Bürstadt – Lampertheim",
                "color": "#0284c7",
                "is_school_line": False,
            }
        ]
        result = await list_bus_lines(self.pool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["line_number"], "641")

    async def test_get_latest_bus_positions(self):
        now = datetime.now(UTC)
        self.cursor.fetchall.return_value = [
            {
                "timestamp": now,
                "vehicle_id": "bus-642-1",
                "trip_id": "trip-1",
                "line": "642",
                "origin": "Worms Hbf",
                "destination": "Bürstadt EKS",
                "latitude": 49.6425,
                "longitude": 8.4542,
                "heading": 85.0,
                "speed_kmh": 0.0,
                "status": "stopped",
                "stop_id": "stop-bst-marktplatz",
                "is_school_bus": True,
                "delay_sec": 60,
                "position_basis": "vrn_gtfs_rt",
            }
        ]
        result = await get_latest_bus_positions(self.pool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["line"], "642")
        self.assertTrue(result[0]["is_school_bus"])

    async def test_record_bus_positions(self):
        now = datetime.now(UTC)
        payload = RecordBusPositionsPayload(
            positions=[
                BusPositionRecord(
                    timestamp=now,
                    vehicle_id="bus-641-south",
                    trip_id="trip-2",
                    line="641",
                    origin="Bürstadt Bahnhof",
                    destination="Lampertheim Bahnhof",
                    latitude=49.6458,
                    longitude=8.4563,
                    heading=180.0,
                    speed_kmh=42.0,
                    status="moving",
                    is_school_bus=False,
                    delay_sec=0,
                    position_basis="model_prediction",
                )
            ]
        )
        res = await record_bus_positions(payload, self.pool, _token="valid-ingest")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["recorded"], 1)
        self.conn.execute.assert_called()


if __name__ == "__main__":
    unittest.main()
