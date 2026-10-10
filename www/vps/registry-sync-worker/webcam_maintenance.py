"""Retention and orphan cleanup using the same archive lock as acquisition."""

import os
import re
from datetime import UTC, datetime, timedelta

from webcam_snapshots import archive_config

LOCK = "webcam-snapshot-archive"


def retention_config():
    days = int(os.getenv("WEBCAM_RETENTION_DAYS", "14"))
    grace = int(os.getenv("WEBCAM_ORPHAN_GRACE_SECONDS", "86400"))
    if not 1 <= days <= 365 or not 3600 <= grace <= 604800:
        raise ValueError("Invalid webcam retention or orphan grace")
    return days, grace


def managed_file(root, path):
    """Delete only our filename formats, never symlinks or foreign files."""
    relative = path.relative_to(root)
    return (
        len(relative.parts) == 2
        and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", relative.parts[0])
        and not path.parent.is_symlink()
        and not path.is_symlink()
        and (
            re.fullmatch(r"[a-f0-9]{64}\.jpg", path.name)
            or path.name.startswith(".incoming-")
        )
    )


async def maintain_archive(conn, *, now=None):
    """Commit metadata removal before deleting unreferenced files.

    A crash/rollback therefore leaves extra files rather than dangling image
    references. A second locked transaction re-reads references before unlinking.
    The latest observation/image of each source survives even if expired.
    """
    root, _ = archive_config()
    days, grace = retention_config()
    now = now or datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    async with conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (LOCK,))
        expired = await conn.execute(
            """DELETE FROM webcam_snapshot_observations o
            WHERE observed_at < %s AND id NOT IN
            (SELECT DISTINCT ON (source_id) id FROM webcam_snapshot_observations
             ORDER BY source_id, id DESC) RETURNING id""",
            (cutoff,),
        )
        observations = len(await expired.fetchall())
        expired = await conn.execute(
            """DELETE FROM webcam_snapshot_images i WHERE NOT EXISTS
            (SELECT 1 FROM webcam_snapshot_observations o
             WHERE o.source_id=i.source_id AND o.sha256=i.sha256) RETURNING relative_path"""
        )
        images = len(await expired.fetchall())
    removed = 0
    removed_bytes = 0
    async with conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (LOCK,))
        cursor = await conn.execute("SELECT relative_path FROM webcam_snapshot_images")
        referenced = {row[0] for row in await cursor.fetchall()}
        # Retired and interrupted-write files must pass the orphan grace period.
        # Never unlink a file until its metadata deletion has committed.
        for path in root.glob("*/*"):
            if not managed_file(root, path) or not path.is_file():
                continue
            if path.relative_to(root).as_posix() in referenced:
                continue
            stat = path.stat()
            if stat.st_mtime > now.timestamp() - grace:
                continue
            path.unlink()
            removed += 1
            removed_bytes += stat.st_size
    return {
        "observations_deleted": observations,
        "images_deleted": images,
        "files_deleted": removed,
        "bytes_freed": removed_bytes,
    }
