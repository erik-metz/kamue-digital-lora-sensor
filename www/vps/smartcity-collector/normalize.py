"""Normalize source snapshots; traffic aggregates retain distinct metric identities."""

import hashlib
import json
import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta


@dataclass(frozen=True)
class Metric:
    name: str
    units: tuple[str, ...]
    intrinsic_unit: str | None = None


# Units for dimensional quantities must ALSO be present in this query's property
# or widget configuration. No global unit guess based only on an attribute name.
METRICS = {
    "WeatherObserved": {
        "temperature": Metric("temperature", ("°C", "CEL", "celsius")),
        "relativeHumidity": Metric("relative_humidity", ("%", "P1")),
        "precipitation": Metric("precipitation", ("mm", "MMT")),
    },
    "FloodMonitoring": {
        "currentLevelDelta": Metric("water_level_delta", ("m", "MTR")),
    },
    "GreenspaceRecord": {
        "soilTemperature": Metric("soil_temperature", ("°C", "CEL", "celsius")),
        "waterSurfaceDistance": Metric("water_surface_distance", ("cm", "CMT")),
        "soilMoistureVwc": Metric("soil_moisture_nfk", ("% nFK",)),
    },
    "AirQualityObserved": {
        "airQualityIndex": Metric("air_quality_index", ("index",), "index"),
    },
    "ParkingSpotSum": {
        "status_isFreeSum": Metric("parking_free", ("count",), "count"),
        "status_isOccupiedSum": Metric("parking_occupied", ("count",), "count"),
        "anzahlParkplaetze": Metric("parking_capacity", ("count",), "count"),
    },
    "ParkingGroup": {
        "totalOccupied": Metric("parking_occupied", ("count",), "count"),
        "totalSpotNumber": Metric("parking_capacity", ("count",), "count"),
        "availableSpotNumber": Metric("parking_free", ("count",), "count"),
    },
}


METRICS["SoilMeasurement"] = {
    "soilTemperature": Metric("soil_temperature", ("°C", "CEL", "celsius")),
    "relativeHumidity": Metric("relative_humidity", ("%", "P1")),
    **{
        f"soilMoisture{depth}": Metric(f"soil_moisture_{depth}cm", ("%", "P1"))
        for depth in (30, 60)
    },
    **{
        f"soilTension{depth}": Metric(f"soil_tension_{depth}cm", ("kPa",))
        for depth in (30, 60)
    },
}
METRICS["SoilTension"] = {
    "soilTemperature": Metric("soil_temperature", ("°C", "CEL", "celsius")),
    "soilTension": Metric("soil_tension", ("kPa",)),
}
# These are snapshots of provider aggregates, NOT individual traffic detections.
# Never combine hourly, daily and city totals, or sum successive snapshots.
for entity_type, period in (
    ("TrafficFlowObservedSumHourly", "hourly"),
    ("TrafficFlowObservedSumDaily", "daily"),
    ("TrafficFlowObservedSumDailyCity", "daily_city"),
):
    METRICS[entity_type] = {
        attribute: Metric(f"traffic_{kind}_{period}", ("count",), "count")
        for attribute, kind in {
            "gesamt": "total",
            "pkw": "cars",
            "lkw": "trucks",
            "bus": "buses",
            "fahrrad": "bicycles",
            "person": "pedestrians",
            "motorrad": "motorcycles",
            "sonstige": "other",
        }.items()
    }


def property_value(value):
    return value.get("value") if isinstance(value, dict) else value


def timestamp(value):
    value = property_value(value)
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value)
        return result.astimezone(UTC) if result.tzinfo else None
    except ValueError:
        return None


def number(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, OverflowError):
        return None


def sensor_id(tenant, entity_id):
    key = json.dumps([tenant, entity_id], ensure_ascii=False).encode()
    return "scs-" + hashlib.sha256(key).hexdigest()[:40]


def query_tabs(payload):
    """Visit actual widgets and combined children only, not duplicated map data."""
    if isinstance(payload, list):
        for dashboard in payload:
            yield from query_tabs(dashboard)
        return
    if not isinstance(payload, dict) or not isinstance(payload.get("panels"), list):
        raise TypeError("Expected a dashboard object with panels")

    def widgets(items):
        if not isinstance(items, list):
            raise TypeError("Expected widget list")
        for widget in items:
            if not isinstance(widget, dict):
                continue
            for tab in widget.get("tabs") or []:
                if isinstance(tab, dict) and isinstance(tab.get("query"), dict):
                    yield {
                        **tab,
                        "_collector_source_url": payload.get("_collector_source_url"),
                    }
            widget_data = widget.get("widgetData") or {}
            if not isinstance(widget_data, dict):
                raise TypeError("Expected widgetData object")
            data = widget_data.get("data") or {}
            if not isinstance(data, dict):
                raise TypeError("Expected widgetData.data object")
            yield from widgets(data.get("combinedWidgets") or [])

    for panel in payload["panels"]:
        if not isinstance(panel, dict):
            raise TypeError("Expected panel object")
        yield from widgets(panel.get("widgets") or [])


def unit_for(tab, entity, attribute, prop, metric):
    explicit = prop.get("unitCode") or prop.get("unit")
    metadata = prop.get("metadata") or {}
    explicit = (
        explicit
        or property_value(metadata.get("unitCode"))
        or property_value(metadata.get("unit"))
    )
    hints = set()
    if explicit:
        if not isinstance(explicit, str):
            return None
        hints.add(explicit)
    for config in tab.get("mapWidgetValues") or []:
        if not isinstance(config, dict):
            return None
        if config.get("attributes") == attribute and config.get("chartUnit"):
            hints.add(config["chartUnit"])
    # A scalar widget unit is safe only with a single approved measurement.
    mapped = METRICS.get(entity.get("type"), {})
    if tab.get("chartUnit") and len(set(entity) & set(mapped)) == 1:
        hints.add(tab["chartUnit"])
    if hints and not hints.issubset(metric.units):
        return None
    if not hints and not metric.intrinsic_unit:
        return None
    return metric.units[0]


@dataclass
class Observation:
    tenant: str
    entity_id: str
    entity_type: str
    attribute: str
    metric: str
    unit: str
    value: float
    observed_at: datetime
    fetched_at: datetime
    source_updated_at: datetime | None
    name: str
    latitude: float | None
    longitude: float | None
    source_url: str
    query_ids: set[str] = field(default_factory=set)

    @property
    def sensor_id(self):
        return sensor_id(self.tenant, self.entity_id)

    @property
    def key(self):
        return self.sensor_id, self.metric, self.observed_at

    @property
    def payload_hash(self):
        # Hash semantic content only; query IDs/fetch times change independently.
        return hashlib.sha256(json.dumps([self.value, self.unit]).encode()).hexdigest()


@dataclass
class Result:
    observations: list[Observation]
    skipped: Counter
    entity_count: int


def normalize(
    payload, tenant, source_url, fetched_at, entity_ids=frozenset(), metrics=frozenset()
):
    readings = {}
    conflicts = set()
    entities = set()
    skipped = Counter()
    for tab in query_tabs(payload):
        query = tab["query"]
        data = query.get("queryData")
        if not isinstance(data, list):
            skipped["non_observation_query"] += 1
            continue
        for entity in data:
            if not isinstance(entity, dict) or not isinstance(entity.get("id"), str):
                skipped["invalid_entity"] += 1
                continue
            entity_id = entity["id"]
            if not entity_id or not isinstance(entity.get("type"), str):
                skipped["invalid_entity"] += 1
                continue
            entities.add(entity_id)
            if entity_ids and entity_id not in entity_ids:
                skipped["entity_filter"] += 1
                continue
            mapping = METRICS.get(entity.get("type"))
            if mapping is None:
                skipped["unsupported_entity_type"] += 1
                continue
            location = property_value(entity.get("location"))
            latitude = longitude = None
            if isinstance(location, dict) and location.get("type") == "Point":
                coords = location.get("coordinates")
                if isinstance(coords, list) and len(coords) >= 2:
                    lon, lat = number(coords[0]), number(coords[1])
                    if (
                        lon is not None
                        and lat is not None
                        and -180 <= lon <= 180
                        and -90 <= lat <= 90
                    ):
                        longitude, latitude = lon, lat
            for attribute, prop in entity.items():
                if attribute not in mapping:
                    if (
                        isinstance(prop, dict)
                        and prop.get("type") in ("Number", "Property")
                        and number(prop.get("value")) is not None
                    ):
                        skipped["unmapped_attribute:" + attribute] += 1
                    continue
                metric = mapping[attribute]
                if metrics and metric.name not in metrics:
                    skipped["metric_filter"] += 1
                    continue
                if not isinstance(prop, dict):
                    skipped["invalid_property"] += 1
                    continue
                if prop.get("metadata") is not None and not isinstance(
                    prop["metadata"], dict
                ):
                    skipped["invalid_property"] += 1
                    continue
                value = number(prop.get("value"))
                if value is None:
                    skipped["invalid_value"] += 1
                    continue
                if metric.intrinsic_unit == "count" and (
                    value < 0 or not value.is_integer()
                ):
                    skipped["invalid_count"] += 1
                    continue
                observed = timestamp(prop.get("observedAt"))
                observed = observed or timestamp(
                    (prop.get("metadata") or {}).get("dateObserved")
                )
                observed = observed or timestamp(entity.get("dateObserved"))
                if observed is None:
                    skipped["missing_timestamp"] += 1
                    continue
                if observed > fetched_at + timedelta(minutes=5):
                    skipped["future_timestamp"] += 1
                    continue
                unit = unit_for(tab, entity, attribute, prop, metric)
                if unit is None:
                    skipped["unverified_unit:" + attribute] += 1
                    continue
                name = property_value(entity.get("name"))
                item = Observation(
                    tenant,
                    entity_id,
                    entity["type"],
                    attribute,
                    metric.name,
                    unit,
                    value,
                    observed,
                    fetched_at,
                    timestamp(query.get("updatedAt")),
                    str(name or entity_id)[:240],
                    latitude,
                    longitude,
                    tab.get("_collector_source_url") or source_url,
                    {str(query["id"])} if query.get("id") else set(),
                )
                old = readings.get(item.key)
                if old:
                    if old.payload_hash != item.payload_hash:
                        conflicts.add(item.key)
                    else:
                        old.query_ids.update(item.query_ids)
                        versions = [
                            t
                            for t in (old.source_updated_at, item.source_updated_at)
                            if t
                        ]
                        old.source_updated_at = max(versions) if versions else None
                        if old.latitude is None and item.latitude is not None:
                            old.latitude, old.longitude = item.latitude, item.longitude
                        if old.name == old.entity_id[:240]:
                            old.name = item.name
                else:
                    readings[item.key] = item
    # Location/name may be supplied by a different widget than the newest reading.
    metadata = {}
    for item in readings.values():
        if item.latitude is not None:
            metadata[item.entity_id] = (item.latitude, item.longitude, item.name)
    for item in readings.values():
        if item.latitude is None and item.entity_id in metadata:
            item.latitude, item.longitude, source_name = metadata[item.entity_id]
            if item.name == item.entity_id[:240]:
                item.name = source_name
    for key in conflicts:
        del readings[key]
        skipped["conflicting_observation"] += 1
    return Result(
        sorted(readings.values(), key=lambda r: r.key), skipped, len(entities)
    )
