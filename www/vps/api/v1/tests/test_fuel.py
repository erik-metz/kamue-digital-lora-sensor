import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from endpoints.fuel import fuel_snapshot
from fastapi import Response


class FuelApiTests(unittest.IsolatedAsyncioTestCase):
    async def read(self, row):
        cursor = MagicMock()
        cursor.fetchone = AsyncMock(return_value=row)
        conn = MagicMock()
        conn.execute = AsyncMock(return_value=cursor)
        pool = MagicMock()
        pool.connection.return_value.__aenter__.return_value = conn
        return await fuel_snapshot(Response(), pool)

    async def test_empty_before_first_collection(self):
        data = await self.read(None)
        self.assertTrue(data["stale"])
        self.assertEqual(data["stations"], [])

    async def test_stale_snapshot_preserved(self):
        data = await self.read({"fetched_at": datetime.now(UTC)-timedelta(minutes=20),
            "data": {"stations": [{"e5": 1789}]}})
        self.assertTrue(data["stale"])
        self.assertEqual(data["stations"][0]["e5"], 1789)

    async def test_fresh_and_future_snapshot(self):
        for minutes, expected in [(-5, False), (5, True)]:
            data = await self.read({"fetched_at": datetime.now(UTC)+timedelta(minutes=minutes), "data": {"stations": []}})
            self.assertEqual(data["stale"], expected)
