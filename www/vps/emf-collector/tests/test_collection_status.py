"""Completed imports and failures must have durable, separate evidence."""

from types import SimpleNamespace

import httpx
import psycopg
from collection_status import fail, finish, received, start
from db_support import DatabaseCase


class CollectionStatusTests(DatabaseCase):
    async def test_success_and_failure_evidence(self):
        settings = SimpleNamespace(db=self.db)
        attempt = await start(settings, "bnetza-emf")
        self.assertEqual(
            await self.scalar(
                "SELECT status FROM collection_attempts WHERE id=%s", (attempt,)
            ),
            "running",
        )
        await received(settings, attempt)
        self.assertIsNone(
            await self.scalar(
                "SELECT processed_at FROM collection_attempts WHERE id=%s", (attempt,)
            )
        )
        await finish(settings, attempt, 12, "items")
        row = await (
            await self.conn.execute(
                "SELECT status,item_count,processed_at,fetched_at FROM collection_attempts WHERE id=%s",
                (attempt,),
            )
        ).fetchone()
        self.assertEqual(row[:2], ("success", 12))
        self.assertIsNotNone(row[2])
        self.assertIsNotNone(row[3])
        failed = await start(settings, "bnetza-emf")
        await fail(
            settings, failed, psycopg.errors.ForeignKeyViolation("private details")
        )
        row = await (
            await self.conn.execute(
                "SELECT status,error,error_stage,processed_at FROM collection_attempts WHERE id=%s",
                (failed,),
            )
        ).fetchone()
        self.assertEqual(row, ("failed", "ForeignKeyViolation", "storage", None))

    async def test_partial_details_and_http_denial(self):
        settings = SimpleNamespace(db=self.db)
        attempt = await start(settings, "bnetza-emf")
        await received(settings, attempt)
        await finish(
            settings, attempt, 3, "sites", partial_error="1 site detail request failed"
        )
        self.assertEqual(
            await self.scalar(
                "SELECT status FROM collection_attempts WHERE id=%s", (attempt,)
            ),
            "partial",
        )
        denied = await start(settings, "bnetza-emf")
        response = httpx.Response(
            401, request=httpx.Request("GET", "https://example.org/?secret=hidden")
        )
        await fail(
            settings,
            denied,
            httpx.HTTPStatusError(
                "secret", request=response.request, response=response
            ),
        )
        row = await (
            await self.conn.execute(
                "SELECT http_status,error,error_stage FROM collection_attempts WHERE id=%s",
                (denied,),
            )
        ).fetchone()
        self.assertEqual(row, (401, "HTTPStatusError", "acquisition"))

    async def test_cycle_failure_never_claims_completed_processing(self):
        from unittest.mock import AsyncMock, patch

        from main import poll_cycle

        settings = SimpleNamespace(db=self.db)
        with (
            patch(
                "main._poll_cycle",
                new=AsyncMock(
                    side_effect=psycopg.errors.ForeignKeyViolation("private")
                ),
            ),
            self.assertRaises(psycopg.errors.ForeignKeyViolation),
        ):
            await poll_cycle(None, settings)
        row = await (
            await self.conn.execute(
                "SELECT status,error_stage,processed_at FROM collection_attempts ORDER BY id DESC LIMIT 1"
            )
        ).fetchone()
        self.assertEqual(row, ("failed", "storage", None))
        before = await self.scalar("SELECT COUNT(*) FROM collection_attempts")
        with patch(
            "main._poll_cycle", new=AsyncMock(return_value={"status": "dry_run"})
        ):
            await poll_cycle(None, settings, dry_run=True)
        self.assertEqual(
            await self.scalar("SELECT COUNT(*) FROM collection_attempts"), before
        )
