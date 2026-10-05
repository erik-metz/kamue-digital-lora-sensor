"""Normalization of BNetzA EMF site and antenna data into domain records."""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from client import AntennaDetail, EmfSiteDetails


def parse_german_date(date_str: str | None) -> datetime:
    """Parse D.M.YYYY to datetime (UTC midnight). Falls back to now(UTC)."""
    if not date_str:
        return datetime.now(UTC)
    parts = date_str.strip().split(".")
    if len(parts) == 3:
        try:
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            d = date(year, month, day)
            return datetime(d.year, d.month, d.day, tzinfo=UTC)
        except ValueError:
            pass
    return datetime.now(UTC)


@dataclass
class NormalizedEmfSite:
    entity_id: str
    fid: int
    name: str
    latitude: float
    longitude: float
    stob_nr: str | None
    stob_date: datetime
    method_stob: str
    providers: list[str]
    max_height_m: float | None
    max_safety_distance_h_m: float | None
    max_safety_distance_v_m: float | None
    antenna_count: int
    antennas: list[AntennaDetail]
    raw_metadata: dict[str, Any]


def normalize_site(
    raw_pos: dict[str, Any], details: EmfSiteDetails | None
) -> NormalizedEmfSite:
    fid = int(raw_pos["fID"])
    entity_id = f"bnetza:emf:{fid}"
    title = str(raw_pos.get("Titel", "")).strip()
    lat = float(raw_pos["Lat"])
    lon = float(raw_pos["Lng"])

    stob_nr = details.stob_nr if details and details.stob_nr else (title if title else None)
    name = f"Funkanlage STOB {stob_nr}" if stob_nr else f"Funkanlage BNetzA {fid}"

    stob_dt = parse_german_date(details.stob_date if details else None)
    method = details.method_stob if details else "unbekannt"
    providers = details.providers if details else []
    antennas = details.antennas if details else []

    heights = [a.height_m for a in antennas if a.height_m is not None]
    sa_h = [a.safety_distance_h_m for a in antennas if a.safety_distance_h_m is not None]
    sa_v = [a.safety_distance_v_m for a in antennas if a.safety_distance_v_m is not None]

    raw_metadata = {
        "fid": fid,
        "stob_nr": stob_nr,
        "stob_date": details.stob_date if details else None,
        "method_stob": method,
        "providers": providers,
        "antenna_count": len(antennas),
        "source": "bnetza_emf",
        "sonderseite": raw_pos.get("sonderseite", False),
    }

    return NormalizedEmfSite(
        entity_id=entity_id,
        fid=fid,
        name=name,
        latitude=lat,
        longitude=lon,
        stob_nr=stob_nr,
        stob_date=stob_dt,
        method_stob=method,
        providers=providers,
        max_height_m=max(heights) if heights else None,
        max_safety_distance_h_m=max(sa_h) if sa_h else None,
        max_safety_distance_v_m=max(sa_v) if sa_v else None,
        antenna_count=len(antennas),
        antennas=antennas,
        raw_metadata=raw_metadata,
    )
