"""Database persistence for environment observations."""

from datetime import datetime


async def persist_environment_data(conn, gauges, weather_list, fetched_at: datetime) -> dict[str, int]:
    updated_gauges = 0
    updated_weather = 0

    async with conn.transaction():
        # 1. Update Gauges
        for g in gauges:
            await conn.execute(
                """
                INSERT INTO flood_gauges (id, name, water_body, municipality, latitude, longitude, current_level_m, alarm_level_1_m, alarm_level_2_m, alarm_level_3_m, status, source, source_station_id, updated_at)
                VALUES (%s, %s, %s, 'Worms / Riedufer', 49.6315, 8.3755, %s, 4.50, 5.50, 6.50, %s, 'pegelonline_wsv', %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    current_level_m = EXCLUDED.current_level_m,
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at
                """,
                (g.id, g.name, g.water_body, g.level_m, g.status, g.source_station_id, g.measured_at),
            )
            updated_gauges += 1

        # 2. Update Weather in sensor_data & sensor_latest
        for w in weather_list:
            await conn.execute(
                """
                INSERT INTO sensor_metadata (id, friendly_name, latitude, longitude, description)
                VALUES (%s, 'DWD Wetterstation Ried (Bürstadt / Worms)', 49.6425, 8.4552, 'Regionaler DWD ICON / Open-Meteo Wetterreferenzpunkt')
                ON CONFLICT (id) DO NOTHING
                """,
                (w.sensor_id,),
            )
            if w.temperature is not None:
                await conn.execute(
                    """
                    INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
                    VALUES (%s, 'temperature', '°C', %s, %s)
                    ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
                        timestamp = EXCLUDED.timestamp, value = EXCLUDED.value
                    """,
                    (w.sensor_id, w.timestamp, w.temperature),
                )
                updated_weather += 1
            if w.precipitation is not None:
                await conn.execute(
                    """
                    INSERT INTO sensor_latest (sensor_id, metric, unit, timestamp, value)
                    VALUES (%s, 'precipitation', 'mm', %s, %s)
                    ON CONFLICT (sensor_id, metric, unit) DO UPDATE SET
                        timestamp = EXCLUDED.timestamp, value = EXCLUDED.value
                    """,
                    (w.sensor_id, w.timestamp, w.precipitation),
                )
                updated_weather += 1

    return {"gauges": updated_gauges, "weather_metrics": updated_weather}
