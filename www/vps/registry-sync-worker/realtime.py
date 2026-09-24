"""GTFS-RT observations and cancellation/delay inputs for the shared predictor."""

from datetime import UTC, datetime, timedelta

from google.transit import gtfs_realtime_pb2
from prediction import store_position
from publications import acquire


def reported_delay(update, metadata, timestamp):
    """Use a provider delay; next-stop delay is explicitly a whole-trip approximation."""
    if update.HasField("delay"):
        return update.delay, "trip"
    stops = metadata.get("stop_times", [])
    candidates = []
    for item in update.stop_time_update:
        if item.schedule_relationship != 0:  # SKIPPED/NO_DATA do not imply on-time.
            continue
        matches = [
            s
            for s in stops
            if (item.HasField("stop_sequence") and s["sequence"] == item.stop_sequence)
            or (not item.HasField("stop_sequence") and s["stop_id"] == item.stop_id)
        ]
        if len(matches) != 1:
            continue
        stop = matches[0]
        for field in ["departure", "arrival"]:
            if not item.HasField(field):
                continue
            event = getattr(item, field)
            delay = (
                event.delay
                if event.HasField("delay")
                else int(event.time - stop[field])
                if event.HasField("time")
                else None
            )
            if delay is not None:
                candidates.append((stop[field], delay))
                break
    future = sorted((t, d) for t, d in candidates if t + d >= timestamp)
    if future:
        return future[0][1], "next_reported_stop_approximation"
    return (0, "schedule_only")


async def import_realtime(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(response.content)
    now = datetime.now(UTC)
    if not feed.header.HasField("timestamp"):
        raise ValueError("GTFS-RT timestamp missing")
    timestamp = datetime.fromtimestamp(feed.header.timestamp, UTC)
    if timestamp < now - timedelta(minutes=5) or timestamp > now + timedelta(minutes=1):
        raise ValueError("GTFS-RT feed is stale or in the future")
    async with conn.transaction():
        for entity in feed.entity:
            if entity.is_deleted:
                continue
            update = entity.trip_update if entity.HasField("trip_update") else None
            vehicle = entity.vehicle if entity.HasField("vehicle") else None
            trip = update.trip if update else vehicle.trip if vehicle else None
            if not trip or not trip.trip_id or not trip.start_date:
                continue
            day = (
                datetime.strptime(trip.start_date, "%Y%m%d").replace(tzinfo=UTC).date()
            )
            cursor = await conn.execute(
                "SELECT kind,metadata FROM movement_schedules WHERE source_id=%s AND trip_id=%s AND service_date=%s",
                (source["schedule_source"], trip.trip_id, day),
            )
            schedule = await cursor.fetchone()
            if not schedule:
                continue
            if update:
                cancelled = trip.schedule_relationship in (3, 6)  # CANCELED / DELETED
                delay, delay_basis = reported_delay(
                    update, schedule[1], timestamp.timestamp()
                )
                applied = await conn.execute(
                    """INSERT INTO movement_trip_updates(source_id,trip_id,service_date,observed_at,
                    valid_until,cancelled,delay_seconds,payload_sha256,delay_basis) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT(source_id,trip_id,service_date) DO UPDATE SET observed_at=EXCLUDED.observed_at,
                    valid_until=EXCLUDED.valid_until,cancelled=EXCLUDED.cancelled,delay_seconds=EXCLUDED.delay_seconds,
                    payload_sha256=EXCLUDED.payload_sha256,delay_basis=EXCLUDED.delay_basis WHERE EXCLUDED.observed_at >= movement_trip_updates.observed_at""",
                    (
                        source["schedule_source"],
                        trip.trip_id,
                        day,
                        timestamp,
                        timestamp + timedelta(hours=36)
                        if cancelled
                        else timestamp + timedelta(minutes=3),
                        cancelled,
                        delay,
                        digest,
                        delay_basis,
                    ),
                )
                if cancelled and applied.rowcount:
                    await conn.execute(
                        "DELETE FROM movement_latest WHERE entity_id=%s",
                        (f"{source['schedule_source']}:{day}:{trip.trip_id}",),
                    )
            if (
                vehicle
                and vehicle.HasField("position")
                and vehicle.HasField("timestamp")
            ):
                observed = datetime.fromtimestamp(vehicle.timestamp, UTC)
                if (
                    not now - timedelta(minutes=2)
                    <= observed
                    <= now + timedelta(minutes=1)
                ):
                    continue
                lat, lon = vehicle.position.latitude, vehicle.position.longitude
                south, west, north, east = source["bbox"]
                if not south <= lat <= north or not west <= lon <= east:
                    continue
                await store_position(
                    conn,
                    timestamp=observed,
                    entity_id=f"{source['schedule_source']}:{day}:{trip.trip_id}",
                    kind=schedule[0],
                    lat=lat,
                    lon=lon,
                    basis="observed",
                    source_id=source["id"],
                    digest=digest,
                    metadata={
                        "line": schedule[1].get("line", ""),
                        "destination": schedule[1].get("destination", ""),
                    },
                    valid_until=observed + timedelta(minutes=2),
                )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
