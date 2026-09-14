import os
import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import Settings
from main import fetch, fetch_dashboards, retry_after


class HttpTests(unittest.IsolatedAsyncioTestCase):
    async def test_json_fetch(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, json={"panels": []})
        )
        async with httpx.AsyncClient(transport=transport) as client:
            self.assertEqual(await fetch(client, "https://example.org"), {"panels": []})

    async def test_failure_preserves_retry_after(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(429, headers={"Retry-After": "120"})
        )
        async with httpx.AsyncClient(transport=transport) as client:
            with self.assertRaises(httpx.HTTPStatusError) as raised:
                await fetch(client, "https://example.org")
            self.assertEqual(raised.exception.response.headers["Retry-After"], "120")

    async def test_bounded_response(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=b" " * 100)
        )
        with patch("main.MAX_BYTES", 10):
            async with httpx.AsyncClient(transport=transport) as client:
                with self.assertRaises(ValueError):
                    await fetch(client, "https://example.org")

    async def test_default_dashboard_bundle_has_four_sources_and_provenance(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings.from_env()
        requests = []

        def respond(request):
            requests.append(str(request.url))
            return httpx.Response(200, json={"panels": []})

        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            payloads = await fetch_dashboards(client, settings)
        self.assertEqual(len(requests), 4)
        self.assertEqual([p["_collector_source_url"] for p in payloads], requests)

    def test_retry_after_seconds_and_date(self):
        now = datetime(2026, 9, 14, 7, tzinfo=UTC)
        self.assertEqual(retry_after("120", now), 120)
        self.assertEqual(retry_after("Mon, 14 Sep 2026 07:02:00 GMT", now), 120)
        self.assertEqual(retry_after("invalid", now), 0)

    def test_configuration_validation(self):
        for variables in [
            {"SMARTCITY_POLL_SECONDS": "0"},
            {"SMARTCITY_METRICS": "typo"},
            {"SMARTCITY_BASE_URL": "http://example.org"},
            {"SMARTCITY_DASHBOARD_ID": "bad"},
        ]:
            with (
                self.subTest(variables=variables),
                patch.dict(os.environ, variables, clear=True),
                self.assertRaises(ValueError),
            ):
                Settings.from_env()


if __name__ == "__main__":
    unittest.main()
