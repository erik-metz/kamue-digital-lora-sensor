"""Normalization and filtering for rast-monitor.de truck rest area data."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from config import Settings


@dataclass(frozen=True)
class RastSiteObservation:
    datex_id: str
    sensor_id: str
    name: str
    friendly_name: str
    road: str
    destination: str | None
    latitude: float
    longitude: float
    capacity: int | None
    occupancy_pct: float | None
    free_spaces: int | None
    occupied_spaces: int | None
    site_status: str | None
    opening_status: str | None
    detection_type: str | None
    operator: str | None
    observed_at: datetime


def parse_timestamp(value: Any) -> datetime:
    if not value or not isinstance(value, str):
        return datetime.now(UTC)
    try:
        cleaned = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except (ValueError, TypeError):
        return datetime.now(UTC)


def normalize(geojson_data: dict, settings: Settings) -> tuple[list[RastSiteObservation], int]:
    features = geojson_data.get("features", [])
    accepted: list[RastSiteObservation] = []
    skipped = 0

    allowed_roads = {r.upper() for r in settings.roads}

    for f in features:
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            skipped += 1
            continue
        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except (ValueError, TypeError):
            skipped += 1
            continue

        # Check coordinate bounds
        if not (settings.min_lat <= lat <= settings.max_lat and settings.min_lon <= lon <= settings.max_lon):
            skipped += 1
            continue

        props = f.get("properties") or {}
        datex_id = str(props.get("datex_id") or "").strip()
        if not datex_id:
            skipped += 1
            continue

        road = str(props.get("road_identifier") or "").strip().upper()
        if allowed_roads and road not in allowed_roads:
            skipped += 1
            continue

        name = str(props.get("name") or datex_id).strip()
        friendly_name = f"Rastplatz {name} ({road})" if road else f"Rastplatz {name}"
        destination = props.get("road_destination")
        if destination and isinstance(destination, str):
            destination = destination.strip()
            if destination.lower() in ("ohne angabe", "none", ""):
                destination = None

        operator = props.get("operator_name")
        if operator and isinstance(operator, str):
            operator = operator.strip()

        # Capacity: total_spaces or official_spaces
        total_spaces = props.get("total_spaces")
        official_spaces = props.get("official_spaces")
        capacity = None
        if isinstance(total_spaces, (int, float)) and total_spaces > 0:
            capacity = int(total_spaces)
        elif isinstance(official_spaces, (int, float)) and official_spaces > 0:
            capacity = int(official_spaces)

        # Occupancy pct
        occ_raw = props.get("occupancy_pct")
        occupancy_pct = None
        if isinstance(occ_raw, (int, float)):
            occupancy_pct = float(occ_raw)

        # Free / Occupied calculation
        vacant_raw = props.get("vacant_spaces")
        free_spaces = None
        occupied_spaces = None

        if isinstance(vacant_raw, (int, float)):
            free_spaces = max(0, int(vacant_raw))
            if capacity is not None:
                occupied_spaces = max(0, capacity - free_spaces)
        elif capacity is not None and occupancy_pct is not None:
            occupied_spaces = round(capacity * (occupancy_pct / 100.0))
            free_spaces = max(0, capacity - occupied_spaces)

        observed_at = parse_timestamp(props.get("fetched_at"))
        sensor_id = f"rast-{datex_id.lower()}"

        site_obs = RastSiteObservation(
            datex_id=datex_id,
            sensor_id=sensor_id,
            name=name,
            friendly_name=friendly_name,
            road=road,
            destination=destination,
            latitude=lat,
            longitude=lon,
            capacity=capacity,
            occupancy_pct=occupancy_pct,
            free_spaces=free_spaces,
            occupied_spaces=occupied_spaces,
            site_status=props.get("site_status"),
            opening_status=props.get("opening_status"),
            detection_type=props.get("occupancy_detection_type"),
            operator=operator,
            observed_at=observed_at,
        )
        accepted.append(site_obs)

    return accepted, skipped
