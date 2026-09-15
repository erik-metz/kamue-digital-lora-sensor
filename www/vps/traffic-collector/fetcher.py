"""Fetcher and parser for Autobahn GmbH and regional traffic feeds."""

import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx
from config import Settings

LOG = logging.getLogger("traffic-collector.fetcher")


@dataclass
class ParsedIncident:
    id: str
    road_name: str
    direction: str
    location_from: str
    location_to: str
    delay_seconds: int
    length_meters: int
    severity: str
    cause_type: str
    description: str
    coordinates: list[list[float]] | None
    source: str


def _extract_number(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", "."))
        except ValueError:
            return None
    return None


def _is_in_bounds(lat: float, lon: float, settings: Settings) -> bool:
    return (
        settings.min_lat <= lat <= settings.max_lat
        and settings.min_lon <= lon <= settings.max_lon
    )


def parse_autobahn_item(item: dict[str, Any], road_name: str, settings: Settings) -> ParsedIncident | None:
    ident = item.get("identifier") or item.get("id")
    if not ident:
        return None

    title = item.get("title") or ""
    subtitle = item.get("subtitle") or ""
    desc_list = item.get("description") or []
    if isinstance(desc_list, list):
        desc_text = " ".join(str(x) for x in desc_list)
    else:
        desc_text = str(desc_list)
    full_text = f"{title}. {subtitle}. {desc_text}".strip()

    # Coordinates
    coord = item.get("coordinate") or {}
    try:
        lat = float(coord.get("lat", 0))
        lon = float(coord.get("long", 0))
    except (TypeError, ValueError):
        lat, lon = 0.0, 0.0

    # Line geometry if available
    coords_poly: list[list[float]] = []
    geom = item.get("geometry") or {}
    if geom.get("type") == "LineString" and isinstance(geom.get("coordinates"), list):
        for pt in geom["coordinates"]:
            if len(pt) >= 2:
                coords_poly.append([float(pt[1]), float(pt[0])])  # GeoJSON is [lon, lat]

    # Geofilter: must have at least one point in Ried bounding box
    has_coord_in_ried = False
    if lat and lon and _is_in_bounds(lat, lon, settings):
        has_coord_in_ried = True
    elif coords_poly:
        for pt in coords_poly:
            if _is_in_bounds(pt[0], pt[1], settings):
                has_coord_in_ried = True
                break

    # Text-based keyword filter if coordinates are missing/rough
    ried_keywords = [
        "lorsch", "bensheim", "viernheim", "heppenheim", "darmstadt",
        "pfungstadt", "gernsheim", "sandhofen", "mannheim", "worms",
        "bürstadt", "lampertheim", "biblis"
    ]
    has_keyword = any(kw in full_text.lower() for kw in ried_keywords)

    if not has_coord_in_ried and not has_keyword:
        return None

    # Determine location from -> to from subtitle / title
    # Pattern: "Zwischen <From> und <To>" or "<From> - <To>"
    location_from = "AS Lorsch"
    location_to = "AD Viernheim"
    loc_match = re.search(r"zwischen\s+([^,]+?)\s+und\s+([^,]+?)(?:,|\.|$)", full_text, re.IGNORECASE)
    if loc_match:
        location_from = loc_match.group(1).strip()
        location_to = loc_match.group(2).strip()
    elif " - " in subtitle:
        parts = subtitle.split(" - ")
        if len(parts) >= 2:
            location_from = parts[0].strip()
            location_to = parts[1].strip()

    # Direction
    direction = f"{location_from} ➔ {location_to}"

    # Extract delay & length
    length_km = _extract_number(r"(\d+(?:[.,]\d+)?)\s*km\s*stau", full_text)
    length_m = int(length_km * 1000) if length_km else 0

    delay_min = _extract_number(r"(\d+)\s*min(?:uten)?\s*(?:zeitverlust|verzögerung)", full_text)
    if not delay_min and length_km:
        # Estimate ~3 min per km of stau
        delay_min = round(length_km * 3)
    delay_sec = int((delay_min or 0) * 60)

    # Cause type & Severity
    lower_text = full_text.lower()
    if "gesperrt" in lower_text or "vollsperrung" in lower_text:
        severity = "standstill"
        cause_type = "closure"
        delay_sec = max(delay_sec, 1800)
    elif "unfall" in lower_text:
        severity = "major" if (delay_min or 0) >= 15 else "moderate"
        cause_type = "accident"
    elif "baustelle" in lower_text:
        severity = "moderate" if (delay_min or 0) >= 10 else "minor"
        cause_type = "roadwork"
    elif "stau" in lower_text or "stockend" in lower_text or "zähflüssig" in lower_text:
        severity = "major" if (delay_min or 0) >= 15 else "moderate"
        cause_type = "congestion"
    else:
        severity = "minor"
        cause_type = "congestion"

    final_coords = coords_poly if coords_poly else ([[lat, lon]] if lat and lon else None)

    return ParsedIncident(
        id=f"autobahn-{road_name.lower()}-{ident}",
        road_name=road_name.upper(),
        direction=direction,
        location_from=location_from,
        location_to=location_to,
        delay_seconds=delay_sec,
        length_meters=length_m,
        severity=severity,
        cause_type=cause_type,
        description=full_text,
        coordinates=final_coords,
        source="autobahn_api",
    )


async def fetch_road_incidents(
    client: httpx.AsyncClient, road: str, settings: Settings
) -> list[ParsedIncident]:
    """Fetch warnings, roadworks, and closures for a specific autobahn."""
    incidents: list[ParsedIncident] = []
    endpoints = ["services/warning", "services/roadworks", "services/closure"]

    for ep in endpoints:
        url = f"{settings.autobahn_api_base}/autobahn/{road}/{ep}"
        try:
            res = await client.get(url, timeout=15.0)
            if res.status_code != 200:
                LOG.warning("Failed to fetch %s: HTTP %s", url, res.status_code)
                continue
            data = res.json()
            # Items might be in warning, roadworks, or closure array
            items = []
            for k in ["warning", "roadworks", "closure", "items"]:
                if k in data and isinstance(data[k], list):
                    items.extend(data[k])

            for item in items:
                parsed = parse_autobahn_item(item, road, settings)
                if parsed:
                    incidents.append(parsed)
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            LOG.error("Error fetching %s for %s: %s", ep, road, exc)

    return incidents
