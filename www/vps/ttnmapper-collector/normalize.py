"""Normalization and validation of LoRaWAN gateways and Ried coverage expansion."""

import math
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from config import Settings


@dataclass
class NormalizedGateway:
    gateway_id: str
    sensor_id: str
    eui: str | None
    net_id: str
    tenant_id: str
    cluster_id: str
    latitude: float
    longitude: float
    altitude: float | None
    antenna_placement: str
    online: bool
    updated_at: datetime
    friendly_name: str
    description: str


@dataclass
class RiedCoverageSnapshot:
    observed_at: datetime
    total_gateways: int
    active_gateways: int
    outdoor_gateways: int
    indoor_gateways: int
    online_ratio_pct: float


def _is_in_bounds(lat: float, lon: float, settings: Settings) -> bool:
    return (
        settings.min_lat <= lat <= settings.max_lat
        and settings.min_lon <= lon <= settings.max_lon
    )


def _parse_timestamp(raw_ts: Any, fallback: datetime) -> datetime:
    if not raw_ts:
        return fallback
    if isinstance(raw_ts, datetime):
        return raw_ts if raw_ts.tzinfo else raw_ts.replace(tzinfo=UTC)
    if isinstance(raw_ts, str):
        try:
            clean = raw_ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
        except (ValueError, TypeError):
            return fallback
    return fallback


def normalize_gateway(
    raw_gw: dict[str, Any],
    settings: Settings,
    now: datetime | None = None,
) -> NormalizedGateway | None:
    now = now or datetime.now(UTC)
    if not isinstance(raw_gw, dict):
        return None

    gw_id = raw_gw.get("id") or raw_gw.get("gateway_id") or raw_gw.get("eui")
    if not gw_id or not isinstance(gw_id, str):
        return None
    gw_id = gw_id.strip()

    loc = raw_gw.get("location")
    if not isinstance(loc, dict):
        return None

    raw_lat = loc.get("latitude")
    raw_lon = loc.get("longitude")
    if raw_lat is None or raw_lon is None:
        return None

    try:
        lat = float(raw_lat)
        lon = float(raw_lon)
    except (ValueError, TypeError):
        return None

    if not math.isfinite(lat) or not math.isfinite(lon):
        return None
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return None

    if not _is_in_bounds(lat, lon, settings):
        return None

    raw_alt = loc.get("altitude")
    altitude = None
    if raw_alt is not None:
        try:
            val = float(raw_alt)
            if math.isfinite(val) and -500.0 <= val <= 9000.0:
                altitude = val
        except (ValueError, TypeError):
            altitude = None

    eui = raw_gw.get("eui")
    if eui and not isinstance(eui, str):
        eui = str(eui)

    net_id = str(raw_gw.get("netID") or "000013")
    tenant_id = str(raw_gw.get("tenantID") or "ttn")
    cluster_id = str(raw_gw.get("clusterID") or "eu1.cloud.thethings.network")

    placement = str(raw_gw.get("antennaPlacement") or "UNKNOWN").upper()
    if placement not in ("OUTDOOR", "INDOOR", "UNKNOWN"):
        placement = "UNKNOWN"

    online = bool(raw_gw.get("online", True))
    updated_at = _parse_timestamp(raw_gw.get("updatedAt"), now)

    clean_id = gw_id.lower().replace(":", "-").replace(" ", "-")
    sensor_id = f"ttn-gw-{clean_id}"
    friendly_name = f"LoRaWAN Gateway {gw_id}"
    desc = (
        f"LoRaWAN Gateway {gw_id} ({placement.capitalize()}) · "
        f"Netzwerk: {tenant_id.upper()} ({cluster_id}) · "
        f"Status: {'Online' if online else 'Offline'} · "
        "Quelle: TTN Mapper / Packet Broker"
    )

    return NormalizedGateway(
        gateway_id=clean_id,
        sensor_id=sensor_id,
        eui=eui,
        net_id=net_id,
        tenant_id=tenant_id,
        cluster_id=cluster_id,
        latitude=lat,
        longitude=lon,
        altitude=altitude,
        antenna_placement=placement,
        online=online,
        updated_at=updated_at,
        friendly_name=friendly_name,
        description=desc,
    )


def normalize_gateways_payload(
    raw_gateways: list[dict[str, Any]],
    settings: Settings,
    now: datetime | None = None,
) -> list[NormalizedGateway]:
    now = now or datetime.now(UTC)
    result: list[NormalizedGateway] = []
    seen: set[str] = set()

    for item in raw_gateways:
        gw = normalize_gateway(item, settings, now)
        if gw and gw.gateway_id not in seen:
            seen.add(gw.gateway_id)
            result.append(gw)

    return result


def compute_ried_snapshot(
    gateways: list[NormalizedGateway],
    now: datetime | None = None,
) -> RiedCoverageSnapshot:
    now = now or datetime.now(UTC)
    total = len(gateways)
    active = sum(1 for g in gateways if g.online)
    outdoor = sum(1 for g in gateways if g.antenna_placement == "OUTDOOR")
    indoor = sum(1 for g in gateways if g.antenna_placement == "INDOOR")
    ratio = (active / total * 100.0) if total > 0 else 0.0

    return RiedCoverageSnapshot(
        observed_at=now,
        total_gateways=total,
        active_gateways=active,
        outdoor_gateways=outdoor,
        indoor_gateways=indoor,
        online_ratio_pct=round(ratio, 2),
    )
