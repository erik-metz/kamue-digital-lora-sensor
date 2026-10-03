"""Normalization and filtering for Umweltbundesamt (UBA) air quality stations and measurements."""

from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from config import Settings

BERLIN_TZ = ZoneInfo("Europe/Berlin")

COMPONENT_MAP: dict[int, tuple[str, str]] = {
    1: ("PM10", "µg/m³"),
    2: ("CO", "mg/m³"),
    3: ("O3", "µg/m³"),
    4: ("SO2", "µg/m³"),
    5: ("NO2", "µg/m³"),
    9: ("PM25", "µg/m³"),
}


@dataclass(frozen=True)
class UbaMeasurement:
    metric: str
    value: float
    unit: str
    observed_at: datetime
    index_value: int | None = None


@dataclass(frozen=True)
class UbaStationObservation:
    station_id: str
    station_code: str
    sensor_id: str
    name: str
    friendly_name: str
    city: str
    network: str
    station_type: str
    latitude: float
    longitude: float
    updated_at: datetime
    measurements: list[UbaMeasurement]
    description: str


def parse_uba_timestamp(ts_str: str) -> datetime:
    """UBA air quality dates are given in German local time (CET/CEST): 'YYYY-MM-DD HH:MM:SS'."""
    try:
        dt = datetime.fromisoformat(ts_str.strip())
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=BERLIN_TZ)
        return dt.astimezone(UTC)
    except (ValueError, TypeError):
        return datetime.now(UTC)


def normalize(
    payload: dict, settings: Settings, max_age_days: int = 7
) -> tuple[list[UbaStationObservation], int]:
    stations_data = payload.get("stations") or {}
    airquality_data = payload.get("airquality") or {}

    raw_stations = stations_data.get("data") or {}
    indices_list = stations_data.get("indices") or []
    indices = {name: i for i, name in enumerate(indices_list)}

    # Check required indices
    req_keys = ("station id", "station code", "station name", "station city", "station latitude", "station longitude")
    if not all(k in indices for k in req_keys):
        return [], 0

    aq_data = airquality_data.get("data") or {}
    accepted: list[UbaStationObservation] = []
    skipped = 0
    now = datetime.now(UTC)

    for st_id, row in raw_stations.items():
        if not isinstance(row, list) or len(row) <= max(indices.values()):
            skipped += 1
            continue

        try:
            lat = float(row[indices["station latitude"]])
            lon = float(row[indices["station longitude"]])
        except (ValueError, TypeError, IndexError):
            skipped += 1
            continue

        # Geographic bounds check
        if not (settings.min_lat <= lat <= settings.max_lat and settings.min_lon <= lon <= settings.max_lon):
            skipped += 1
            continue

        # Check active status if available
        active_to_idx = indices.get("station active to")
        if active_to_idx is not None and row[active_to_idx]:
            try:
                active_to = datetime.fromisoformat(str(row[active_to_idx])).date()
                if active_to < now.date():
                    skipped += 1
                    continue
            except (ValueError, TypeError):
                pass

        station_code = str(row[indices["station code"]]).strip()
        station_name = str(row[indices["station name"]]).strip()
        city = str(row[indices["station city"]]).strip()

        net_name_idx = indices.get("network name")
        network = str(row[net_name_idx]).strip() if net_name_idx is not None and row[net_name_idx] else "UBA / Länder"

        st_type_idx = indices.get("station type name")
        st_type = str(row[st_type_idx]).strip() if st_type_idx is not None and row[st_type_idx] else "Hintergrund / Verkehr"

        code_lower = station_code.lower()
        sensor_id = f"uba-{code_lower}"
        friendly_name = f"UBA Luftgütestation {station_name} ({city})"
        desc = (
            f"Amtliche Luftgütemessstation {station_name} ({station_code}) in {city} · "
            f"Netz: {network}, Typ: {st_type} · Quelle: Umweltbundesamt Luftdaten API"
        )

        station_aq = aq_data.get(str(st_id)) or {}
        measurements: list[UbaMeasurement] = []
        latest_timestamp = now

        # Iterate hourly slots sorted by timestamp descending to find latest valid values
        for slot_time_str in sorted(station_aq.keys(), reverse=True):
            slot_info = station_aq[slot_time_str]
            if not isinstance(slot_info, list) or len(slot_info) < 2:
                continue

            obs_time = parse_uba_timestamp(slot_time_str)
            age_seconds = (now - obs_time).total_seconds()
            if age_seconds > max_age_days * 86400 or age_seconds < -7200:
                continue

            # Item 1 is total_index
            total_index = slot_info[1]
            if isinstance(total_index, (int, float)) and total_index > 0:
                measurements.append(
                    UbaMeasurement(
                        metric="air_quality_index",
                        value=float(total_index),
                        unit="index",
                        observed_at=obs_time,
                        index_value=int(total_index),
                    )
                )

            # Process component pollutant measurements
            for item in slot_info[3:]:
                if not isinstance(item, list) or len(item) < 2:
                    continue
                comp_id = item[0]
                raw_val = item[1]
                idx_val = item[2] if len(item) > 2 and isinstance(item[2], (int, float)) else None

                if comp_id in COMPONENT_MAP and isinstance(raw_val, (int, float)):
                    metric, unit = COMPONENT_MAP[comp_id]
                    measurements.append(
                        UbaMeasurement(
                            metric=metric,
                            value=float(raw_val),
                            unit=unit,
                            observed_at=obs_time,
                            index_value=int(idx_val) if idx_val is not None else None,
                        )
                    )

            if measurements:
                latest_timestamp = obs_time
                # We take the latest slot with available readings
                break

        accepted.append(
            UbaStationObservation(
                station_id=str(st_id),
                station_code=station_code,
                sensor_id=sensor_id,
                name=station_name,
                friendly_name=friendly_name,
                city=city,
                network=network,
                station_type=st_type,
                latitude=lat,
                longitude=lon,
                updated_at=latest_timestamp,
                measurements=measurements,
                description=desc,
            )
        )

    return accepted, skipped
