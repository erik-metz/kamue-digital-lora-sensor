import unittest
from datetime import date, datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock

from endpoints.waste_trucks import (
    RecordWasteTruckPositionsPayload,
    WasteCalendarRecord,
    WasteTruckPositionRecord,
    get_collection_calendar,
    get_latest_positions,
    import_collection_calendar,
    list_waste_facilities,
    list_waste_fleet,
    record_waste_truck_positions,
)


class WasteTrucksTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def test_list_waste_facilities(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "zakb-buerstadt",
                "name": "ZAKB Wertstoffhof Bürstadt",
                "facility_type": "recycling_yard",
                "municipality": "Bürstadt",
                "address": "Zur Biogasanlage 1",
                "latitude": 49.6382,
                "longitude": 8.4485,
                "accepted_fractions": ["restmuell", "biomuell"],
            }
        ]
        result = await list_waste_facilities(self.pool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "ZAKB Wertstoffhof Bürstadt")
        self.assertEqual(result[0]["municipality"], "Bürstadt")

    async def test_list_waste_fleet(self):
        self.cursor.fetchall.return_value = [
            {
                "id": "tour-bst-restmuell",
                "license_plate": "HP-ZK 102",
                "vehicle_model": "Mercedes-Benz Econic",
                "assigned_fraction": "restmuell",
                "assigned_municipality": "Bürstadt",
                "capacity_m3": 22.0,
                "is_active": True,
            }
        ]
        result = await list_waste_fleet(self.pool, active_only=True)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["license_plate"], "HP-ZK 102")

    async def test_get_collection_calendar(self):
        self.cursor.fetchall.return_value = [
            {
                "municipality": "Bürstadt",
                "district": "Kernstadt",
                "street_name": "Nibelungenstraße",
                "fraction": "restmuell",
                "collection_date": date(2026, 9, 15),
                "expected_time_start": time(7, 30),
                "expected_time_end": time(8, 30),
                "tour_code": "BST-R01",
                "source": "zakb_abfuhrkalender",
            }
        ]
        result = await get_collection_calendar(
            self.pool,
            municipality="Bürstadt",
            street_name="Nibelungenstraße",
            from_date=date(2026, 9, 1),
            to_date=date(2026, 9, 30),
            fraction="restmuell",
            limit=50,
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["street_name"], "Nibelungenstraße")
        self.assertEqual(result[0]["fraction"], "restmuell")

    async def test_import_collection_calendar(self):
        items = [
            WasteCalendarRecord(
                municipality="Bürstadt",
                district="Kernstadt",
                street_name="Mainstraße",
                fraction="restmuell",
                collection_date=date(2026, 9, 16),
                expected_time_start=time(8, 30),
                expected_time_end=time(9, 30),
                tour_code="BST-R01",
            )
        ]
        res = await import_collection_calendar(items, self.pool, _token="valid-admin")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["imported"], 1)
        self.conn.execute.assert_called()

    async def test_get_latest_positions(self):
        now = datetime.now(timezone.utc)
        self.cursor.fetchall.return_value = [
            {
                "timestamp": now,
                "truck_id": "tour-bst-restmuell",
                "tour_code": "BST-R01",
                "fraction": "restmuell",
                "latitude": 49.6465,
                "longitude": 8.4552,
                "heading": 90.0,
                "speed_kmh": 14.0,
                "status": "collecting",
                "current_street": "Mainstraße",
                "next_street": "Wilhelminenstraße",
                "load_percent": 35,
                "empty_countdown_sec": None,
                "position_basis": "model_prediction",
            }
        ]
        result = await get_latest_positions(self.pool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["truck_id"], "tour-bst-restmuell")
        self.assertEqual(result[0]["status"], "collecting")

    async def test_record_waste_truck_positions(self):
        now = datetime.now(timezone.utc)
        payload = RecordWasteTruckPositionsPayload(
            positions=[
                WasteTruckPositionRecord(
                    timestamp=now,
                    truck_id="tour-la-biomuell",
                    tour_code="LA-B02",
                    fraction="biomuell",
                    latitude=49.5940,
                    longitude=8.4670,
                    heading=45.0,
                    speed_kmh=0.0,
                    status="bin_emptying",
                    current_street="Kaiserstraße",
                    next_street="Ernst-Ludwig-Straße",
                    load_percent": 60,
                    empty_countdown_sec=25,
                    position_basis="model_prediction",
                )
            ]
        )
        res = await record_waste_truck_positions(payload, self.pool, _token="valid-ingest")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["recorded"], 1)
        self.conn.execute.assert_called()


if __name__ == "__main__":
    unittest.main()
