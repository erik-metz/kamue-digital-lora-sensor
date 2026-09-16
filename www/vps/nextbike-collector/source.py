import asyncio
import json

MAX_BYTES = 20 * 1024 * 1024


async def fetch_json(client, url):
    async with asyncio.timeout(45), client.stream("GET", url) as response:
        response.raise_for_status()
        body = bytearray()
        async for part in response.aiter_bytes():
            body.extend(part)
            if len(body) > MAX_BYTES:
                raise ValueError("Source response exceeds 20 MiB")
        return json.loads(body)


async def fetch(client, settings):
    return await fetch_json(client, settings.api_url)
