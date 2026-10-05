"""DB station infrastructure and facility status; never inferred train positions."""

import asyncio
import math
from datetime import UTC, datetime, timedelta
from tempfile import TemporaryFile
from urllib.parse import quote

from defusedxml import ElementTree as XML
from publications import acquire, publish
from streamed_archive import acquire_archive

NETEX = "http://www.netex.org.uk/netex"
SIRI = "http://www.siri.org.uk/siri"
COMPONENTS = {
    "Quay",
    "AccessSpace",
    "Entrance",
    "EquipmentPlace",
    "LiftEquipment",
    "EscalatorEquipment",
    "TravelatorEquipment",
    "StaircaseEquipment",
    "RampEquipment",
    "EntranceEquipment",
    "AccessVehicleEquipment",
    "PassengerInformationEquipment",
}


def text(node, path, namespace=NETEX):
    value = node.findtext("/".join(f"{{{namespace}}}{p}" for p in path.split("/")))
    return value.strip() if value else None


def keys(node):
    return {
        text(item, "Key"): text(item, "Value")
        for item in node.findall(f"{{{NETEX}}}keyList/{{{NETEX}}}KeyValue")
    }


def coordinates(node):
    # Only this object's centroid: a child's location is not the parent's position.
    lat = text(node, "Centroid/Location/Latitude")
    lon = text(node, "Centroid/Location/Longitude")
    if lat is None or lon is None:
        return None
    lat, lon = float(lat), float(lon)
    if not (
        math.isfinite(lat)
        and math.isfinite(lon)
        and -90 <= lat <= 90
        and -180 <= lon <= 180
    ):
        raise ValueError("Invalid DB coordinates")
    return {"latitude": lat, "longitude": lon}


def object_record(node):
    values = keys(node)
    identifier = values.get("NORMALIZED_ID_URI")
    if not identifier or not node.get("id"):
        raise ValueError("OpenStation normalized identifier missing")
    return {
        "id": identifier,
        "provider_id": node.get("id"),
        "type": node.tag.removeprefix(f"{{{NETEX}}}"),
        "name": text(node, "Name"),
        "coordinates": coordinates(node),
        "quay_type": text(node, "QuayType"),
        "equipment_refs": [
            child.get("ref")
            for child in node.findall(f"{{{NETEX}}}placeEquipments/*")
            if child.get("ref")
        ],
        "parent_ref": next(
            (
                child.get("ref")
                for child in node
                if child.tag
                in {f"{{{NETEX}}}ParentQuayRef", f"{{{NETEX}}}ParentSiteRef"}
            ),
            None,
        ),
    }


def parse_netex(file, source):
    """Retain one station subtree at a time, including unlocated local assets."""
    stations, timestamp, stack = [], None, []
    selected = set(source.get("eva_numbers", []))
    names = set(source.get("station_names", []))
    if not selected and not names:
        raise ValueError("Explicit station selection required")
    inside_station = False
    for event, node in XML.iterparse(file, events=("start", "end")):
        if event == "start":
            if not stack and node.tag != f"{{{NETEX}}}PublicationDelivery":
                raise ValueError("Not a NeTEx PublicationDelivery")
            stack.append(node)
            if node.tag == f"{{{NETEX}}}StopPlace":
                inside_station = True
            continue
        if node.tag == f"{{{NETEX}}}PublicationTimestamp":
            timestamp = datetime.fromisoformat(node.text.strip())
        if node.tag == f"{{{NETEX}}}StopPlace":
            eva_numbers = [
                text(item, "Value")
                for item in node.findall(f"{{{NETEX}}}keyList/{{{NETEX}}}KeyValue")
                if text(item, "Key") == "EVA"
            ]
            ds100_codes = [
                text(item, "Value")
                for item in node.findall(f"{{{NETEX}}}keyList/{{{NETEX}}}KeyValue")
                if text(item, "Key") == "RIL"
            ]
            if selected.intersection(eva_numbers) or text(node, "Name") in names:
                station = object_record(node)
                station.update(
                    eva_number=eva_numbers[0] if eva_numbers else None,
                    eva_numbers=eva_numbers,
                    ds100_codes=ds100_codes,
                    station_number=text(node, "PrivateCode"),
                )
                station["components"] = [
                    object_record(child)
                    for child in node.iter()
                    if child.tag in {f"{{{NETEX}}}{t}" for t in COMPONENTS}
                    and child.get("id")
                ]
                stations.append(station)
            inside_station = False
        if not inside_station:
            if len(stack) > 1:
                stack[-2].remove(node)
            node.clear()
        stack.pop()
    if names - {station["name"] for station in stations}:
        raise ValueError("Configured OpenStation station missing")
    if timestamp is None or timestamp.tzinfo is None or not stations:
        raise ValueError("Missing publication time or no configured stations found")
    if selected - {eva for station in stations for eva in station["eva_numbers"]}:
        raise ValueError("Configured OpenStation EVA missing")
    ids = [s["id"] for s in stations]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate station identifiers")
    return timestamp, stations


def parse_siri(file, now=None):
    now = now or datetime.now(UTC)
    root = XML.parse(file).getroot()
    if root.tag != f"{{{SIRI}}}Siri":
        raise ValueError("Not a SIRI delivery")
    delivery = root.find(f"{{{SIRI}}}ServiceDelivery")
    if delivery is None:
        raise ValueError("SIRI ServiceDelivery missing")
    timestamp = datetime.fromisoformat(text(delivery, "ResponseTimestamp", SIRI) or "")
    if (
        timestamp.tzinfo is None
        or timestamp < now - timedelta(minutes=5)
        or timestamp > now + timedelta(minutes=1)
    ):
        raise ValueError("SIRI feed is stale or in the future")
    deliveries = delivery.findall(f"{{{SIRI}}}FacilityMonitoringDelivery")
    if len(deliveries) != 1:
        raise ValueError("Expected one complete facility monitoring delivery")
    monitoring = deliveries[0]
    if (
        monitoring is None
        or text(delivery, "Status", SIRI) == "false"
        or text(monitoring, "Status", SIRI) == "false"
    ):
        raise ValueError("SIRI facility delivery unsuccessful")
    statuses = {}
    for node in monitoring.findall(f"{{{SIRI}}}FacilityCondition"):
        reference = text(node, "FacilityRef", SIRI)
        status = text(node, "FacilityStatus/Status", SIRI)
        if not reference or status not in {
            "available",
            "notAvailable",
            "unknown",
            "partiallyAvailable",
        }:
            raise ValueError("Invalid SIRI facility condition")
        # SIRI's published DIID codespace is resolved independently of NeTEx prefixes.
        if not reference.startswith("diid:"):
            raise ValueError("Unknown SIRI codespace")
        identifier = "https://id.vdv.de/diid/" + quote(
            reference.split(":", 1)[1], safe=""
        )
        if identifier in statuses:
            raise ValueError("Duplicate SIRI facility reference")
        statuses[identifier] = {
            "status": status,
            "description": text(node, "FacilityStatus/Description", SIRI),
        }
    return timestamp, statuses


async def import_netex(conn, client, source):
    with TemporaryFile() as file:
        digest, attempt = await acquire_archive(conn, client, source, file)
        timestamp, stations = await asyncio.to_thread(parse_netex, file, source)
    async with conn.transaction():
        await publish(
            conn,
            source,
            "transport/bahn/stations",
            {
                "stations": stations,
                "license": "CC0-1.0",
                "attribution": "DB InfraGO AG",
                "position_basis": "infrastructure",
            },
            digest,
            timestamp,
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()


def facility_records(stations, statuses):
    """Match only known local assets; missing status remains unknown."""
    facilities = []
    for station in stations:
        for component in station["components"]:
            if component["type"] not in {
                "LiftEquipment",
                "EscalatorEquipment",
                "TravelatorEquipment",
            }:
                continue
            reported = statuses.get(component["id"])
            facilities.append(
                {
                    **component,
                    "station_id": station["id"],
                    "eva_number": station["eva_number"],
                    "status": reported["status"] if reported else "unknown",
                    "description": reported["description"] if reported else None,
                    "status_basis": "reported" if reported else "not_reported",
                }
            )
    return facilities


async def import_siri(conn, client, source):
    cursor = await conn.execute("""SELECT data FROM collected_datasets
        WHERE dataset='transport/bahn/stations' AND expires_at > NOW()""")
    inventory = await cursor.fetchone()
    await conn.commit()
    if not inventory:
        raise ValueError("Fresh OpenStation inventory required for facility matching")
    with TemporaryFile() as file:
        digest, attempt = await acquire_archive(conn, client, source, file)
        timestamp, statuses = parse_siri(file)
    facilities = facility_records(inventory[0]["stations"], statuses)
    async with conn.transaction():
        await publish(
            conn,
            source,
            "transport/bahn/facilities",
            {
                "facilities": facilities,
                "license": "CC0-1.0",
                "attribution": "DB InfraGO AG",
            },
            digest,
            timestamp,
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()


async def import_fasta(conn, client, source):
    """Optional REST alternative; stationnumber is not an EVA number."""
    allowed = set(source.get("station_numbers", []))
    if not allowed or any(not str(number).isdigit() for number in allowed):
        raise ValueError("Explicit FaSta station numbers required")
    allowed = {str(number) for number in allowed}
    response, digest, attempt = await acquire(conn, client, source)
    rows = response.json()
    if not isinstance(rows, list):
        raise TypeError("FaSta facilities must be an array")
    facilities, seen = [], set()
    for row in rows:
        identifier = str(row["equipmentnumber"])
        state = row["state"]
        if identifier in seen or state not in {"ACTIVE", "INACTIVE", "UNKNOWN"}:
            raise ValueError("Invalid or duplicate FaSta facility")
        seen.add(identifier)
        if str(row["stationnumber"]) not in allowed:
            continue
        facilities.append(
            {
                "id": identifier,
                "station_number": str(row["stationnumber"]),
                "type": row["type"],
                "status": state,
                "description": row.get("description"),
                "latitude": row.get("geocoordY"),
                "longitude": row.get("geocoordX"),
            }
        )
    # FaSta has no observation timestamp: explicitly expose retrieval basis.
    now = datetime.now(UTC)
    async with conn.transaction():
        await publish(
            conn,
            source,
            "transport/bahn/facilities-fasta",
            {
                "facilities": facilities,
                "timestamp_basis": "fetched",
                "license": "CC-BY-4.0",
                "attribution": "DB InfraGO AG",
            },
            digest,
            now,
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()


async def import_ris_stations(conn, client, source):
    """Cache per-EVA REST responses atomically; preserve DB's versioned schema."""
    numbers = source.get("eva_numbers", [])
    if not numbers or len(numbers) > 32 or any(not str(n).isdigit() for n in numbers):
        raise ValueError("RIS requires 1..32 explicit EVA numbers")
    responses = []
    for eva in numbers:
        response, digest, attempt = await acquire(
            conn, client, source, source["url"].rstrip("/") + "/" + str(eva)
        )
        body = response.json()
        if not isinstance(body, dict) or not isinstance(body.get("stopPlaces"), list):
            raise TypeError("RIS stopPlaces response expected")
        if not body["stopPlaces"] or any(
            not isinstance(p, dict) or str(p.get("evaNumber")) != str(eva)
            for p in body["stopPlaces"]
        ):
            raise ValueError("RIS station response does not match requested EVA")
        responses.append((eva, body, digest, attempt))
    now = datetime.now(UTC)
    async with conn.transaction():
        for eva, body, digest, attempt in responses:
            await publish(
                conn,
                source,
                f"transport/bahn/ris-stations/{eva}",
                {
                    "eva_number": str(eva),
                    "response": body,
                    "timestamp_basis": "fetched",
                    "attribution": "Deutsche Bahn",
                },
                digest,
                now,
            )
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
    await conn.commit()
