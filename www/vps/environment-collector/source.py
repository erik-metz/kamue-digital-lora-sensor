"""HTTP acquisition for Pegelonline and regional open weather."""

from typing import Any
import httpx


async def fetch(client: httpx.AsyncClient, settings) -> dict[str, Any]:
    pegel_data = None
    weather_data = None

    try:
        r = await client.get(settings.pegelonline_url, timeout=settings.request_timeout)
        if r.status_code == 200:
            pegel_data = r.json()
    except Exception:
        pegel_data = None

    try:
        r = await client.get(settings.weather_url, timeout=settings.request_timeout)
        if r.status_code == 200:
            weather_data = r.json()
    except Exception:
        weather_data = None

    return {
        "pegel": pegel_data,
        "weather": weather_data,
    }
