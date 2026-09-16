"""Normalize Nextbike live API payloads into clean typed station and bike models."""

import math
from dataclasses import dataclass
from datetime import UTC, datetime


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in meters."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


@dataclass(frozen=True)
class NextbikeBikeData:
    bike_number: str
    bike_type: int
    electric_lock: bool
    pedelec_battery: int | None
    state: str


@dataclass(frozen=True)
class NextbikeStationData:
    station_uid: int
    sensor_id: str
    name: str
    station_number: int | None
    city_id: int
    city_name: str
    lat: float
    lng: float
    spot: bool
    terminal_type: str | None
    bikes: int
    bike_racks: int
    free_racks: int
    maintenance: bool
    bike_numbers: tuple[str, ...]
    bikes_detail: tuple[NextbikeBikeData, ...]
    ebikes_count: int
    timestamp: datetime


def parse_nextbike_response(
    data: dict, allowed_city_ids: set[int] | None = None, now: datetime | None = None
) -> list[NextbikeStationData]:
    """Extract and validate station and bike records from Nextbike live JSON response."""
    current_time = now or datetime.now(UTC)
    results: list[NextbikeStationData] = []

    if not isinstance(data, dict) or not isinstance(data.get("countries"), list):
        raise TypeError("Expected Nextbike countries array")
    seen_cities = set()
    seen_stations = set()
    seen_bikes = set()

    for country in data.get("countries", []):
        if not isinstance(country, dict) or not isinstance(country.get("cities"), list):
            raise TypeError("Invalid Nextbike country")
        for city in country.get("cities", []):
            if not isinstance(city, dict):
                raise TypeError("Invalid Nextbike city")
            city_id = city.get("uid")
            if type(city_id) is not int:
                raise ValueError("Invalid Nextbike city ID")
            if allowed_city_ids is not None and city_id not in allowed_city_ids:
                continue

            if not isinstance(city.get("places"), list):
                raise TypeError("Expected Nextbike places array")
            seen_cities.add(city_id)
            city_name = str(city.get("name") or "VRN")

            for place in city.get("places", []):
                if not isinstance(place, dict):
                    raise TypeError("Invalid Nextbike station")

                uid = place.get("uid")
                if type(uid) is not int or uid in seen_stations:
                    raise ValueError("Invalid or duplicate Nextbike station ID")
                seen_stations.add(uid)

                lat = place.get("lat")
                lng = place.get("lng")
                if not (
                    isinstance(lat, (int, float))
                    and isinstance(lng, (int, float))
                    and -90.0 <= lat <= 90.0
                    and -180.0 <= lng <= 180.0
                ):
                    raise ValueError("Invalid Nextbike coordinates")

                raw_name = str(place.get("name") or f"Station {uid}").strip()
                # Friendly display name
                if not raw_name.lower().startswith("vrn"):
                    friendly_name = f"VRNnextbike {raw_name}"
                else:
                    friendly_name = raw_name

                station_number = place.get("number")
                if not isinstance(station_number, int):
                    station_number = None

                spot = bool(place.get("spot", True))
                terminal_type = place.get("terminal_type")
                maintenance = bool(place.get("maintenance", False))

                bikes = int(place.get("bikes", 0) or 0)
                bike_racks = int(place.get("bike_racks", 0) or 0)
                free_racks = int(place.get("free_racks", 0) or 0)

                bike_numbers_raw = place.get("bike_numbers") or []
                if not isinstance(bike_numbers_raw, list):
                    raise TypeError("Expected bike_numbers array")
                bike_numbers = tuple(
                    dict.fromkeys(str(n).strip() for n in bike_numbers_raw if n)
                )

                bikes_detail_list: list[NextbikeBikeData] = []
                ebikes_count = 0

                if not isinstance(place.get("bike_list", []), list):
                    raise TypeError("Expected bike_list array")
                for b in place.get("bike_list", []):
                    if not isinstance(b, dict):
                        raise TypeError("Invalid bike record")
                    num = str(b.get("number") or "").strip()
                    if not num or num in seen_bikes:
                        raise ValueError(
                            "Missing or duplicate bike identity in snapshot"
                        )
                    seen_bikes.add(num)
                    btype = int(b.get("bike_type") or 0)
                    electric_lock = bool(b.get("electric_lock", True))
                    pedelec_battery = b.get("pedelec_battery")
                    if isinstance(pedelec_battery, (int, float)):
                        pedelec_battery = int(pedelec_battery)
                        ebikes_count += 1
                    else:
                        pedelec_battery = None
                    state = str(b.get("state") or "ok")
                    bikes_detail_list.append(
                        NextbikeBikeData(
                            bike_number=num,
                            bike_type=btype,
                            electric_lock=electric_lock,
                            pedelec_battery=pedelec_battery,
                            state=state,
                        )
                    )

                results.append(
                    NextbikeStationData(
                        station_uid=uid,
                        sensor_id=f"nextbike-{uid}",
                        name=friendly_name,
                        station_number=station_number,
                        city_id=city_id,
                        city_name=city_name,
                        lat=float(lat),
                        lng=float(lng),
                        spot=spot,
                        terminal_type=str(terminal_type) if terminal_type else None,
                        bikes=max(0, bikes),
                        bike_racks=max(0, bike_racks),
                        free_racks=max(0, free_racks),
                        maintenance=maintenance,
                        bike_numbers=bike_numbers,
                        bikes_detail=tuple(bikes_detail_list),
                        ebikes_count=ebikes_count,
                        timestamp=current_time,
                    )
                )

    if allowed_city_ids and not allowed_city_ids <= seen_cities:
        raise ValueError("Nextbike snapshot is missing configured cities")
    return results
