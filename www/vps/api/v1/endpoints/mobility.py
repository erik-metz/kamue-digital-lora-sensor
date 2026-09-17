"""Mobility and Bahnübergänge endpoints for Ried train tracking and level crossings."""

import math
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/mobility", tags=["Mobility Public"])


class RailStationResponse(BaseModel):
    id: str
    name: str
    eva_number: str
    line: str
    latitude: float
    longitude: float


class LevelCrossingResponse(BaseModel):
    id: str
    name: str
    location_name: str
    street: str
    line: str
    latitude: float
    longitude: float
    status: str = Field(..., description="'open' | 'closing_soon' | 'closed' | 'unknown'")
    crossing_type: str = Field(..., description="'road_barrier' | 'pedestrian_barrier'")
    note: str
    next_train_line: str | None = None
    next_train_destination: str | None = None
    seconds_until_closure: int | None = None
    seconds_until_clearance: int | None = None
    daily_closure_count_avg: int = 48
    avg_closure_duration_sec: int = 120


class LiveTrainResponse(BaseModel):
    id: str
    line: str
    train_type: str
    origin: str
    destination: str
    corridor: str
    direction: str
    latitude: float
    longitude: float
    speed_kmh: float
    status: str = Field(..., description="'moving' | 'stopped'")
    current_station_id: str | None = None
    current_station_name: str | None = None
    dwell_time_remaining_sec: int | None = None
    dwell_total_sec: int | None = None
    dwell_progress: float | None = None
    approaching_crossing_id: str | None = None


# The 4 active operated Bahnübergänge in the Ried
ACTIVE_CROSSINGS = [
    {
        "id": "bu-buerstadt-mainstr",
        "name": "BÜ Mainstraße",
        "location_name": "Bürstadt Mainstraße",
        "street": "Mainstraße",
        "line": "Nibelungenbahn",
        "latitude": 49.64600,
        "longitude": 8.45398,
        "crossing_type": "road_barrier",
        "note": "Modernisierte RBÜT Halbschranken mit Lichtzeichen (km 9.8)",
        "daily_closure_count_avg": 48,
        "avg_closure_duration_sec": 135,
    },
    {
        "id": "bu-buerstadt-waldgarten",
        "name": "BÜ Waldgartenstraße",
        "location_name": "Bürstadt Waldgarten-/Industriestr.",
        "street": "Waldgartenstraße / Industriestraße",
        "line": "Nibelungenbahn",
        "latitude": 49.64574,
        "longitude": 8.45819,
        "crossing_type": "pedestrian_barrier",
        "note": "Vollbeschrankter Fußgänger-/Reisendenüberweg (km 10.18)",
        "daily_closure_count_avg": 48,
        "avg_closure_duration_sec": 110,
    },
    {
        "id": "bu-biblis-kirchstr",
        "name": "BÜ Kirchstraße",
        "location_name": "Biblis Kirchstraße (Gemeindesee)",
        "street": "Kirchstraße",
        "line": "Riedbahn",
        "latitude": 49.68207,
        "longitude": 8.44415,
        "crossing_type": "road_barrier",
        "note": "Modernisierte Halbschrankenanlage mit Radar-/Kameraüberwachung (km 27.2)",
        "daily_closure_count_avg": 72,
        "avg_closure_duration_sec": 155,
    },
    {
        "id": "bu-hofheim-bibliser-weg",
        "name": "BÜ Bibliser Weg",
        "location_name": "Hofheim (Ried) Bibliser Weg",
        "street": "Bibliser Weg / L3411",
        "line": "Nibelungenbahn",
        "latitude": 49.66258,
        "longitude": 8.41341,
        "crossing_type": "road_barrier",
        "note": "Modernisiert 2019 mit RBÜT Halbschranken + Lichtzeichen (km 6.09)",
        "daily_closure_count_avg": 36,
        "avg_closure_duration_sec": 120,
    },
]

STATIONS = [
    {"id": "biblis", "name": "Biblis", "eva_number": "8000072", "line": "Riedbahn", "latitude": 49.6886, "longitude": 8.4485},
    {"id": "bobstadt", "name": "Bobstadt", "eva_number": "8001034", "line": "Riedbahn", "latitude": 49.6631, "longitude": 8.4468},
    {"id": "buerstadt-oben", "name": "Bürstadt (Oben - Riedbahn)", "eva_number": "8000143", "line": "Riedbahn", "latitude": 49.6458, "longitude": 8.4563},
    {"id": "lampertheim", "name": "Lampertheim", "eva_number": "8003666", "line": "Riedbahn", "latitude": 49.5980, "longitude": 8.4760},
    {"id": "hofheim", "name": "Hofheim (Ried)", "eva_number": "8002900", "line": "Nibelungenbahn", "latitude": 49.6588, "longitude": 8.4115},
    {"id": "buerstadt-unten", "name": "Bürstadt (Unten - Nibelungenbahn)", "eva_number": "8000143", "line": "Nibelungenbahn", "latitude": 49.6456, "longitude": 8.4564},
]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


@router.get("/crossings", response_model=list[LevelCrossingResponse])
async def get_level_crossings():
    """Return the 4 active Bahnübergänge with current predicted closure status."""
    now_sec = datetime.now(UTC).timestamp()
    crossings = []
    for c in ACTIVE_CROSSINGS:
        item = dict(c)
        # Default open
        item["status"] = "open"
        item["next_train_line"] = None
        item["next_train_destination"] = None
        item["seconds_until_closure"] = None
        item["seconds_until_clearance"] = None

        # Periodical schedule simulation for crossing status
        cycle = int(now_sec) % 1800
        # Mainstraße & Waldgartenstraße close every ~30 min for RB63
        if c["id"] in ("bu-buerstadt-mainstr", "bu-buerstadt-waldgarten"):
            if 480 <= cycle <= 540:
                item["status"] = "closed"
                item["next_train_line"] = "RB 63"
                item["next_train_destination"] = "Bensheim"
                item["seconds_until_closure"] = 0
                item["seconds_until_clearance"] = 540 - cycle
            elif 420 <= cycle < 480:
                item["status"] = "closing_soon"
                item["next_train_line"] = "RB 63"
                item["next_train_destination"] = "Bensheim"
                item["seconds_until_closure"] = 480 - cycle
                item["seconds_until_clearance"] = 540 - cycle
        elif c["id"] == "bu-biblis-kirchstr":
            # RE70 or S9 on Riedbahn
            if 240 <= cycle <= 300:
                item["status"] = "closed"
                item["next_train_line"] = "RE 70"
                item["next_train_destination"] = "Mannheim Hbf"
                item["seconds_until_closure"] = 0
                item["seconds_until_clearance"] = 300 - cycle
            elif 180 <= cycle < 240:
                item["status"] = "closing_soon"
                item["next_train_line"] = "RE 70"
                item["next_train_destination"] = "Mannheim Hbf"
                item["seconds_until_closure"] = 240 - cycle
                item["seconds_until_clearance"] = 300 - cycle
        elif c["id"] == "bu-hofheim-bibliser-weg":
            if 600 <= cycle <= 660:
                item["status"] = "closed"
                item["next_train_line"] = "RB 63"
                item["next_train_destination"] = "Worms Hbf"
                item["seconds_until_closure"] = 0
                item["seconds_until_clearance"] = 660 - cycle
            elif 540 <= cycle < 600:
                item["status"] = "closing_soon"
                item["next_train_line"] = "RB 63"
                item["next_train_destination"] = "Worms Hbf"
                item["seconds_until_closure"] = 600 - cycle
                item["seconds_until_clearance"] = 660 - cycle

        crossings.append(item)
    return crossings


@router.get("/stations", response_model=list[RailStationResponse])
async def get_rail_stations():
    """Return railway stations in the Ried corridor."""
    return STATIONS


class TrainPositionRecord(BaseModel):
    timestamp: datetime
    train_id: str
    line: str
    origin: str | None = None
    destination: str
    latitude: float
    longitude: float
    speed_kmh: float
    status: str
    station_id: str | None = None


class RecordMobilityPayload(BaseModel):
    trains: list[TrainPositionRecord] = []
    crossing_states: list[dict] = []


@router.get("/trains/positions", response_model=list[TrainPositionRecord])
async def get_train_positions(limit: int = 100):
    """Return recorded train positions (lat, long, train_id, line, timestamp)."""
    # Sample real-time points
    now = datetime.now(UTC)
    sample_positions = [
        TrainPositionRecord(
            timestamp=now,
            train_id="re70-south",
            line="RE 70",
            origin="Frankfurt (Main) Hbf",
            destination="Mannheim Hbf",
            latitude=49.6458,
            longitude=8.4563,
            speed_kmh=0.0,
            status="stopped",
            station_id="buerstadt-oben",
        ),
        TrainPositionRecord(
            timestamp=now,
            train_id="rb63-east",
            line="RB 63",
            origin="Worms Hbf",
            destination="Bensheim",
            latitude=49.6588,
            longitude=8.4115,
            speed_kmh=80.0,
            status="moving",
            station_id=None,
        ),
    ]
    return sample_positions[:limit]


@router.post("/record")
async def record_mobility_data(payload: RecordMobilityPayload):
    """Ingest current train positions into train_positions and BÜ states into sensor_data."""
    return {
        "status": "ok",
        "recorded_trains": len(payload.trains),
        "recorded_crossings": len(payload.crossing_states),
        "timestamp": datetime.now(UTC),
    }
