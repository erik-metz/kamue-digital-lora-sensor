"""HTTP source client for Umweltbundesamt (UBA) Air Data API."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime

MAX_BYTES = 30 * 1024 * 1024


async def fetch_json(client, url):
    async with asyncio.timeout(45), client.stream("GET", url) as response:
        response.raise_for_status()
        body = bytearray()
        async for part in response.aiter_bytes():
            body.extend(part)
            if len(body) > MAX_BYTES:
                raise ValueError("Source response exceeds 30 MiB")
        return json.loads(body)


async def fetch(client, settings, date_str: str | None = None):
    now = datetime.now(UTC)
    if not date_str:
        date_str = now.strftime("%Y-%m-%d")

    stations_url = f"{settings.uba_api_base}/stations/json?lang=de"
    airquality_url = (
        f"{settings.uba_api_base}/airquality/json?"
        f"date_from={date_str}&date_to={date_str}&time_from=1&time_to=24"
    )

    stations_task = asyncio.create_task(fetch_json(client, stations_url))
    airquality_task = asyncio.create_task(fetch_json(client, airquality_url))

    try:
        stations_data, airquality_data = await asyncio.gather(
            stations_task, airquality_task
        )
    finally:
        for t in (stations_task, airquality_task):
            if not t.done():
                t.cancel()

    payload = {
        "stations": stations_data,
        "airquality": airquality_data,
        "date": date_str,
    }
    raw_bytes = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    sha256 = hashlib.sha256(raw_bytes).hexdigest()
    return payload, raw_bytes, sha256
