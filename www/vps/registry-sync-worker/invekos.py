"""Official Hessen INVEKOS Agricultural Parcels (Feldblöcke / Parzellen).

Fetches official cadastral crop parcels and reference field blocks from the State of Hesse
GDI/WFS service (lawi:Landwirtschaftliche Parzellen) for Bürstadt, Lampertheim, Biblis,
and Groß-Rohrheim.
"""

import json
from datetime import UTC, datetime
from typing import Any


def _compute_centroid(geometry: dict[str, Any]) -> tuple[float, float] | None:
    """Compute centroid (lat, lon) from GeoJSON Polygon or MultiPolygon."""
    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])
    points: list[list[float]] = []

    if gtype == "Polygon" and coords:
        points = coords[0]
    elif gtype == "MultiPolygon" and coords:
        for poly in coords:
            if poly:
                points.extend(poly[0])
    elif gtype == "Point" and coords:
        return float(coords[1]), float(coords[0])

    if not points:
        return None

    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return lat, lon


def parse_invekos_parcels(
    body: bytes,
    bbox: list[float] | None = None,
) -> tuple[datetime, list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Parse WFS GeoJSON into structured agricultural parcels."""
    data = json.loads(body.decode("utf-8"))
    features = data.get("features", [])

    south, west, north, east = (
        bbox if bbox and len(bbox) == 4 else (-90.0, -180.0, 90.0, 180.0)
    )

    now = datetime.now(UTC)
    parcels: list[dict[str, Any]] = []
    geojson_features: list[dict[str, Any]] = []

    crop_counts: dict[str, int] = {}
    crop_areas: dict[str, float] = {}
    total_area_ha = 0.0

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        if not geom:
            continue

        centroid = _compute_centroid(geom)
        if centroid is None:
            continue
        lat, lon = centroid

        if not (south <= lat <= north and west <= lon <= east):
            continue

        flik = (
            props.get("id")
            or feat.get("id")
            or props.get("flik")
            or props.get("FLIK")
        )
        if not flik:
            continue
        flik_str = str(flik)

        raw_area = props.get("declaredArea") or props.get("area") or 0.0
        try:
            area_ha = float(raw_area)
        except (ValueError, TypeError):
            area_ha = 0.0

        crop_code = str(props.get("mainCrop") or "")
        crop_name = (
            props.get("mainCrop_txt")
            or props.get("nutzung")
            or props.get("kategorie")
            or "Landwirtschaftliche Fläche"
        )
        valid_from = props.get("validFrom")
        valid_to = props.get("validTo")
        organic = props.get("organicFarming")
        is_organic = bool(organic) if organic is not None else False

        parcel_id = f"invekos-{flik_str.lower().replace('.', '-').replace(':', '-')}"

        parcel_dict = {
            "id": parcel_id,
            "flik": flik_str,
            "cropCode": crop_code,
            "cropName": crop_name,
            "areaHa": round(area_ha, 4),
            "lat": round(lat, 6),
            "lng": round(lon, 6),
            "validFrom": valid_from,
            "validTo": valid_to,
            "organicFarming": is_organic,
            "source": "INVEKOS Hessen",
            "sourceUpdatedAt": now.isoformat(),
        }
        parcels.append(parcel_dict)

        total_area_ha += area_ha
        crop_counts[crop_name] = crop_counts.get(crop_name, 0) + 1
        crop_areas[crop_name] = round(
            crop_areas.get(crop_name, 0.0) + area_ha, 4
        )

        geojson_features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "id": parcel_id,
                    "flik": flik_str,
                    "cropCode": crop_code,
                    "cropName": crop_name,
                    "areaHa": round(area_ha, 4),
                    "organicFarming": is_organic,
                    "source": "INVEKOS Hessen",
                },
            }
        )

    geojson_collection = {
        "type": "FeatureCollection",
        "features": geojson_features,
    }

    summary_stats = {
        "total_parcels": len(parcels),
        "total_area_ha": round(total_area_ha, 2),
        "crop_counts": crop_counts,
        "crop_areas": crop_areas,
        "organic_count": sum(1 for p in parcels if p["organicFarming"]),
    }

    return now, parcels, geojson_collection, summary_stats


async def import_invekos(conn, client, source):
    """Acquire Hessen INVEKOS agricultural parcels, persist entities/measurements and publish."""
    from publications import acquire, publish

    response, digest, attempt_id = await acquire(conn, client, source)
    source_time, parcels, geojson, summary = parse_invekos_parcels(
        response.content,
        bbox=source.get("bbox"),
    )

    async with conn.transaction():
        # 1. Publish datasets
        await publish(
            conn,
            source,
            "environment/agriculture/parcels",
            {"summary": summary, "parcels": parcels, "count": len(parcels)},
            digest,
            source_time,
        )
        await publish(
            conn,
            source,
            "map/layers/crops_invekos",
            geojson,
            digest,
            source_time,
        )

        # 2. Persist to entities and measurements (Core Three-Table Schema)
        for p in parcels:
            entity_key = f"field:{p['flik'].lower().replace('.', '-')}"
            metadata = {
                "flik": p["flik"],
                "crop_code": p["cropCode"],
                "crop_name": p["cropName"],
                "area_ha": p["areaHa"],
                "centroid": [p["lng"], p["lat"]],
                "source": "INVEKOS Hessen",
                "valid_from": p["validFrom"],
                "valid_to": p["validTo"],
                "organic_farming": p["organicFarming"],
            }
            await conn.execute(
                """INSERT INTO entities (id, name, entity_type, metadata)
                VALUES (%s, %s, 'agricultural_field', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metadata = entities.metadata || EXCLUDED.metadata,
                    updated_at = NOW()""",
                (
                    entity_key,
                    f"Feldparzelle {p['cropName']} ({p['flik']})",
                    json.dumps(metadata),
                ),
            )

            # Area measurement
            await conn.execute(
                """SELECT write_measurement(
                    %s, 'area', 'ha', %s, 'reported',
                    '{"source": "INVEKOS"}'::jsonb,
                    %s, %s, %s,
                    %s::jsonb, 'valid', NULL, NULL, 'reference'
                )""",
                (
                    entity_key,
                    source["id"],
                    source_time,
                    p["areaHa"],
                    source_time,
                    json.dumps({"payload_sha256": digest, "flik": p["flik"]}),
                ),
            )

            # Coordinates via write_measurement
            for metric, val in (("latitude", p["lat"]), ("longitude", p["lng"])):
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
                        json.dumps({"payload_sha256": digest, "flik": p["flik"]}),
                    ),
                )

        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s",
            (attempt_id,),
        )
    await conn.commit()
