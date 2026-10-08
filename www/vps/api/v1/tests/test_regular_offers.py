import json
import unittest
from datetime import UTC, datetime, timedelta

from endpoints.collected import dataset_publication
from fastapi import HTTPException
from test_collected import pool_for, request


def row(source, suffix, expires, offer):
    return {
        "dataset": "social/regular-offers" + suffix,
        "source_id": source,
        "expires_at": expires,
        "source_updated_at": datetime.now(UTC),
        "fetched_at": datetime.now(UTC),
        "data": [{"id": offer, "municipality": "Bürstadt"}],
    }


class RegularOfferEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_transition_deduplicates_and_retains_other_source(self):
        now = datetime.now(UTC)
        rows = [
            row("gross", "", now + timedelta(days=1), "legacy"),
            row("buerstadt", "/buerstadt", now + timedelta(minutes=1), "tuesday"),
            row("gross", "/gross", now + timedelta(days=1), "wednesday"),
        ]
        pool, _ = pool_for(rows=rows)
        result = await dataset_publication("social/regular-offers", request(), pool)
        self.assertEqual(
            [o["id"] for o in json.loads(result.body)], ["tuesday", "wednesday"]
        )
        self.assertEqual(result.headers["x-data-source"], "buerstadt,gross")
        self.assertLessEqual(
            int(result.headers["cache-control"].split("max-age=")[1].split(",")[0]), 60
        )

    async def test_expired_source_does_not_hide_fresh_source_or_resurrect_legacy(self):
        now = datetime.now(UTC)
        rows = [
            row("gross", "", now + timedelta(days=1), "legacy"),
            row("gross", "/gross", now - timedelta(seconds=1), "expired"),
            row("buerstadt", "/buerstadt", now + timedelta(days=1), "tuesday"),
        ]
        pool, _ = pool_for(rows=rows)
        result = await dataset_publication("social/regular-offers", request(), pool)
        self.assertEqual([o["id"] for o in json.loads(result.body)], ["tuesday"])
        self.assertEqual(result.headers["x-data-source"], "buerstadt")

    async def test_all_expired_is_unavailable(self):
        pool, _ = pool_for(
            rows=[
                row(
                    "gross",
                    "/gross",
                    datetime.now(UTC) - timedelta(seconds=1),
                    "expired",
                )
            ]
        )
        with self.assertRaises(HTTPException) as error:
            await dataset_publication("social/regular-offers", request(), pool)
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.headers["Cache-Control"], "no-store")
