"""Traffic flow and corridor congestion modeling for the Hessian Ried.

Monitors major Ried arteries:
- B44 (Bürstadt - Lampertheim corridor)
- B47 (Bürstadt - Worms / Rheinbrücke)
- A67 (Lorsch - Bürstadt corridor)
- B44 (Biblis - Groß-Rohrheim corridor)

Supports:
1. Live TomTom Flow Segment API (if TOMTOM_API_KEY is configured).
2. Resilient fallback corridor estimation based on active incidents and closures.
3. Writing to entities, measurement_definitions, and readings (Three-Table Core Schema).
"""

from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass
from typing import Any

from config import Settings
from normalize import ParsedIncident

LOG = logging.getLogger("traffic-collector.traffic-flow")


@dataclass(frozen=True)
class RoadCorridor:
    id: str
    name: str
    road: str
    direction: str
    lat: float
    lon: float
    free_flow_speed_kmh: float
    length_km: float
    start_junction: str
    end_junction: str


RIED_CORRIDORS: tuple[RoadCorridor, ...] = (
    RoadCorridor(
        id="road-b44-buerstadt-lampertheim-south",
        name="B44 Bürstadt Süd nach Lampertheim",
        road="B44",
        direction="south",
        lat=49.6150,
        lon=8.4800,
        free_flow_speed_kmh=100.0,
        length_km=7.2,
        start_junction="Bürstadt Süd",
        end_junction="Lampertheim Nord",
    ),
    RoadCorridor(
        id="road-b44-lampertheim-buerstadt-north",
        name="B44 Lampertheim nach Bürstadt",
        road="B44",
        direction="north",
        lat=49.6150,
        lon=8.4800,
        free_flow_speed_kmh=100.0,
        length_km=7.2,
        start_junction="Lampertheim Nord",
        end_junction="Bürstadt Süd",
    ),
    RoadCorridor(
        id="road-b47-buerstadt-worms-west",
        name="B47 Bürstadt nach Worms (Rheinbrücke)",
        road="B47",
        direction="west",
        lat=49.6380,
        lon=8.4050,
        free_flow_speed_kmh=90.0,
        length_km=6.5,
        start_junction="Bürstadt West",
        end_junction="Worms Rheinbrücke",
    ),
    RoadCorridor(
        id="road-b47-worms-buerstadt-east",
        name="B47 Worms nach Bürstadt / Lorsch",
        road="B47",
        direction="east",
        lat=49.6380,
        lon=8.4050,
        free_flow_speed_kmh=90.0,
        length_km=6.5,
        start_junction="Worms Rheinbrücke",
        end_junction="Bürstadt West",
    ),
    RoadCorridor(
        id="road-a67-lorsch-buerstadt-south",
        name="A67 Lorsch Richtung Bürstadt",
        road="A67",
        direction="south",
        lat=49.6600,
        lon=8.5400,
        free_flow_speed_kmh=120.0,
        length_km=11.0,
        start_junction="Dreieck Darmstadt / Einhausen",
        end_junction="AS Lorsch / Bürstadt",
    ),
    RoadCorridor(
        id="road-b44-gross-rohrheim-biblis-south",
        name="B44 Groß-Rohrheim nach Biblis",
        road="B44",
        direction="south",
        lat=49.7000,
        lon=8.4750,
        free_flow_speed_kmh=90.0,
        length_km=5.8,
        start_junction="Groß-Rohrheim",
        end_junction="Biblis",
    ),
)


@dataclass(frozen=True)
class FlowObservation:
    corridor: RoadCorridor
    speed_kmh: float
    free_flow_speed_kmh: float
    delay_seconds: float
    congestion_ratio: float
    status: str  # 'clear', 'sluggish', 'congestion', 'closed'
    source: str  # 'tomtom_flow' or 'traffic_flow_model'
    confidence: float = 1.0


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def incident_affects_corridor(incident: ParsedIncident, corridor: RoadCorridor) -> bool:
    if incident.road_name.strip().upper() == corridor.road.upper():
        return True
    if incident.coordinates:
        coords = incident.coordinates
        point = coords[0] if isinstance(coords[0], (list, tuple)) else coords
        if len(point) >= 2 and isinstance(point[0], (int, float)):
            lat, lon = point[0], point[1]
            if haversine_distance_km(lat, lon, corridor.lat, corridor.lon) <= 6.0:
                return True
    return False


def estimate_corridor_flow(
    corridor: RoadCorridor,
    incidents: list[ParsedIncident],
) -> FlowObservation:
    matching = [inc for inc in incidents if incident_affects_corridor(inc, corridor)]
    free_flow = corridor.free_flow_speed_kmh
    free_time_sec = (corridor.length_km / free_flow) * 3600.0

    if not matching:
        return FlowObservation(
            corridor=corridor,
            speed_kmh=free_flow,
            free_flow_speed_kmh=free_flow,
            delay_seconds=0.0,
            congestion_ratio=1.0,
            status="clear",
            source="traffic_flow_model",
            confidence=1.0,
        )

    # Check for road closures
    has_closure = any(inc.closure_kind == "full" for inc in matching)
    if has_closure:
        return FlowObservation(
            corridor=corridor,
            speed_kmh=0.0,
            free_flow_speed_kmh=free_flow,
            delay_seconds=1800.0,
            congestion_ratio=0.0,
            status="closed",
            source="traffic_flow_model",
            confidence=0.9,
        )

    # Delays from incidents
    incident_delays = [inc.delay_seconds for inc in matching if inc.delay_seconds > 0]
    delay = float(max(incident_delays)) if incident_delays else 0.0

    # If no explicit delay was reported, but warning/roadworks exist, apply nominal friction
    if delay == 0.0:
        if any(inc.cause_type == "roadworks" for inc in matching):
            delay = 60.0
        elif any(inc.cause_type == "warning" for inc in matching):
            delay = 120.0

    total_time = free_time_sec + delay
    speed = round((corridor.length_km / (total_time / 3600.0)), 1)
    speed = max(5.0, min(free_flow, speed))
    ratio = round(min(1.0, max(0.0, speed / free_flow)), 3)

    if ratio < 0.4 or delay >= 600.0:
        status = "congestion"
    elif ratio < 0.8 or delay >= 120.0:
        status = "sluggish"
    else:
        status = "clear"

    return FlowObservation(
        corridor=corridor,
        speed_kmh=speed,
        free_flow_speed_kmh=free_flow,
        delay_seconds=delay,
        congestion_ratio=ratio,
        status=status,
        source="traffic_flow_model",
        confidence=0.85,
    )


async def fetch_tomtom_flow(
    client: Any,
    corridor: RoadCorridor,
    api_key: str,
) -> FlowObservation | None:
    url = (
        f"https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"
        f"?point={corridor.lat},{corridor.lon}&unit=KMPH&key={api_key}"
    )
    try:
        async with asyncio.timeout(10):
            response = await client.get(url)
            if response.status_code != 200:
                LOG.warning(
                    "TomTom API returned status %d for corridor %s",
                    response.status_code,
                    corridor.id,
                )
                return None
            data = response.json()
            seg = data.get("flowSegmentData", {})
            curr_speed = float(seg.get("currentSpeed", corridor.free_flow_speed_kmh))
            free_flow = float(seg.get("freeFlowSpeed", corridor.free_flow_speed_kmh))
            curr_time = float(seg.get("currentTravelTime", 0.0))
            free_time = float(seg.get("freeFlowTravelTime", 0.0))
            delay = max(0.0, curr_time - free_time)
            confidence = float(seg.get("confidence", 1.0))
            closed = bool(seg.get("roadClosure", False))

            if closed:
                return FlowObservation(
                    corridor=corridor,
                    speed_kmh=0.0,
                    free_flow_speed_kmh=free_flow,
                    delay_seconds=max(delay, 1800.0),
                    congestion_ratio=0.0,
                    status="closed",
                    source="tomtom_flow",
                    confidence=confidence,
                )

            ratio = (
                round(min(1.0, max(0.0, curr_speed / free_flow)), 3)
                if free_flow > 0
                else 1.0
            )
            if ratio < 0.4 or delay >= 600.0:
                status = "congestion"
            elif ratio < 0.8 or delay >= 120.0:
                status = "sluggish"
            else:
                status = "clear"

            return FlowObservation(
                corridor=corridor,
                speed_kmh=curr_speed,
                free_flow_speed_kmh=free_flow,
                delay_seconds=delay,
                congestion_ratio=ratio,
                status=status,
                source="tomtom_flow",
                confidence=confidence,
            )
    except (TimeoutError, OSError, ValueError, KeyError) as exc:
        LOG.warning("Failed to fetch TomTom flow for %s: %s", corridor.id, exc)
        return None


async def collect_traffic_flows(
    client: Any,
    settings: Settings,
    incidents: list[ParsedIncident],
    corridors: tuple[RoadCorridor, ...] = RIED_CORRIDORS,
) -> list[FlowObservation]:
    results: list[FlowObservation] = []
    for corridor in corridors:
        obs: FlowObservation | None = None
        if settings.tomtom_api_key:
            obs = await fetch_tomtom_flow(client, corridor, settings.tomtom_api_key)
        if obs is None:
            obs = estimate_corridor_flow(corridor, incidents)
        results.append(obs)
    return results
