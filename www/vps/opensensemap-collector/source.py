"""HTTP source client for openSenseMap / senseBox API."""

import asyncio
import hashlib
import json

MAX_BYTES = 30 * 1024 * 1024


async def fetch(client, settings):
    bbox_str = f"{settings.min_lon},{settings.min_lat},{settings.max_lon},{settings.max_lat}"
    url = f"{settings.opensensemap_url}?bbox={bbox_str}&full=true"
    async with asyncio.timeout(60), client.stream("GET", url) as response:
        response.raise_for_status()
        body = bytearray()
        async for part in response.aiter_bytes():
            body.extend(part)
            if len(body) > MAX_BYTES:
                raise ValueError("Source response exceeds 30 MiB")
        raw_bytes = bytes(body)
        sha256 = hashlib.sha256(raw_bytes).hexdigest()
        return json.loads(raw_bytes), raw_bytes, sha256
