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


async def fetch_dashboards(client, settings):
    payloads = []
    for url in (settings.dashboard_url, *settings.additional_dashboard_urls):
        payload = await fetch_json(client, url)
        if not isinstance(payload, dict):
            raise TypeError("Expected dashboard object")
        payload["_collector_source_url"] = url
        payloads.append(payload)
    return payloads
