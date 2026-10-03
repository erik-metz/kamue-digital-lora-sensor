"""Official HLNUG Groundwater Monitoring Station Inventory (Hessisches Ried).

Fetches official groundwater stations and observation wells from the State of Hesse
environmental geodienste (HLNUG / ArcGIS REST API) for Bürstadt, Lampertheim, Biblis,
and Groß-Rohrheim.
"""

import json
from datetime import UTC, datetime
from typing import Any


def parse_hlnug_groundwater(
    body: bytes,
    municipalities: list[str] | None = None,
    bbox: list[float] | None = None,
) -> tuple[datetime, list[dict[str, Any]], dict[str, Any]]:
    """Parse ArcGIS REST query JSON into structured groundwater stations."""
    data = json.loads(body.decode("utf-8"))
    features = data.get("features", [])

    muni_set = {m.lower() for m in municipalities} if municipalities else set()
    south, west, north, east = bbox if bbox and len(bbox) == 4 else (-90.0, -180.0, 90.0, 180.0)

    now = datetime.now(UTC)
    stations: list[dict[str, Any]] = []
    geojson_features: list[dict[str, Any]] = []

    for feat in features:
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry", {})
        lon = geom.get("x")
        lat = geom.get("y")
        if lat is None or lon is None:
            continue

        lat_f = float(lat)
        lon_f = float(lon)
        if not (south <= lat_f <= north and west <= lon_f <= east):
            continue

        muni = attrs.get("GEMEINDE_NAME") or ""
        if muni_set and muni.lower() not in muni_set:
            continue

        raw_id = attrs.get("ID") or attrs.get("GWM_ID") or attrs.get("OBJECTID")
        if raw_id is None:
            continue

        station_id = f"hlnug-gw-{raw_id}"
        name = attrs.get("MESSTELLENNAME") or attrs.get("KURZNAME") or f"Messstelle {raw_id}"
        station_type = attrs.get("MESSSTELLENART") or attrs.get("GWM_TYP") or "Messstelle"
        operator = attrs.get("BETREIBER_NAME") or "Land Hessen (HLNUG)"
        purpose = attrs.get("MASSGEBL_ZWECK") or "Grundwassermonitoring"

        desc_parts = [f"HLNUG Grundwassermessstelle ({station_type})"]
        if muni:
            desc_parts.append(f"Gemeinde {muni}")
        if operator:
            desc_parts.append(f"Betreiber: {operator}")
        description = ", ".join(desc_parts)

        station_dict = {
            "id": station_id,
            "stationNumber": str(raw_id),
            "name": name,
            "friendlyName": f"{name} ({muni})" if muni and muni not in name else name,
            "municipality": muni,
            "operator": operator,
            "stationType": station_type,
            "purpose": purpose,
            "lat": lat_f,
            "lng": lon_f,
            "description": description,
            "source": "HLNUG",
            "sourceUpdatedAt": now.isoformat(),
        }
        stations.append(station_dict)

        geojson_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon_f, lat_f],
                },
                "properties": {
                    "id": station_id,
                    "name": name,
                    "municipality": muni,
                    "operator": operator,
                    "stationType": station_type,
                },
            }
        )

    geojson_collection = {
        "type": "FeatureCollection",
        "features": geojson_features,
    }
    return now, stations, geojson_collection


async def import_groundwater(conn, client, source):
    """Acquire HLNUG groundwater features, persist entities/measurements and publish."""
    from publications import acquire, publish

    response, digest, attempt_id = await acquire(conn, client, source)
    source_time, stations, geojson = parse_hlnug_groundwater(
        response.content,
        municipalities=source.get("municipalities"),
        bbox=source.get("bbox"),
    )

    async with conn.transaction():
        # 1. Publish datasets
        await publish(
            conn,
            source,
            "environment/groundwater",
            {"stations": stations, "count": len(stations)},
            digest,
            source_time,
        )
        await publish(
            conn,
            source,
            "map/layers/groundwater",
            geojson,
            digest,
            source_time,
        )

        # 2. Persist to entities, measurements, and compatibility table
        for st in stations:
            entity_key = f"groundwater:{st['id']}"
            metadata = {
                "municipality": st["municipality"],
                "operator": st["operator"],
                "station_type": st["stationType"],
                "source": "HLNUG",
                "source_station_id": st["stationNumber"],
            }
            await conn.execute(
                """INSERT INTO entities (id, name, entity_type, metadata)
                VALUES (%s, %s, 'groundwater_station', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metadata = entities.metadata || EXCLUDED.metadata,
                    updated_at = NOW()""",
                (entity_key, st["friendlyName"], json.dumps(metadata)),
            )

            # Coordinates via write_measurement
            for metric, val in (("latitude", st["lat"]), ("longitude", st["lng"])):
                await conn.execute(
                    """SELECT write_measurement(
                        %s, %s, 'degrees', %s, 'reported',
                        '{"crs": "EPSG:4326"}'::jsonb,
                        %s, %s, %s,
                        %s::jsonb, 'valid', NULL, NULL, 'reference'
                    )""",
                    (
                        entity_key,
                        metric,
                        source["id"],
                        source_time,
                        val,
                        source_time,
                        json.dumps({"payload_sha256": digest, "source": "HLNUG"}),
                    ),
                )

            # Compatibility table groundwater_stations
            await conn.execute(
                """INSERT INTO groundwater_stations (id, name, latitude, longitude, description, measured_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    description = EXCLUDED.description,
                    measured_at = EXCLUDED.measured_at""",
                (
                    st["id"],
                    st["friendlyName"],
                    st["lat"],
                    st["lng"],
                    st["description"],
                    source_time,
                ),
            )

        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s",
            (attempt_id,),
        )
    await conn.commit()
