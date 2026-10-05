"""Packet Broker & TTN Mapper HTTP API client."""

import logging
from typing import Any

import httpx
from config import Settings

LOG = logging.getLogger("ttnmapper-collector.source")


async def fetch_gateways(
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> tuple[list[dict[str, Any]], bytes, str]:
    """Fetch gateways from Packet Broker Mapper API within the configured area."""
    params = {
        "distanceWithin[latitude]": str(settings.center_lat),
        "distanceWithin[longitude]": str(settings.center_lon),
        "distanceWithin[distance]": str(settings.radius_meters),
        "limit": 1000,
    }
    headers = {
        "User-Agent": "OpenRiedSens-TTNMapperCollector/1.0",
        "Accept": "application/json",
    }

    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0)
        should_close = True

    try:
        resp = await client.get(
            settings.packetbroker_api_url,
            params=params,
            headers=headers,
        )
        resp.raise_for_status()
        raw_bytes = resp.content
        data = resp.json()
        if not isinstance(data, list):
            data = []
        return data, raw_bytes, resp.headers.get("etag", "")
    finally:
        if should_close:
            await client.aclose()
