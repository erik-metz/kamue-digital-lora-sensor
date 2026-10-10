"""Stored Autobahn infrastructure inventories; no occupancy or operating inference."""

import math
import re
from datetime import UTC, datetime

from publications import acquire, publish

KINDS = {"electric_charging_station": "charging", "parking_lorry": "rest-areas"}


def number(value):
    if isinstance(value, bool):
        raise TypeError("Boolean coordinate")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite coordinate")
    return result


def coordinate(item):
    value = item.get("coordinate")
    if not isinstance(value, dict):
        raise TypeError("Missing infrastructure coordinate")
    if value.get("type") == "Point":
        coords = value.get("coordinates")
        if not isinstance(coords, list) or len(coords) != 2:
            raise ValueError("Invalid infrastructure point")
        lon, lat = map(number, coords)
    else:
        lat, lon = number(value.get("lat")), number(value.get("long"))
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("Coordinate outside earth")
    return lat, lon


def flag(value):
    if value is True or value == "true":
        return True
    if value is False or value == "false":
        return False
    return None


def charging_points(lines):
    """A connector list belongs to one point; it is not a count of sockets."""
    points = []
    current = None
    for line in lines:
        heading = re.fullmatch(r"Ladepunkt\s+(\d+)\s*:", line.strip(), re.IGNORECASE)
        if heading:
            current = {
                "number": int(heading[1]),
                "connectorTypes": [],
                "powerKw": None,
                "rawLines": [],
            }
            if any(p["number"] == current["number"] for p in points):
                raise ValueError("Duplicate charging point")
            points.append(current)
        elif current is not None and line.strip():
            current["rawLines"].append(line)
            power = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*kW", line.strip(), re.IGNORECASE)
            if power:
                if current["powerKw"] is not None:
                    raise ValueError("Ambiguous charging point power")
                current["powerKw"] = float(power[1].replace(",", "."))
            elif line.strip().startswith(("AC ", "DC ")):
                current["connectorTypes"].extend(
                    s.strip() for s in line.split(",") if s.strip()
                )
    return points


def capacity(lines, vehicle):
    matches = [
        re.fullmatch(rf"{vehicle}\s+Stellplätze:\s*(\d+)", line.strip(), re.IGNORECASE)
        for line in lines
    ]
    values = {int(m[1]) for m in matches if m}
    if len(values) > 1:
        raise ValueError("Conflicting capacity")
    return next(iter(values), None)


def parse_inventory(body, source):
    kind, road = source["kind"], source["road"]
    if kind not in KINDS or road not in {"A67", "A5", "A6"}:
        raise ValueError("Unsupported inventory scope")
    if not isinstance(body, dict) or not isinstance(body.get(kind), list):
        raise TypeError("Missing complete inventory list")
    items = body[kind]
    if len(items) > 10000:
        raise ValueError("Oversized inventory")
    south, west, north, east = source["bbox"]
    records, seen = [], {}
    for item in items:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("identifier"), str)
            or not item["identifier"].strip()
        ):
            raise ValueError("Missing infrastructure identifier")
        ident = item["identifier"]
        if ident in seen:
            if seen[ident] != item:
                raise ValueError("Conflicting duplicate infrastructure identifier")
            continue
        seen[ident] = item
        lat, lon = coordinate(item)
        lines = item.get("description", [])
        if not isinstance(lines, list) or any(not isinstance(s, str) for s in lines):
            raise ValueError("Invalid infrastructure description")
        if not south <= lat <= north or not west <= lon <= east:
            continue
        title = item.get("title")
        parts = title.split(" | ") if isinstance(title, str) else []
        record = {
            "id": f"autobahn-{road}-{kind}-{ident}",
            "providerId": ident,
            "road": road,
            "lat": lat,
            "lng": lon,
            "name": title
            if kind == "electric_charging_station"
            else item.get("subtitle"),
            "direction": parts[1]
            if len(parts) >= 3 and parts[1] != "undefined"
            else None,
            "providerBlocked": flag(item.get("isBlocked")),
            "providerFuture": flag(item.get("future")),
            "sourceUpdatedAt": None,
            "availabilityBasis": "not_provided",
            "raw": item,
        }
        if kind == "electric_charging_station":
            points = charging_points(lines)
            record.update(
                {
                    "chargingPoints": points,
                    "totalPoints": len(points) if points else None,
                    "availablePoints": None,
                    "occupiedPoints": None,
                    "connectorTypes": sorted(
                        {c for p in points for c in p["connectorTypes"]}
                    ),
                    "maxPointPowerKw": max(
                        (p["powerKw"] for p in points if p["powerKw"] is not None),
                        default=None,
                    ),
                    "reconciliationBasis": "separate_provider_inventory",
                }
            )
        else:
            record.update(
                {
                    "carCapacity": capacity(lines, "PKW"),
                    "lorryCapacity": capacity(lines, "LKW"),
                    "availableCarSpaces": None,
                    "availableLorrySpaces": None,
                }
            )
        records.append(record)
    return records


async def import_autobahn_inventory(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    observed = datetime.now(UTC)
    try:
        records = parse_inventory(response.json(), source)
        data = {
            "records": records,
            "road": source["road"],
            "kind": source["kind"],
            "observedAt": observed.isoformat(),
            "sourceUpdatedAt": None,
            "timestampBasis": "collector_observed",
            "complete": True,
            "availabilityBasis": "not_provided",
            "bbox": source["bbox"],
        }
        async with conn.transaction():
            await publish(
                conn,
                source,
                f"infrastructure/autobahn/{source['road']}/{KINDS[source['kind']]}",
                data,
                digest,
                observed,
            )
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
        await conn.commit()
    except Exception as exc:
        await conn.rollback()
        await conn.execute(
            "UPDATE collection_attempts SET status='failed',error=%s,error_stage='processing' WHERE id=%s",
            (type(exc).__name__, attempt),
        )
        await conn.commit()
        raise
