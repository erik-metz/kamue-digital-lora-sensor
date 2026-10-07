"""HTTP access and response parsing failures retain their own source evidence."""

import httpx
from config import Settings
from db_support import DatabaseCase
from source import fetch


class SourceStatusTests(DatabaseCase):
    async def test_optional_http_denial_is_recorded_without_hiding_core_downloads(self):
        settings = Settings(
            db={},
            enable_blitzortung=True,
            enable_radolan=False,
            blitzortung_url="https://example.org/lightning",
        )

        def handler(request):
            return (
                httpx.Response(401)
                if request.url.path == "/lightning"
                else httpx.Response(200, json={})
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            payload = await fetch(client, settings, self.conn)
        self.assertIn("pegel_attempt_id", payload)
        self.assertTrue(
            await self.scalar(
                "SELECT enabled FROM collection_sources WHERE id='environment-blitzortung'"
            )
        )
        self.assertFalse(
            await self.scalar(
                "SELECT enabled FROM collection_sources WHERE id='environment-radolan'"
            )
        )
        self.assertEqual(
            await self.scalar(
                "SELECT interval_seconds FROM collection_sources WHERE id='environment-weather'"
            ),
            settings.poll_seconds,
        )
        row = await (
            await self.conn.execute(
                "SELECT status,http_status,error,error_stage,processed_at FROM collection_attempts WHERE source_id='environment-blitzortung'"
            )
        ).fetchone()
        self.assertEqual(row, ("failed", 401, "HTTP 401", "acquisition", None))

    async def test_required_failure_does_not_leave_prior_download_running(self):
        settings = Settings(db={}, weather_url="https://example.org/weather")

        def handler(request):
            return (
                httpx.Response(503)
                if request.url.path == "/weather"
                else httpx.Response(200, json={})
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(httpx.HTTPStatusError):
                await fetch(client, settings, self.conn)
        self.assertEqual(
            await self.scalar(
                "SELECT status FROM collection_attempts WHERE source_id='environment-pegel'"
            ),
            "failed",
        )
        self.assertEqual(
            await self.scalar(
                "SELECT error_stage FROM collection_attempts WHERE source_id='environment-weather'"
            ),
            "acquisition",
        )

    async def test_invalid_json_is_processing_failure_after_successful_download(self):
        settings = Settings(db={})
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, content=b"not-json")
            )
        ) as client:
            with self.assertRaises(ValueError):
                await fetch(client, settings, self.conn)
        row = await (
            await self.conn.execute(
                "SELECT status,error_stage,fetched_at,processed_at FROM collection_attempts"
            )
        ).fetchone()
        self.assertEqual(row[:2], ("failed", "processing"))
        self.assertIsNotNone(row[2])
        self.assertIsNone(row[3])
