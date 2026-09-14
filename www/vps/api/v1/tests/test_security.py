import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from dependencies import validate_api_keys, verify_admin_key, verify_ingestion_key
from endpoints.telemetry import get_telemetry_aggregates
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from psycopg.errors import QueryCanceled


class ApiKeyTests(unittest.TestCase):
    def test_missing_or_equal_admin_key_fails_closed(self):
        for admin in ("", "ingest"):
            with self.subTest(admin=admin), patch.dict(os.environ, {"API_KEY": "ingest", "ADMIN_API_KEY": admin}):
                with self.assertRaises(RuntimeError):
                    validate_api_keys()
                with self.assertRaises(HTTPException):
                    verify_admin_key(HTTPAuthorizationCredentials(scheme="Bearer", credentials="ingest"))

    def test_distinct_keys_have_separate_authority(self):
        with patch.dict(os.environ, {"API_KEY": "ingest", "ADMIN_API_KEY": "admin"}):
            validate_api_keys()
            ingest = HTTPAuthorizationCredentials(scheme="Bearer", credentials="ingest")
            admin = HTTPAuthorizationCredentials(scheme="Bearer", credentials="admin")
            self.assertEqual(verify_ingestion_key(ingest), "ingest")
            self.assertEqual(verify_admin_key(admin), "admin")
            with self.assertRaises(HTTPException):
                verify_admin_key(ingest)
            with self.assertRaises(HTTPException):
                verify_ingestion_key(admin)


class AggregateTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.start = datetime(2026, 1, 1, tzinfo=UTC)
        self.cursor = MagicMock()
        self.cursor.fetchall = AsyncMock(return_value=[])
        self.conn = MagicMock()
        self.conn.execute = AsyncMock(return_value=self.cursor)
        self.pool = MagicMock()
        self.pool.connection.return_value.__aenter__.return_value = self.conn

    async def query(self, days=1, interval="5 minutes"):
        return await get_telemetry_aggregates(
            sensor_id="station", interval=interval, start_time=self.start,
            end_time=self.start + timedelta(days=days), metric=None, pool=self.pool,
        )

    async def test_rejects_expensive_or_invalid_ranges_before_database(self):
        for days, interval in [(32, "1 day"), (-1, "1 hour"), (2, "1 minute"), (1, "invalid")]:
            with self.subTest(days=days, interval=interval), self.assertRaises(HTTPException) as error:
                await self.query(days, interval)
            self.assertEqual(error.exception.status_code, 400)
        self.pool.connection.assert_not_called()

    async def test_dashboard_and_coarse_month_queries_are_bounded(self):
        for days, interval in [(1, "5 minutes"), (31, "1 hour")]:
            self.assertEqual(await self.query(days, interval), [])
            self.assertIn("statement_timeout", self.conn.execute.call_args_list[-2].args[0])
            sql, params = self.conn.execute.call_args.args
            self.assertIn("LIMIT %s", sql)
            self.assertEqual(params[-1], 5001)

    async def test_refuses_truncated_multi_metric_response(self):
        self.cursor.fetchall.return_value = [{}] * 5001
        with self.assertRaises(HTTPException) as error:
            await self.query()
        self.assertEqual(error.exception.status_code, 422)

    async def test_timeout_has_generic_response(self):
        self.conn.execute.side_effect = [None, QueryCanceled("internal query details")]
        with self.assertRaises(HTTPException) as error:
            await self.query()
        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn("internal", error.exception.detail)
