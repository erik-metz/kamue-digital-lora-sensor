"""Pure normalization and validation of complete traffic snapshots."""

import math
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from itertools import pairwise
from typing import Any
from zoneinfo import ZoneInfo

from config import Settings


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
    delay_kind: str = "unknown"
    category: str = "warning"
    provider_id: str | None = None
    provider_start_at: datetime | None = None
    provider_end_at: datetime | None = None
    overall_end_date: date | None = None
    provider_future: bool = False
    closure_kind: str = "none"
    work_length_meters: int | None = None
    display_type: str | None = None
    title: str | None = None

    def event_status(self, now: datetime) -> str:
        if self.provider_end_at and self.provider_end_at <= now:
            return "ended"
        if self.provider_start_at and self.provider_start_at > now:
            return "planned"
        if self.provider_future and self.provider_start_at is None:
            return "planned"
        return "active"


def _provider_bool(value: Any) -> bool:
    if value in (True, "true"):
        return True
    if value in (False, "false", None):
        return False
    raise ValueError("Invalid provider boolean")


def _timestamp(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    result = datetime.fromisoformat(str(value))
    if result.tzinfo is None:
        raise ValueError("Provider timestamp requires timezone")
    return result.astimezone(UTC)


def _description_time(lines: list[str], label: str) -> datetime | None:
    for line in lines:
        match = re.match(
            rf"^{label}:\s*(\d{{2}}\.\d{{2}}\.\d{{2}}(?:\d{{2}})?)\s+(?:um\s+)?(\d{{2}}:\d{{2}})",
            line.strip(),
        )
        if match:
            value = match[1] + " " + match[2]
            fmt = "%d.%m.%Y %H:%M" if len(match[1]) == 10 else "%d.%m.%y %H:%M"
            return (
                datetime.strptime(value, fmt)
                .replace(tzinfo=ZoneInfo("Europe/Berlin"))
                .astimezone(UTC)
            )
    return None


def _segment_in_bounds(a, b, settings: Settings) -> bool:
    # Liang-Barsky clipping, including segments whose endpoints are both outside.
    low, high = 0.0, 1.0
    lat, lon = a
    dlat, dlon = b[0] - lat, b[1] - lon
    for p, q in (
        (-dlat, lat - settings.min_lat),
        (dlat, settings.max_lat - lat),
        (-dlon, lon - settings.min_lon),
        (dlon, settings.max_lon - lon),
    ):
        if p == 0:
            if q < 0:
                return False
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return False
    return True


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


def parse_autobahn_item(
    item: dict[str, Any], road_name: str, settings: Settings, category: str = "warning"
) -> ParsedIncident | None:
    ident = item.get("identifier") or item.get("id")
    if not ident:
        raise ValueError("Traffic incident missing identity")

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
    except (TypeError, ValueError) as error:
        raise ValueError("Invalid traffic coordinate") from error
    if (
        not math.isfinite(lat)
        or not math.isfinite(lon)
        or not -90 <= lat <= 90
        or not -180 <= lon <= 180
    ):
        raise ValueError("Traffic coordinate outside valid range")

    # Line geometry if available
    coords_poly: list[list[float]] = []
    geom = item.get("geometry") or {}
    if geom.get("type") == "LineString" and isinstance(geom.get("coordinates"), list):
        for pt in geom["coordinates"]:
            if not isinstance(pt, list) or len(pt) < 2:
                raise ValueError("Invalid traffic geometry point")
            point_lat, point_lon = float(pt[1]), float(pt[0])
            if (
                not math.isfinite(point_lat)
                or not math.isfinite(point_lon)
                or not -90 <= point_lat <= 90
                or not -180 <= point_lon <= 180
            ):
                raise ValueError("Traffic geometry outside valid range")
            coords_poly.append([point_lat, point_lon])

    # Explicit coordinates/geometry are authoritative; destinations in text
    # must not pull distant events into the Ried.
    in_region = bool(lat and lon and _is_in_bounds(lat, lon, settings))
    in_region = in_region or any(_is_in_bounds(*pt, settings) for pt in coords_poly)
    in_region = in_region or any(
        _segment_in_bounds(a, b, settings) for a, b in pairwise(coords_poly)
    )
    if not in_region:
        return None

    # Determine location from -> to from subtitle / title
    # Pattern: "Zwischen <From> und <To>" or "<From> - <To>"
    location_from = ""
    location_to = ""
    loc_match = re.search(
        r"zwischen\s+([^,]+?)\s+und\s+([^,]+?)(?:,|\.|$)", full_text, re.IGNORECASE
    )
    if loc_match:
        location_from = loc_match.group(1).strip()
        location_to = loc_match.group(2).strip()
    elif " - " in subtitle:
        parts = subtitle.split(" - ")
        if len(parts) >= 2:
            location_from = parts[0].strip()
            location_to = parts[1].strip()

    # Direction
    direction = subtitle.strip() or (
        f"{location_from} ➔ {location_to}" if location_from and location_to else ""
    )

    # Extract delay & length
    length_km = _extract_number(r"(\d+(?:[.,]\d+)?)\s*km\s*stau", full_text)
    length_m = int(length_km * 1000) if length_km else 0

    delay_min = _extract_number(
        r"(\d+)\s*min(?:uten)?\s*(?:zeitverlust|verzögerung)", full_text
    )
    delay_kind = "reported" if delay_min is not None else "unknown"
    if delay_min is None and length_km:
        delay_kind = "estimated"
        # Estimate ~3 min per km of stau
        delay_min = round(length_km * 3)
    delay_sec = int((delay_min or 0) * 60)

    lines = (
        [str(x) for x in desc_list]
        if isinstance(desc_list, list)
        else str(desc_list).splitlines()
    )
    provider_start = _timestamp(item.get("startTimestamp")) or _description_time(
        lines, "Beginn"
    )
    provider_end = _description_time(lines, "Ende")
    overall_end = None
    for line in lines:
        match = re.search(
            r"Ende der Gesamtmaßnahme:\s*(\d{2}\.\d{2}\.\d{2}(?:\d{2})?)", line
        )
        if match:
            overall_end = (
                datetime.strptime(
                    match[1], "%d.%m.%Y" if len(match[1]) == 10 else "%d.%m.%y"
                )
                .replace(tzinfo=ZoneInfo("Europe/Berlin"))
                .date()
            )
    future = _provider_bool(item.get("future"))
    display_type = item.get("display_type")
    lower_text = full_text.lower()
    closure_kind = "none"
    if display_type == "CLOSURE_ENTRY_EXIT":
        closure_kind = "entry_exit"
    elif display_type == "WEIGHT_LIMIT_35" or "gesperrt für" in lower_text:
        closure_kind = "restriction"
    elif display_type == "CLOSURE" or "vollsperrung" in lower_text:
        closure_kind = "full"
    elif category == "closure" or "gesperrt" in lower_text:
        closure_kind = "unknown"

    if closure_kind != "none":
        severity = "standstill" if closure_kind == "full" else "moderate"
        cause_type = "closure"
    elif "unfall" in lower_text:
        severity = "major" if (delay_min or 0) >= 15 else "moderate"
        cause_type = "accident"
    elif category == "roadworks" or "baustelle" in lower_text:
        severity = "moderate" if (delay_min or 0) >= 10 else "minor"
        cause_type = "roadwork"
    elif "stau" in lower_text or "stockend" in lower_text or "zähflüssig" in lower_text:
        severity = "major" if (delay_min or 0) >= 15 else "moderate"
        cause_type = "congestion"
    else:
        severity = "minor"
        cause_type = "congestion"
    work_km = _extract_number(r"Länge:\s*(\d+(?:[.,]\d+)?)\s*km", desc_text)

    final_coords = (
        coords_poly if coords_poly else ([[lat, lon]] if lat and lon else None)
    )

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
        delay_kind=delay_kind,
        category=category,
        provider_id=str(ident),
        provider_start_at=provider_start,
        provider_end_at=provider_end,
        overall_end_date=overall_end,
        provider_future=future,
        closure_kind=closure_kind,
        work_length_meters=round(work_km * 1000) if work_km is not None else None,
        display_type=display_type,
        title=title or None,
    )


def normalize(payload, settings):
    """Only a structurally complete snapshot may reconcile missing incidents."""
    if not isinstance(payload, dict) or set(payload) != set(settings.roads):
        raise TypeError("Expected every configured road in traffic snapshot")
    incidents = {}
    skipped = 0
    for road in settings.roads:
        endpoints = payload[road]
        if not isinstance(endpoints, dict) or set(endpoints) != {
            "warning",
            "roadworks",
            "closure",
        }:
            raise TypeError("Incomplete traffic endpoint coverage")
        for category in ("warning", "roadworks", "closure"):
            data = endpoints[category]
            if not isinstance(data, dict) or not isinstance(data.get(category), list):
                raise TypeError(f"Invalid {road}/{category} envelope")
            for item in data[category]:
                if not isinstance(item, dict):
                    raise TypeError("Invalid traffic incident")
                try:
                    parsed = parse_autobahn_item(item, road, settings, category)
                except (TypeError, AttributeError, IndexError, OverflowError) as error:
                    raise ValueError("Malformed traffic incident") from error
                if parsed:
                    # A closure takes precedence over a duplicate warning.
                    incidents[parsed.id] = parsed
                else:
                    skipped += 1
    return list(incidents.values()), {"outside_region": skipped}
