"""Database persistence for Nextbike stations, time-series observations, and individual bike trips."""

import logging
from collections import Counter

from normalize import NextbikeStationData, haversine_meters
from psycopg.rows import dict_row

LOG = logging.getLogger("nextbike-collector")


async def ingest_nextbike_data(conn, stations: list[NextbikeStationData]) -> Counter:
    """Persist station metadata, time-series telemetry, bike locations, and trips transactionally."""
    stats = Counter(
        stations_updated=0,
        observations_inserted=0,
        trips_detected=0,
        bikes_updated=0,
    )
    if not stations:
        return stats

    async with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")
        # Serialize Nextbike ingestion with an advisory lock
        await cur.execute("SELECT pg_advisory_xact_lock(734220, 1)")

        # 1. Fetch current known bike states to detect trips
        await cur.execute(
            """SELECT bike_number, current_station_id, current_station_name,
                      latitude, longitude, last_seen_at
               FROM nextbike_bikes"""
        )
        previous_bikes = {row["bike_number"]: row for row in await cur.fetchall()}

        for station in stations:
            sid = station.sensor_id

            # Upsert sensor_metadata
            await cur.execute(
                """INSERT INTO sensor_metadata
                   (id, friendly_name, latitude, longitude, description)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET
                       friendly_name = EXCLUDED.friendly_name,
                       latitude = EXCLUDED.latitude,
                       longitude = EXCLUDED.longitude,
                       description = EXCLUDED.description,
                       updated_at = NOW()""",
                (
                    sid,
                    station.name,
                    station.lat,
                    station.lng,
                    f"VRNnextbike Station {station.station_number or station.station_uid} · {station.city_name} · Offizieller Live-Feed",
                ),
            )

            # Upsert nextbike_sources
            await cur.execute(
                """INSERT INTO nextbike_sources
                   (sensor_id, station_uid, station_number, city_id, city_name, spot, terminal_type, bike_racks, last_fetched_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (sensor_id) DO UPDATE SET
                       station_number = EXCLUDED.station_number,
                       spot = EXCLUDED.spot,
                       terminal_type = EXCLUDED.terminal_type,
                       bike_racks = EXCLUDED.bike_racks,
                       last_fetched_at = EXCLUDED.last_fetched_at""",
                (
                    sid,
                    station.station_uid,
                    station.station_number,
                    station.city_id,
                    station.city_name,
                    station.spot,
                    station.terminal_type,
                    station.bike_racks,
                    station.timestamp,
                ),
            )
            stats["stations_updated"] += 1

            # 2. Time-series metrics to record
            metrics_to_record = [
                ("bike_available", float(station.bikes), "count"),
                ("bike_racks_free", float(station.free_racks), "count"),
                ("bike_capacity", float(station.bike_racks), "count"),
                ("bike_ebikes", float(station.ebikes_count), "count"),
            ]

            for metric_name, metric_val, metric_unit in metrics_to_record:
                # Check previous observation for this sensor and metric
                await cur.execute(
                    """SELECT value, observed_at FROM nextbike_observations
                       WHERE sensor_id = %s AND metric = %s
                       ORDER BY observed_at DESC LIMIT 1""",
                    (sid, metric_name),
                )
                prev_obs = await cur.fetchone()

                # Insert observation if value changed or if > 15 minutes since last recorded sample
                should_insert = False
                if not prev_obs or prev_obs["value"] != metric_val:
                    should_insert = True
                else:
                    elapsed = (station.timestamp - prev_obs["observed_at"]).total_seconds()
                    if elapsed >= 900:  # 15 minutes heartbeat
                        should_insert = True

                if should_insert:
                    # Record in sensor_data (trigger maintains sensor_latest)
                    await cur.execute(
                        """INSERT INTO sensor_data (timestamp, sensor_id, metric, value, unit)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (station.timestamp, sid, metric_name, metric_val, metric_unit),
                    )
                    # Record in nextbike_observations
                    bike_nums_list = list(station.bike_numbers) if metric_name == "bike_available" else []
                    await cur.execute(
                        """INSERT INTO nextbike_observations
                           (sensor_id, metric, observed_at, value, bike_numbers, first_fetched_at)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           ON CONFLICT (sensor_id, metric, observed_at) DO UPDATE SET
                               value = EXCLUDED.value,
                               bike_numbers = EXCLUDED.bike_numbers""",
                        (sid, metric_name, station.timestamp, metric_val, bike_nums_list, station.timestamp),
                    )
                    stats["observations_inserted"] += 1

            # 3. Individual Bike Tracking & Trip Detection
            for bike in station.bikes_detail:
                bnum = bike.bike_number
                prev = previous_bikes.get(bnum)

                if prev:
                    old_sid = prev.get("current_station_id")
                    old_name = prev.get("current_station_name")
                    old_lat = prev.get("latitude")
                    old_lng = prev.get("longitude")
                    old_time = prev.get("last_seen_at")

                    # Check if bike moved to a different station!
                    if old_sid and old_sid != sid:
                        start_time = old_time or station.timestamp
                        end_time = station.timestamp
                        duration_sec = max(60, int((end_time - start_time).total_seconds()))

                        distance_m = None
                        if old_lat is not None and old_lng is not None:
                            distance_m = round(haversine_meters(old_lat, old_lng, station.lat, station.lng), 1)

                        await cur.execute(
                            """INSERT INTO nextbike_trips
                               (bike_number, start_station_id, start_station_name, end_station_id, end_station_name,
                                start_time, end_time, duration_seconds, distance_meters)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (
                                bnum,
                                old_sid,
                                old_name,
                                sid,
                                station.name,
                                start_time,
                                end_time,
                                duration_sec,
                                distance_m,
                            ),
                        )
                        stats["trips_detected"] += 1
                        LOG.info(
                            "Trip detected! Bike %s moved from %s to %s (est. %.0fm, %ds)",
                            bnum,
                            old_name,
                            station.name,
                            distance_m or 0,
                            duration_sec,
                        )

                # Upsert current bike location
                await cur.execute(
                    """INSERT INTO nextbike_bikes
                       (bike_number, current_station_id, current_station_name, bike_type,
                        electric_lock, pedelec_battery, state, latitude, longitude, last_seen_at, is_active)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                       ON CONFLICT (bike_number) DO UPDATE SET
                           current_station_id = EXCLUDED.current_station_id,
                           current_station_name = EXCLUDED.current_station_name,
                           bike_type = EXCLUDED.bike_type,
                           electric_lock = EXCLUDED.electric_lock,
                           pedelec_battery = EXCLUDED.pedelec_battery,
                           state = EXCLUDED.state,
                           latitude = EXCLUDED.latitude,
                           longitude = EXCLUDED.longitude,
                           last_seen_at = EXCLUDED.last_seen_at,
                           is_active = TRUE""",
                    (
                        bnum,
                        sid,
                        station.name,
                        bike.bike_type,
                        bike.electric_lock,
                        bike.pedelec_battery,
                        bike.state,
                        station.lat,
                        station.lng,
                        station.timestamp,
                    ),
                )
                stats["bikes_updated"] += 1

    return stats
