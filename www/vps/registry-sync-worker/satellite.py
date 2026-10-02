"""Copernicus Sentinel-2 Satellite Earth Observation Adapter (Hessisches Ried).

Queries Copernicus Sentinel-2 Level-2A bottom-of-atmosphere scenes (Tile 32UMA / 32UMV)
covering Bürstadt, Lampertheim, Biblis, and Groß-Rohrheim.
Extracts cloud coverage, vegetation coverage, Cloud-Optimized GeoTIFF (COG) asset links
for visual (TCI RGB), red (B04), and near-infrared (B08) bands.
Persists scenes into entities and readings (Three-Table Core Schema) without ad-hoc SQL tables.
"""

import json
from datetime import UTC, datetime
from typing import Any


def parse_satellite_scenes(
    body: bytes,
    max_cloud_cover: float = 30.0,
    bbox: list[float] | None = None,
) -> tuple[datetime, list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Parse STAC GeoJSON into structured Sentinel-2 scenes."""
    data = json.loads(body.decode("utf-8"))
    features = data.get("features", [])

    now = datetime.now(UTC)
    scenes: list[dict[str, Any]] = []
    geojson_features: list[dict[str, Any]] = []

    for feat in features:
        props = feat.get("properties", {})
        assets = feat.get("assets", {})
        geom = feat.get("geometry", {})
        scene_id = feat.get("id") or props.get("s2:product_uri")
        if not scene_id:
            continue

        cloud_cover = float(props.get("eo:cloud_cover") or props.get("cloudCover") or 0.0)
        if cloud_cover > max_cloud_cover:
            continue

        raw_dt = props.get("datetime") or props.get("created")
        if raw_dt:
            try:
                scene_time = datetime.fromisoformat(raw_dt)
            except ValueError:
                scene_time = now
        else:
            scene_time = now

        date_str = scene_time.strftime("%Y-%m-%d")
        platform = props.get("platform") or "Sentinel-2"
        grid_square = props.get("mgrs:grid_square") or "Ried"
        veg_cover = float(props.get("s2:vegetation_percentage") or 0.0)
        water_cover = float(props.get("s2:water_percentage") or 0.0)

        # Asset links (Cloud-Optimized GeoTIFFs & Web Preview)
        visual_cog = assets.get("visual", {}).get("href")
        red_cog = assets.get("red", {}).get("href")
        green_cog = assets.get("green", {}).get("href")
        blue_cog = assets.get("blue", {}).get("href")
        nir_cog = assets.get("nir", {}).get("href")
        thumbnail_url = assets.get("thumbnail", {}).get("href") or assets.get("preview", {}).get("href")

        # Centroid coordinates
        centroid = props.get("proj:centroid")
        if centroid and isinstance(centroid, dict):
            lat = float(centroid.get("lat") or 49.6425)
            lon = float(centroid.get("lon") or 8.4552)
        else:
            lat, lon = 49.6425, 8.4552

        entity_id = f"satellite-scene-{scene_id.lower().replace('_', '-')}"
        friendly_name = f"Sentinel-2 Szene {date_str} (Tile {grid_square})"

        scene_dict = {
            "id": entity_id,
            "sceneId": scene_id,
            "name": friendly_name,
            "date": date_str,
            "datetime": scene_time.isoformat(),
            "platform": platform,
            "gridSquare": grid_square,
            "cloudCoverPercent": round(cloud_cover, 2),
            "vegetationPercent": round(veg_cover, 2),
            "waterPercent": round(water_cover, 2),
            "lat": round(lat, 6),
            "lng": round(lon, 6),
            "assets": {
                "visualCog": visual_cog,
                "redCog": red_cog,
                "greenCog": green_cog,
                "blueCog": blue_cog,
                "nirCog": nir_cog,
                "thumbnailUrl": thumbnail_url,
            },
            "source": "Copernicus Sentinel-2",
            "sourceUpdatedAt": now.isoformat(),
        }
        scenes.append(scene_dict)

        geojson_features.append(
            {
                "type": "Feature",
                "geometry": geom if geom else {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "id": entity_id,
                    "sceneId": scene_id,
                    "name": friendly_name,
                    "date": date_str,
                    "cloudCover": round(cloud_cover, 1),
                    "vegetationCover": round(veg_cover, 1),
                    "thumbnailUrl": thumbnail_url,
                    "visualCog": visual_cog,
                },
            }
        )

    geojson_collection = {
        "type": "FeatureCollection",
        "features": geojson_features,
    }

    summary_stats = {
        "total_scenes": len(scenes),
        "latest_scene_date": scenes[0]["date"] if scenes else None,
        "latest_scene_cloud_cover": scenes[0]["cloudCoverPercent"] if scenes else None,
        "latest_scene_vegetation": scenes[0]["vegetationPercent"] if scenes else None,
        "latest_scene_thumbnail": scenes[0]["assets"]["thumbnailUrl"] if scenes else None,
    }

    return now, scenes, geojson_collection, summary_stats


async def import_satellite(conn, client, source):
    """Acquire Copernicus Sentinel-2 STAC scenes, persist entities/measurements and publish."""
    from publications import acquire, publish

    response, digest, attempt_id = await acquire(conn, client, source)
    max_cloud = float(source.get("max_cloud_cover", 30.0))
    source_time, scenes, geojson, summary = parse_satellite_scenes(
        response.content,
        max_cloud_cover=max_cloud,
        bbox=source.get("bbox"),
    )

    async with conn.transaction():
        # 1. Publish datasets
        await publish(
            conn,
            source,
            "environment/satellite/scenes",
            {"summary": summary, "scenes": scenes, "count": len(scenes)},
            digest,
            source_time,
        )
        await publish(
            conn,
            source,
            "map/layers/satellite_latest",
            geojson,
            digest,
            source_time,
        )

        # 2. Persist to entities and readings (Core Three-Table Schema)
        for s in scenes:
            entity_key = s["id"]
            metadata = {
                "scene_id": s["sceneId"],
                "platform": s["platform"],
                "grid_square": s["gridSquare"],
                "date": s["date"],
                "cloud_cover": s["cloudCoverPercent"],
                "vegetation_cover": s["vegetationPercent"],
                "water_cover": s["waterPercent"],
                "assets": s["assets"],
                "source": "Copernicus Sentinel-2",
            }
            await conn.execute(
                """INSERT INTO entities (id, name, entity_type, metadata)
                VALUES (%s, %s, 'satellite_scene', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    metadata = entities.metadata || EXCLUDED.metadata,
                    updated_at = NOW()""",
                (
                    entity_key,
                    s["name"],
                    json.dumps(metadata),
                ),
            )

            try:
                obs_time = datetime.fromisoformat(s["datetime"])
            except ValueError:
                obs_time = source_time

            # Cloud cover measurement
            await conn.execute(
                """SELECT write_measurement(
                    %s, 'cloud_cover', '%%', %s, 'observed',
                    '{"satellite": "Sentinel-2"}'::jsonb,
                    %s, %s, %s,
                    %s, 'valid', NULL, NULL, 'instantaneous'
                )""",
                (
                    entity_key,
                    source["id"],
                    obs_time,
                    s["cloudCoverPercent"],
                    source_time,
                    json.dumps({"payload_sha256": digest, "scene_id": s["sceneId"]}),
                ),
            )

            # Vegetation coverage percentage measurement
            if s["vegetationPercent"] > 0:
                await conn.execute(
                    """SELECT write_measurement(
                        %s, 'vegetation_coverage', '%%', %s, 'observed',
                        '{"satellite": "Sentinel-2"}'::jsonb,
                        %s, %s, %s,
                        %s, 'valid', NULL, NULL, 'instantaneous'
                    )""",
                    (
                        entity_key,
                        source["id"],
                        obs_time,
                        s["vegetationPercent"],
                        source_time,
                        json.dumps({"payload_sha256": digest, "scene_id": s["sceneId"]}),
                    ),
                )

            # Coordinates via write_measurement
            for metric, val in (("latitude", s["lat"]), ("longitude", s["lng"])):
                await conn.execute(
                    """SELECT write_measurement(
                        %s, %s, 'degrees', %s, 'reported',
                        '{"crs": "EPSG:4326"}'::jsonb,
                        %s, %s, %s,
                        %s, 'valid', NULL, NULL, 'reference'
                    )""",
                    (
                        entity_key,
                        metric,
                        source["id"],
                        source_time,
                        val,
                        source_time,
                        json.dumps({"payload_sha256": digest, "scene_id": s["sceneId"]}),
                    ),
                )

        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s",
            (attempt_id,),
        )
    await conn.commit()
