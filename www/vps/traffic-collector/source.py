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
    # Bounded concurrency; any failed required request rejects the whole cycle.
    semaphore = asyncio.Semaphore(3)

    async def endpoint(road, category):
        async with semaphore:
            data = await fetch_json(
                client,
                f"{settings.autobahn_api_base}/autobahn/{road}/services/{category}",
            )
            return road, category, data

    tasks = [
        asyncio.create_task(endpoint(road, category))
        for road in settings.roads
        for category in ("warning", "roadworks", "closure")
    ]
    try:
        results = await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    payload = {road: {} for road in settings.roads}
    for road, category, data in results:
        payload[road][category] = data
    return payload
