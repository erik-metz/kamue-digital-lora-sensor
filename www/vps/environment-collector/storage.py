"""Database persistence for environment observations."""

from datetime import datetime, timedelta

from psycopg.types.json import Jsonb


async def persist_environment_data(
    conn, gauges, weather_list, fetched_at: datetime, *, payload=None, source_url=""
) -> dict[str, int]:
    updated_gauges = 0
    updated_weather = 0

    async with conn.transaction():
        # 1. Update Gauges
        for g in gauges:
            await conn.execute(
                """
                INSERT INTO flood_gauges (id, name, water_body, municipality, latitude, longitude, current_level_m, alarm_level_1_m, alarm_level_2_m, alarm_level_3_m, status, source, source_station_id, updated_at)
                VALUES (%s, %s, %s, 'Worms', %s, %s, %s, NULL, NULL, NULL, %s, 'pegelonline_wsv', %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, current_level_m = EXCLUDED.current_level_m,
                    status = EXCLUDED.status,
                    alarm_level_1_m=NULL, alarm_level_2_m=NULL, alarm_level_3_m=NULL,
                    updated_at = EXCLUDED.updated_at
                WHERE EXCLUDED.updated_at >= flood_gauges.updated_at
                """,
                (
                    g.id,
                    g.name,
                    g.water_body,
                    g.latitude,
                    g.longitude,
                    g.level_m,
                    g.status,
                    g.source_station_id,
                    g.measured_at,
                ),
            )
            updated_gauges += 1

        # 2. Update Weather in sensor_data & sensor_latest
        for w in weather_list:
            await conn.execute(
                """
                INSERT INTO sensor_metadata (id, friendly_name, latitude, longitude, description)
                VALUES (%s, 'DWD ICON Wettermodell Ried', %s, %s, 'DWD ICON / Open-Meteo Modellwerte; keine Stationsmessung')
                ON CONFLICT (id) DO UPDATE SET friendly_name=EXCLUDED.friendly_name,
                    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, description=EXCLUDED.description
                """,
                (w.sensor_id, w.latitude, w.longitude),
            )
            for metric, unit, value in (
                ("temperature", "°C", w.temperature),
                ("relative_humidity", "%", w.humidity),
                ("precipitation", "mm", w.precipitation),
            ):
                if value is None:
                    continue
                await conn.execute(
                    """INSERT INTO sensor_data(sensor_id,metric,unit,timestamp,value)
                    VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (w.sensor_id, metric, unit, w.timestamp, value),
                )
                await conn.execute(
                    """INSERT INTO sensor_latest(sensor_id,metric,unit,timestamp,value)
                    VALUES (%s,%s,%s,%s,%s) ON CONFLICT(sensor_id,metric,unit) DO UPDATE SET
                    timestamp=EXCLUDED.timestamp,value=EXCLUDED.value
                    WHERE EXCLUDED.timestamp >= sensor_latest.timestamp""",
                    (w.sensor_id, metric, unit, w.timestamp, value),
                )
                updated_weather += 1
        if payload and gauges:
            data = [
                {
                    "id": g.id,
                    "name": g.name,
                    "water_body": g.water_body,
                    "current_level_m": g.level_m,
                    "latitude": g.latitude,
                    "longitude": g.longitude,
                    "source_station_id": g.source_station_id,
                    "updated_at": g.measured_at.isoformat(),
                }
                for g in gauges
            ]
            source_time = min(g.measured_at for g in gauges)
            digest = payload["pegel_sha256"]
            await conn.execute(
                """INSERT INTO collected_dataset_versions(dataset,payload_sha256,source_updated_at,data)
                VALUES ('environment/flood/gauges',%s,%s,%s) ON CONFLICT DO NOTHING""",
                (digest, source_time, Jsonb(data)),
            )
            await conn.execute(
                """INSERT INTO collected_datasets(dataset,source_id,source_url,source_updated_at,fetched_at,expires_at,payload_sha256,data)
                VALUES ('environment/flood/gauges','environment-pegel',%s,%s,%s,%s,%s,%s)
                ON CONFLICT(dataset) DO UPDATE SET source_updated_at=EXCLUDED.source_updated_at,fetched_at=EXCLUDED.fetched_at,
                expires_at=EXCLUDED.expires_at,payload_sha256=EXCLUDED.payload_sha256,data=EXCLUDED.data
                WHERE EXCLUDED.source_updated_at >= collected_datasets.source_updated_at""",
                (
                    source_url.split("?")[0],
                    source_time,
                    fetched_at,
                    source_time + timedelta(hours=1),
                    digest,
                    Jsonb(data),
                ),
            )
            map_data = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [g.longitude, g.latitude],
                        },
                        "properties": {
                            "name": g.name,
                            "level_m": g.level_m,
                            "measured_at": g.measured_at.isoformat(),
                        },
                    }
                    for g in gauges
                    if g.latitude is not None and g.longitude is not None
                ],
            }
            await conn.execute(
                """INSERT INTO collected_datasets(dataset,source_id,source_url,source_updated_at,fetched_at,expires_at,payload_sha256,data)
                VALUES ('map/layers/floods','environment-pegel',%s,%s,%s,%s,%s,%s)
                ON CONFLICT(dataset) DO UPDATE SET source_updated_at=EXCLUDED.source_updated_at,fetched_at=EXCLUDED.fetched_at,
                expires_at=EXCLUDED.expires_at,payload_sha256=EXCLUDED.payload_sha256,data=EXCLUDED.data
                WHERE EXCLUDED.source_updated_at >= collected_datasets.source_updated_at""",
                (
                    source_url.split("?")[0],
                    source_time,
                    fetched_at,
                    source_time + timedelta(hours=1),
                    digest,
                    Jsonb(map_data),
                ),
            )
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE payload_sha256 IN (%s,%s) AND source_id LIKE 'environment-%%'",
                (digest, payload["weather_sha256"]),
            )

    return {"gauges": updated_gauges, "weather_metrics": updated_weather}
