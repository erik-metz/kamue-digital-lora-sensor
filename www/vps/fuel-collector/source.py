"""One bounded all-fuel request per regional snapshot."""
import asyncio
import json

import httpx


class ProviderFailure(RuntimeError):
    def __init__(self, retry_after=None):
        super().__init__("Fuel provider request failed")
        self.retry_after = retry_after


async def fetch(client, settings):
    # Never propagate httpx errors: their URL includes the secret query parameter.
    try:
        async with asyncio.timeout(45), client.stream("GET", "https://creativecommons.tankerkoenig.de/json/list.php", params={
            "lat": settings.latitude, "lng": settings.longitude, "rad": settings.radius,
            "type": "all", "sort": "dist", "apikey": settings.api_key,
        }) as response:
            if response.status_code != 200:
                raise ProviderFailure(response.headers.get("Retry-After"))
            chunks = bytearray()
            async for chunk in response.aiter_bytes():
                chunks.extend(chunk)
                if len(chunks) > 2 * 1024 * 1024:
                    raise ValueError("Fuel response exceeds size limit")
            return json.loads(chunks)
    except ProviderFailure:
        raise
    except (TimeoutError, ValueError, httpx.HTTPError, RuntimeError):
        raise RuntimeError("Fuel provider request failed") from None
