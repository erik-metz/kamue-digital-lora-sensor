"""Verkehrsservice Hessen (Hessen Mobil / Landesverkehrszentrale) client and normalizer."""

import asyncio
import logging
import re
from typing import Any

from config import Settings
from normalize import ParsedIncident

LOG = logging.getLogger("traffic-collector.hessen_verkehr")
CLEAN_HTML = re.compile(r"<[^>]+>")


def _clean_text(val: Any) -> str:
    if not val:
        return ""
    text = CLEAN_HTML.sub(" ", str(val))
    return re.sub(r"\s+", " ", text).strip()


def parse_hessen_diva_feature(
    feature: dict, settings: Settings
) -> ParsedIncident | None:
    feat_id = str(feature.get("id") or "")
    if not feat_id:
        return None

    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates")
    if not coords or len(coords) < 2:
        return None

    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (ValueError, TypeError):
        return None

    if not (settings.min_lat <= lat <= settings.max_lat and settings.min_lon <= lon <= settings.max_lon):
        return None

    street = str(props.get("street") or props.get("strassennummer") or "Hessen").strip().upper()
    title = str(props.get("title") or "Stau").strip()
    von = str(props.get("von") or "").strip()
    bis = str(props.get("bis") or "").strip()
    direction = f"{von} ➔ {bis}" if von and bis else (von or bis or "")

    raw_desc = props.get("description") or title
    desc = _clean_text(raw_desc)

    delay_min = props.get("reisezeitverlust")
    delay_sec = int(delay_min * 60) if isinstance(delay_min, (int, float)) and delay_min > 0 else 0

    stau_km = props.get("staulaenge")
    length_m = int(stau_km * 1000) if isinstance(stau_km, (int, float)) and stau_km > 0 else 0

    is_sperrung = bool(props.get("sperrung")) or "gesperrt" in desc.lower()
    if is_sperrung:
        severity = "standstill"
        cause_type = "closure"
    elif delay_sec >= 900:
        severity = "major"
        cause_type = "congestion"
    elif delay_sec >= 300:
        severity = "moderate"
        cause_type = "congestion"
    else:
        severity = "minor"
        cause_type = "congestion"

    return ParsedIncident(
        id=f"hessen-diva-{feat_id}",
        road_name=street,
        direction=direction,
        location_from=von,
        location_to=bis,
        delay_seconds=delay_sec,
        length_meters=length_m,
        severity=severity,
        cause_type=cause_type,
        description=f"{title}: {desc}" if desc and desc not in title else title,
        coordinates=[[lat, lon]],
        source="hessen_verkehrsservice",
        delay_kind="reported" if delay_sec > 0 else "unknown",
        category="warning",
    )


def parse_hessen_roadworks_feature(
    feature: dict, settings: Settings
) -> ParsedIncident | None:
    feat_id = str(feature.get("id") or "")
    if not feat_id:
        return None

    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates")
    if not coords or len(coords) < 2:
        return None

    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (ValueError, TypeError):
        return None

    if not (settings.min_lat <= lat <= settings.max_lat and settings.min_lon <= lon <= settings.max_lon):
        return None

    street = str(props.get("street") or props.get("strassennummer") or "Hessen").strip().upper()
    title = str(props.get("title") or "Baustelle").strip()
    von = str(props.get("von") or "").strip()
    bis = str(props.get("bis") or "").strip()
    direction = f"{von} ➔ {bis}" if von and bis else (von or bis or "")

    kommentar = props.get("kommentar") or ""
    desc_parts = [title]
    if von and bis:
        desc_parts.append(f"zwischen {von} und {bis}")
    if kommentar:
        desc_parts.append(str(kommentar))
    desc = _clean_text(" · ".join(desc_parts))

    is_sperrung = "vollsperrung" in desc.lower() or "gesperrt" in desc.lower()
    if is_sperrung:
        severity = "standstill"
        cause_type = "closure"
    else:
        severity = "moderate"
        cause_type = "roadwork"

    return ParsedIncident(
        id=f"hessen-rw-{feat_id}",
        road_name=street,
        direction=direction,
        location_from=von,
        location_to=bis,
        delay_seconds=0,
        length_meters=0,
        severity=severity,
        cause_type=cause_type,
        description=desc,
        coordinates=[[lat, lon]],
        source="hessen_verkehrsservice",
        delay_kind="unknown",
        category="roadworks",
    )


async def collect_hessen_traffic(
    client, settings: Settings
) -> list[ParsedIncident]:
    if not getattr(settings, "hessen_verkehr_enabled", True):
        return []

    base = getattr(
        settings, "hessen_verkehr_base", "https://verkehrsservice.hessen.de/syncdata"
    ).rstrip("/")
    diva_url = f"{base}/poidiva.json"
    works_url = f"{base}/poiroadworks.json"

    incidents: list[ParsedIncident] = []

    async def fetch_file(url):
        async with asyncio.timeout(30):
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    try:
        diva_data, works_data = await asyncio.gather(
            fetch_file(diva_url), fetch_file(works_url), return_exceptions=True
        )

        if isinstance(diva_data, dict):
            for f in diva_data.get("features", []):
                inc = parse_hessen_diva_feature(f, settings)
                if inc:
                    incidents.append(inc)
        elif isinstance(diva_data, Exception):
            LOG.warning("Verkehrsservice Hessen DIVA fetch failed: %s", diva_data)

        if isinstance(works_data, dict):
            for f in works_data.get("features", []):
                inc = parse_hessen_roadworks_feature(f, settings)
                if inc:
                    incidents.append(inc)
        elif isinstance(works_data, Exception):
            LOG.warning("Verkehrsservice Hessen roadworks fetch failed: %s", works_data)

    except (TimeoutError, OSError, ValueError, TypeError, KeyError) as e:
        LOG.warning("Could not collect Verkehrsservice Hessen: %s", e)

    return incidents
