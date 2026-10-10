"""Snapshot acquisition -> real disk -> real Postgres, without provider requests."""

import io
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import httpx
import psycopg
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))
from db_support import DatabaseCase
from webcam_snapshots import (
    InvalidSnapshot,
    decode,
    import_webcam_snapshot,
    validate_source,
    write_image,
)

SOURCE = {
    "id": "test-webcam",
    "adapter": "webcam-snapshot",
    "url": "https://example.org/camera.jpg",
    "interval_seconds": 60,
    "http_retries": 0,
}


def jpeg(color="red"):
    file = io.BytesIO()
    Image.new("RGB", (64, 48), color).save(file, "JPEG")
    return file.getvalue()


@pytest.mark.parametrize(
    "changes",
    [
        {"id": "../escape"},
        {"url": "http://example.org/cam.jpg"},
        {"url": "https://user:pass@example.org/cam.jpg"},
        {"interval_seconds": 10},
        {"max_response_bytes": 6_000_000},
        {"max_pixels": 0},
        {"http_retries": 3},
        {"stale_after_seconds": 0},
    ],
)
def test_invalid_source(changes):
    with pytest.raises(ValueError):
        validate_source({**SOURCE, **changes})


def test_runtime_manifest_matches_selection():
    from runner import sources

    selected = [s for s in sources() if s["adapter"] == "webcam-snapshot"]
    proposal = json.loads(
        (
            Path(__file__).resolve().parents[4] / "docs/webcams/sources.proposed.json"
        ).read_text()
    )
    assert {s["id"] for s in selected} == {s["id"] for s in proposal["sources"]}
    assert len(selected) == 4 and all(not s["enabled"] for s in selected)
    for source in selected:
        validate_source(source)


def test_decode_and_pixel_limit():
    assert decode(jpeg(), 3072) == (64, 48)
    with pytest.raises(InvalidSnapshot):
        decode(jpeg(), 3071)
    with pytest.raises(InvalidSnapshot):
        decode(jpeg()[:100], 3072)


def test_failed_atomic_write_leaves_no_files(tmp_path):
    with (
        patch("webcam_snapshots.os.replace", side_effect=OSError("disk failure")),
        pytest.raises(OSError),
    ):
        write_image(tmp_path, "test/image.jpg", jpeg(), 5000000)
    assert not [p for p in tmp_path.rglob("*") if p.is_file()]


class SnapshotDatabaseHarness(DatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.environment = patch.dict(
            "os.environ",
            {
                "WEBCAM_ARCHIVE_DIR": str(self.root),
                "WEBCAM_ARCHIVE_MAX_BYTES": "5000000",
            },
        )
        self.environment.start()
        await self.conn.execute(
            "INSERT INTO collection_sources(id,source_url,adapter,enabled,interval_seconds) VALUES (%s,%s,'webcam-snapshot',true,60)",
            (SOURCE["id"], SOURCE["url"]),
        )
        # Real collector connections run in transactions, not harness autocommit.
        self.connection = await psycopg.AsyncConnection.connect(**self.db)

    async def asyncTearDown(self):
        if hasattr(self, "connection"):
            await self.connection.close()
            self.environment.stop()
            self.temporary.cleanup()
        await super().asyncTearDown()

    async def run_response(self, response, source=None):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: response)
        ) as client:
            return await import_webcam_snapshot(
                self.connection, client, source or SOURCE
            )


class SnapshotDatabaseTests(SnapshotDatabaseHarness):
    async def test_persist_duplicate_changed_and_conditional(self):
        requests = []
        body = jpeg()

        def handler(request):
            requests.append(request)
            if len(requests) == 3:
                assert request.headers["if-none-match"] == '"one"'
                return httpx.Response(304)
            return httpx.Response(
                200,
                content=body if len(requests) < 4 else jpeg("blue"),
                headers={
                    "Content-Type": "image/jpeg",
                    "ETag": '"one"',
                    "Last-Modified": "Sat, 10 Oct 2026 12:00:00 GMT",
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            for _ in range(4):
                assert (
                    await import_webcam_snapshot(self.connection, client, SOURCE)
                    == "success"
                )
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 2
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 4
        )
        assert (
            await self.scalar(
                "SELECT count(*) FROM webcam_snapshot_observations WHERE capture_time IS NOT NULL"
            )
            == 0
        )
        assert (
            await self.scalar(
                "SELECT sum(item_count) FROM collection_attempts WHERE status='success'"
            )
            == 2
        )
        assert await self.scalar("SELECT count(*) FROM collected_payloads") == 0
        paths = await (
            await self.conn.execute("SELECT relative_path FROM webcam_snapshot_images")
        ).fetchall()
        assert sorted((self.root / row[0]).read_bytes() for row in paths) == sorted(
            [body, jpeg("blue")]
        )

    async def test_invalid_responses_preserve_previous(self):
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        for response in [
            httpx.Response(
                200,
                content=b"<html>error</html>",
                headers={"Content-Type": "text/html"},
            ),
            httpx.Response(
                200, content=jpeg()[:100], headers={"Content-Type": "image/jpeg"}
            ),
            httpx.Response(
                200, content=b"x" * 1025, headers={"Content-Type": "image/jpeg"}
            ),
            httpx.Response(302, headers={"Location": "https://example.net/other.jpg"}),
        ]:
            with self.assertRaises((InvalidSnapshot, httpx.HTTPStatusError)):
                await self.run_response(
                    response, {**SOURCE, "max_response_bytes": 1024}
                )
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 1
        )
        assert len(list(self.root.rglob("*.jpg"))) == 1

    async def test_quota_and_db_failure_do_not_publish(self):
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        with (
            patch.dict("os.environ", {"WEBCAM_ARCHIVE_MAX_BYTES": "1024"}),
            self.assertRaises(OSError),
        ):
            await self.run_response(
                httpx.Response(
                    200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
                )
            )
        await self.conn.execute("""CREATE FUNCTION reject_webcam_observation() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'simulated DB failure'; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER reject_webcam BEFORE INSERT ON webcam_snapshot_observations
            FOR EACH ROW EXECUTE FUNCTION reject_webcam_observation()""")
        with self.assertRaises(psycopg.Error):
            await self.run_response(
                httpx.Response(
                    200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
                )
            )
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 1
        )
        assert len(list(self.root.rglob("*.jpg"))) == 1
        assert not list(self.root.rglob(".incoming-*"))

    async def test_missing_file_is_repaired_without_conditional_request(self):
        await self.run_response(
            httpx.Response(
                200,
                content=jpeg(),
                headers={"Content-Type": "image/jpeg", "ETag": '"old"'},
            )
        )
        next(self.root.rglob("*.jpg")).unlink()

        def handler(request):
            assert "if-none-match" not in request.headers
            return httpx.Response(
                200, content=jpeg(), headers={"Content-Type": "image/jpeg"}
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await import_webcam_snapshot(self.connection, client, SOURCE)
        assert len(list(self.root.rglob("*.jpg"))) == 1
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 2
        )

    async def test_timeout_recorded_by_runner_and_last_image_preserved(self):
        from config import Settings
        from runner import collect

        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )

        def timeout(request):
            raise httpx.ReadTimeout("simulated timeout", request=request)

        client = httpx.AsyncClient(transport=httpx.MockTransport(timeout))
        with patch("runner.httpx.AsyncClient", return_value=client):
            result = await collect(
                {**SOURCE, "enabled": True}, Settings(db=self.db, state_dir=self.root)
            )
        assert result["status"] == "failed"
        assert (
            await self.scalar(
                "SELECT count(*) FROM collection_attempts WHERE status='failed' AND error_stage='acquisition'"
            )
            == 1
        )
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1

    async def test_transient_bad_image_retried(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(
                200,
                content=b"bad" if len(calls) == 1 else jpeg(),
                headers={"Content-Type": "image/jpeg"},
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await import_webcam_snapshot(
                self.connection, client, {**SOURCE, "http_retries": 1}
            )
        assert len(calls) == 2
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1


class MaintenanceDatabaseTests(SnapshotDatabaseHarness):
    async def test_retention_preserves_latest_and_shared_images(self):
        import os
        from datetime import UTC, datetime, timedelta

        from webcam_maintenance import maintain_archive

        now = datetime.now(UTC)
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.run_response(
            httpx.Response(
                200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
            )
        )
        await self.conn.execute(
            "UPDATE webcam_snapshot_observations SET observed_at=%s",
            (now - timedelta(days=30),),
        )
        for path in self.root.rglob("*.jpg"):
            os.utime(path, (now.timestamp() - 30 * 86400,) * 2)
        result = await maintain_archive(self.connection, now=now)
        assert result == {
            "observations_deleted": 2,
            "images_deleted": 1,
            "files_deleted": 1,
            "bytes_freed": len(jpeg()),
        }
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 1
        )
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1
        assert next(self.root.rglob("*.jpg")).read_bytes() == jpeg("blue")
        # Acquisition audit is deliberately retained separately.
        assert await self.scalar("SELECT count(*) FROM collection_attempts") == 3
        assert await maintain_archive(self.connection, now=now) == {
            "observations_deleted": 0,
            "images_deleted": 0,
            "files_deleted": 0,
            "bytes_freed": 0,
        }

    async def test_orphan_grace_foreign_files_and_symlinks(self):
        import os
        from datetime import UTC, datetime

        from webcam_maintenance import maintain_archive

        now = datetime.now(UTC)
        directory = self.root / SOURCE["id"]
        directory.mkdir()
        old = directory / ("a" * 64 + ".jpg")
        recent = directory / ("b" * 64 + ".jpg")
        temporary = directory / ".incoming-interrupted"
        foreign = directory / "keep.txt"
        linked = directory / ("c" * 64 + ".jpg")
        for path in (old, recent, temporary, foreign):
            path.write_bytes(b"test")
        linked.symlink_to(foreign)
        for path in (old, temporary, foreign):
            os.utime(path, (now.timestamp() - 90000,) * 2)
        result = await maintain_archive(self.connection, now=now)
        assert result["files_deleted"] == 2 and result["bytes_freed"] == 8
        assert recent.exists() and foreign.exists() and linked.is_symlink()

    async def test_cleanup_rollback_preserves_files_and_observations(self):
        from datetime import UTC, datetime, timedelta

        from webcam_maintenance import maintain_archive

        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.run_response(
            httpx.Response(
                200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
            )
        )
        await self.conn.execute(
            "UPDATE webcam_snapshot_observations SET observed_at=%s",
            (datetime.now(UTC) - timedelta(days=30),),
        )
        await self.conn.execute("""CREATE FUNCTION reject_webcam_delete() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'simulated deletion failure'; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER reject_webcam_delete BEFORE DELETE ON webcam_snapshot_images
            FOR EACH ROW EXECUTE FUNCTION reject_webcam_delete()""")
        with self.assertRaises(psycopg.Error):
            await maintain_archive(self.connection)
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 2
        )
        assert len(list(self.root.rglob("*.jpg"))) == 2

    async def test_failed_unlink_is_recovered_next_cycle(self):
        import os
        from datetime import UTC, datetime, timedelta

        from webcam_maintenance import maintain_archive

        now = datetime.now(UTC)
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.run_response(
            httpx.Response(
                200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
            )
        )
        await self.conn.execute(
            "UPDATE webcam_snapshot_observations SET observed_at=%s",
            (now - timedelta(days=30),),
        )
        for path in self.root.rglob("*.jpg"):
            os.utime(path, (now.timestamp() - 90000,) * 2)
        with (
            patch("pathlib.Path.unlink", side_effect=OSError("disk unavailable")),
            self.assertRaises(OSError),
        ):
            await maintain_archive(self.connection, now=now)
        assert await self.scalar("SELECT count(*) FROM webcam_snapshot_images") == 1
        assert len(list(self.root.rglob("*.jpg"))) == 2
        assert (await maintain_archive(self.connection, now=now))["files_deleted"] == 1

    async def test_retention_keeps_images_referenced_by_recent_observations(self):
        from datetime import UTC, datetime, timedelta

        from webcam_maintenance import maintain_archive

        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.conn.execute(
            "UPDATE webcam_snapshot_observations SET observed_at=%s WHERE id=(SELECT min(id) FROM webcam_snapshot_observations)",
            (datetime.now(UTC) - timedelta(days=30),),
        )
        result = await maintain_archive(self.connection)
        assert result["observations_deleted"] == 1
        assert result["images_deleted"] == result["files_deleted"] == 0
        assert len(list(self.root.rglob("*.jpg"))) == 1

    async def test_maintenance_waits_for_acquisition_archive_lock(self):
        import asyncio

        from webcam_maintenance import maintain_archive

        async with await psycopg.AsyncConnection.connect(**self.db) as writer:
            await writer.execute(
                "SELECT pg_advisory_xact_lock(hashtext('webcam-snapshot-archive'))"
            )
            task = asyncio.create_task(maintain_archive(self.connection))
            try:
                await asyncio.sleep(0.05)
                assert not task.done()
                await writer.commit()
                result = await asyncio.wait_for(task, 5)
                assert result["files_deleted"] == 0
            finally:
                if not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)

    async def test_upgrade_migration_is_repeatable_with_existing_data(self):
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        await self.conn.execute("""ALTER TABLE webcam_snapshot_observations
            DROP COLUMN unchanged_since, DROP COLUMN unchanged_observations, DROP COLUMN quality_status""")
        migration = (
            Path(__file__).resolve().parents[2]
            / "api/v1/migrations/20261010_webcam_retention.sql"
        ).read_text()
        await self.conn.execute(migration)
        await self.conn.execute(migration)
        assert (
            await self.scalar("SELECT count(*) FROM webcam_snapshot_observations") == 1
        )
        await self.run_response(
            httpx.Response(200, content=jpeg(), headers={"Content-Type": "image/jpeg"})
        )
        assert (
            await self.scalar(
                "SELECT quality_status FROM webcam_snapshot_observations ORDER BY id DESC LIMIT 1"
            )
            == "unchanged"
        )

    async def test_stale_state_is_persisted_and_image_change_resets(self):
        from datetime import UTC, datetime, timedelta

        now = datetime.now(UTC)
        await self.run_response(
            httpx.Response(
                200,
                content=jpeg(),
                headers={"Content-Type": "image/jpeg", "ETag": '"one"'},
            )
        )
        await self.conn.execute(
            """UPDATE webcam_snapshot_observations SET
            observed_at=%s, unchanged_since=%s, unchanged_observations=30""",
            (now - timedelta(seconds=60), now - timedelta(seconds=1800)),
        )
        await self.run_response(httpx.Response(304))
        assert (
            await self.scalar(
                "SELECT quality_status FROM webcam_snapshot_observations ORDER BY id DESC LIMIT 1"
            )
            == "suspected_stale"
        )
        assert (
            await self.scalar(
                "SELECT unchanged_observations FROM webcam_snapshot_observations ORDER BY id DESC LIMIT 1"
            )
            == 31
        )
        await self.run_response(
            httpx.Response(
                200, content=jpeg("blue"), headers={"Content-Type": "image/jpeg"}
            )
        )
        assert (
            await self.scalar(
                "SELECT quality_status FROM webcam_snapshot_observations ORDER BY id DESC LIMIT 1"
            )
            == "fresh"
        )
        assert (
            await self.scalar(
                "SELECT unchanged_observations FROM webcam_snapshot_observations ORDER BY id DESC LIMIT 1"
            )
            == 1
        )


def test_stale_evidence_requires_continuity_and_time():
    from datetime import UTC, datetime, timedelta

    from webcam_snapshots import observation_quality

    now = datetime.now(UTC)
    previous = (
        "hash",
        "path",
        None,
        None,
        now - timedelta(seconds=60),
        now - timedelta(seconds=1800),
        30,
    )
    assert observation_quality(previous, "hash", now, SOURCE)[2] == "suspected_stale"
    assert observation_quality(previous, "different", now, SOURCE) == (now, 1, "fresh")
    # Long outages and clock reversal break the sequence.
    assert (
        observation_quality(previous, "hash", now + timedelta(hours=2), SOURCE)[2]
        == "fresh"
    )
    assert (
        observation_quality(previous, "hash", now - timedelta(minutes=2), SOURCE)[2]
        == "fresh"
    )
    short = (*previous[:5], now - timedelta(seconds=120), 2)
    assert observation_quality(short, "hash", now, SOURCE)[2] == "unchanged"


@pytest.mark.parametrize(
    "values",
    [
        {"WEBCAM_RETENTION_DAYS": "0"},
        {"WEBCAM_RETENTION_DAYS": "366"},
        {"WEBCAM_ORPHAN_GRACE_SECONDS": "0"},
        {"WEBCAM_ORPHAN_GRACE_SECONDS": "604801"},
    ],
)
def test_invalid_retention_configuration(values):
    from webcam_maintenance import retention_config

    with patch.dict("os.environ", values), pytest.raises(ValueError):
        retention_config()
