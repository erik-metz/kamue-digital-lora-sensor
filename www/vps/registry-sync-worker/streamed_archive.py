"""Disk-backed acquisition with bounded client memory and exact raw DB archival."""

import asyncio
import hashlib
import os
import struct
from urllib.parse import urlsplit

import httpx

CHUNK_SIZE = 256 * 1024
MAX_ARCHIVE_BYTES = 512 * 1024 * 1024


async def archive_file(conn, file, digest, content_type):
    """Binary COPY avoids bytea's text encoding and a full Python parameter copy."""
    async with conn.transaction():
        existing = await conn.execute(
            "SELECT 1 FROM collected_payloads WHERE sha256=%s", (digest,)
        )
        if await existing.fetchone():
            return
        await conn.execute("""CREATE TEMP TABLE archive_upload
            (sha256 TEXT, body BYTEA, content_type TEXT) ON COMMIT DROP""")
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        async with conn.cursor() as cursor, cursor.copy(
            "COPY archive_upload (sha256,body,content_type) FROM STDIN (FORMAT BINARY)"
        ) as copy:
            await copy.write(b"PGCOPY\n\xff\r\n\0" + struct.pack("!ii", 0, 0))
            encoded = digest.encode()
            await copy.write(struct.pack("!hi", 3, len(encoded)) + encoded)
            await copy.write(struct.pack("!i", size))
            while chunk := file.read(CHUNK_SIZE):
                await copy.write(chunk)
            encoded = content_type.encode()
            await copy.write(struct.pack("!i", len(encoded)) + encoded)
            await copy.write(struct.pack("!h", -1))
        await conn.execute("""INSERT INTO collected_payloads(sha256,body,content_type)
            SELECT sha256,body,content_type FROM archive_upload ON CONFLICT DO NOTHING""")
    await conn.commit()


async def acquire_archive(conn, client, source, file):
    retries = min(3, max(0, int(source.get('http_retries', 0))))
    for attempt in range(retries + 1):
        file.seek(0)
        file.truncate()
        try:
            return await _acquire_archive_once(conn, client, source, file)
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            response = exc.response if isinstance(exc, httpx.HTTPStatusError) else None
            if attempt == retries or (response is not None and response.status_code not in {429, 500, 502, 503, 504}):
                raise
            await asyncio.sleep(min(60, max(0, source.get('retry_delay_seconds', 2)) * 2**attempt))


async def _acquire_archive_once(conn, client, source, file):
    if urlsplit(source['url']).scheme != 'https':
        raise ValueError('Collector source must use HTTPS')
    digest = hashlib.sha256()
    size = 0
    headers = dict(source.get('headers', {}))
    if source.get('token_env'):
        headers['Authorization'] = f"Bearer {os.environ[source['token_env']]}"
    async with client.stream('GET', source['url'], headers=headers) as response:
        async for chunk in response.aiter_bytes(CHUNK_SIZE):
            size += len(chunk)
            if size > MAX_ARCHIVE_BYTES:
                raise ValueError('GTFS download exceeds archive size limit')
            file.write(chunk)
            digest.update(chunk)
        checksum = digest.hexdigest()
        await archive_file(conn, file, checksum,
                           response.headers.get('content-type', 'application/octet-stream'))
        cursor = await conn.execute("""INSERT INTO collection_attempts
            (source_id,http_status,payload_sha256,status) VALUES (%s,%s,%s,%s) RETURNING id""",
            (source['id'], response.status_code, checksum,
             'received' if response.is_success else 'failed'))
        attempt = (await cursor.fetchone())[0]
        await conn.commit()
        response.raise_for_status()
    file.seek(0)
    return checksum, attempt
