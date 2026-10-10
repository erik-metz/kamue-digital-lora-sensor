"""Bounded JPEG snapshots on persistent disk; observations and identity in Postgres."""

import asyncio
import hashlib
import io
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from PIL import Image, UnidentifiedImageError


class InvalidSnapshot(ValueError):
    """The provider returned no complete, supported image."""


def validate_source(source):
    target = urlsplit(source.get("url", ""))
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", source["id"]):
        raise ValueError("Invalid snapshot source ID")
    if (
        target.scheme not in {"http", "https"}
        or not target.hostname
        or target.username
        or target.password
        or target.fragment
    ):
        raise ValueError("Invalid snapshot URL")
    if target.scheme == "http" and not source.get("allow_http", False):
        raise ValueError("Snapshot HTTP requires explicit source configuration")
    for key, low, high, default in [
        ("interval_seconds", 60, 86400, 300),
        ("timeout_seconds", 1, 60, 15),
        ("max_response_bytes", 1024, 5_000_000, 5_000_000),
        ("max_pixels", 1, 20_000_000, 20_000_000),
        ("http_retries", 0, 2, 1),
        (
            "stale_after_seconds",
            180,
            604800,
            max(1800, 3 * source.get("interval_seconds", 300)),
        ),
    ]:
        value = source.get(key, default)
        if type(value) is not int or not low <= value <= high:
            raise ValueError(f"Invalid snapshot {key}")


def archive_config():
    # Dedicated directory: quotas include orphan files from an interrupted write.
    root = Path(os.getenv("WEBCAM_ARCHIVE_DIR", "/data/webcam-snapshots")).resolve()
    quota = int(os.getenv("WEBCAM_ARCHIVE_MAX_BYTES", "5000000000"))
    if quota < 1024:
        raise ValueError("Invalid snapshot archive quota")
    return root, quota


def decode(body, max_pixels):
    try:
        with Image.open(io.BytesIO(body)) as image:
            if image.format != "JPEG" or image.width * image.height > max_pixels:
                raise InvalidSnapshot("Unsupported image or pixel limit exceeded")
            image.load()  # Strict decoder: do not allow truncated JPEGs.
            return image.width, image.height
    except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise InvalidSnapshot("Incomplete or invalid JPEG") from exc


def write_image(root, relative, body, quota):
    """Atomic publish. Called while the shared Postgres archive lock is held."""
    root.mkdir(parents=True, exist_ok=True)
    target = root / relative
    if target.is_file():
        if (
            hashlib.sha256(target.read_bytes()).digest()
            == hashlib.sha256(body).digest()
        ):
            return False
        raise OSError("Existing snapshot file has different content")
    used = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
    if used + len(body) > quota:
        raise OSError("Snapshot archive quota exceeded")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    published = False
    try:
        with tempfile.NamedTemporaryFile(
            dir=target.parent, prefix=".incoming-", delete=False
        ) as file:
            temporary = Path(file.name)
            file.write(body)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, target)
        temporary = None
        published = True
        directory = os.open(target.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return True
    except BaseException:
        if published:
            target.unlink(missing_ok=True)
        raise
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


async def fetch(client, source, headers):
    limit = source.get("max_response_bytes", 5_000_000)
    async with client.stream(
        "GET",
        source["url"],
        headers=headers,
        follow_redirects=False,
        timeout=source.get("timeout_seconds", 15),
    ) as response:
        if response.status_code == 304:
            return response, None, None
        response.raise_for_status()  # Redirects are errors too; never follow camera moves.
        if response.status_code != 200:
            raise InvalidSnapshot("Snapshot requires HTTP 200")
        if (
            response.headers.get("content-type", "").split(";")[0].strip().lower()
            != "image/jpeg"
        ):
            raise InvalidSnapshot("Snapshot response is not image/jpeg")
        body = bytearray()
        async for chunk in response.aiter_bytes(65536):
            if len(body) + len(chunk) > limit:
                raise InvalidSnapshot("Snapshot response exceeds byte limit")
            body.extend(chunk)
    body = bytes(body)
    dimensions = await asyncio.to_thread(
        decode, body, source.get("max_pixels", 20_000_000)
    )
    return response, body, dimensions


def observation_quality(previous, digest, observed, source):
    """Byte-identical responses indicate suspected staleness, never proof."""
    interval = source.get("interval_seconds", 300)
    # Gaps break the evidence chain; no claim about images during failed fetches.
    continuous = previous and 0 <= (observed - previous[4]).total_seconds() <= max(
        900, interval * 3
    )
    if continuous and previous[0] == digest:
        since = previous[5] or previous[4]
        count = previous[6] + 1
        threshold = max(
            source.get("stale_after_seconds", max(1800, interval * 3)), interval * 3
        )
        status = (
            "suspected_stale"
            if count >= 3 and (observed - since).total_seconds() >= threshold
            else "unchanged"
        )
        return since, count, status
    return observed, 1, "fresh"


async def import_webcam_snapshot(conn, client, source):
    validate_source(source)
    root, quota = archive_config()
    cursor = await conn.execute(
        """SELECT o.sha256, i.relative_path, o.etag, o.last_modified,
        o.observed_at, o.unchanged_since, o.unchanged_observations
        FROM webcam_snapshot_observations o JOIN webcam_snapshot_images i
        USING (source_id, sha256) WHERE o.source_id=%s ORDER BY o.id DESC LIMIT 1""",
        (source["id"],),
    )
    previous = await cursor.fetchone()
    await conn.commit()
    headers = {}
    if previous and (root / previous[1]).is_file():
        if previous[2]:
            headers["If-None-Match"] = previous[2]
        if previous[3]:
            headers["If-Modified-Since"] = previous[3]
    for attempt in range(source.get("http_retries", 1) + 1):
        try:
            async with asyncio.timeout(source.get("timeout_seconds", 15) * 2):
                response, body, dimensions = await fetch(client, source, headers)
            break
        except (
            httpx.TransportError,
            httpx.HTTPStatusError,
            InvalidSnapshot,
            TimeoutError,
        ) as exc:
            if isinstance(
                exc, httpx.HTTPStatusError
            ) and exc.response.status_code not in {429, 500, 502, 503, 504}:
                raise
            if attempt == source.get("http_retries", 1):
                raise
            await asyncio.sleep(2**attempt)
    observed = datetime.now(UTC)
    if body is None:
        if not headers or not previous or not (root / previous[1]).is_file():
            raise InvalidSnapshot("HTTP 304 without a usable local image")
        digest, relative = previous[:2]
    else:
        digest = hashlib.sha256(body).hexdigest()
        relative = f"{source['id']}/{digest}.jpg"
    unchanged_since, unchanged_count, quality = observation_quality(
        previous, digest, observed, source
    )
    created = False
    try:
        async with conn.transaction():
            # Across all snapshot jobs: serialize quota reservation, disk publication and DB commit.
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext('webcam-snapshot-archive'))"
            )
            existing = await conn.execute(
                "SELECT 1 FROM webcam_snapshot_images WHERE source_id=%s AND sha256=%s",
                (source["id"], digest),
            )
            is_new = await existing.fetchone() is None
            if body is not None:
                created = write_image(root, relative, body, quota)
                await conn.execute(
                    """INSERT INTO webcam_snapshot_images
                    (source_id,sha256,relative_path,byte_count,width,height,first_observed_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (source["id"], digest, relative, len(body), *dimensions, observed),
                )
            elif not (root / relative).is_file():
                raise InvalidSnapshot("Cached snapshot file is missing")
            attempt_cursor = await conn.execute(
                """INSERT INTO collection_attempts
                (source_id,http_status,status,fetched_at,processed_at,item_count,item_count_unit)
                VALUES (%s,%s,'success',%s,%s,%s,'images') RETURNING id""",
                (source["id"], response.status_code, observed, observed, int(is_new)),
            )
            attempt_id = (await attempt_cursor.fetchone())[0]
            await conn.execute(
                """INSERT INTO webcam_snapshot_observations
                (source_id,sha256,attempt_id,observed_at,http_status,etag,last_modified,
                 unchanged_since,unchanged_observations,quality_status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    source["id"],
                    digest,
                    attempt_id,
                    observed,
                    response.status_code,
                    response.headers.get(
                        "etag", previous[2] if previous and body is None else None
                    ),
                    response.headers.get(
                        "last-modified",
                        previous[3] if previous and body is None else None,
                    ),
                    unchanged_since,
                    unchanged_count,
                    quality,
                ),
            )
    except BaseException:
        # A DB failure leaves no visible image row. Remove only our own new file.
        if created:
            (root / relative).unlink(missing_ok=True)
        raise
    return "success"
