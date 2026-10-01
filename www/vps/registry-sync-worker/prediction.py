"""A single VPS simulation, independent of browser count. No invented schedules."""

import bisect
import math
from datetime import UTC, datetime, timedelta

from psycopg.types.json import Jsonb

MODEL_VERSION = "schedule-polyline-v1"


def position_at(points, timestamp):
    """Trajectory points are [UTC epoch seconds, latitude, longitude]. Never extrapolate."""
    if len(points) < 2 or timestamp < points[0][0] or timestamp >= points[-1][0]:
        return None
    index = bisect.bisect_right([p[0] for p in points], timestamp) - 1
    left, right = points[index : index + 2]
    duration = right[0] - left[0]
    if duration <= 0:
        raise ValueError("Trajectory times must increase")
    fraction = (timestamp - left[0]) / duration
    lat = left[1] + (right[1] - left[1]) * fraction
    lon = left[2] + (right[2] - left[2]) * fraction
    meters = math.hypot(
        (right[1] - left[1]) * 111_320,
        (right[2] - left[2]) * 111_320 * math.cos(math.radians(lat)),
    )
    return lat, lon, round(meters / duration * 3.6, 1)


async def store_position(
    conn,
    *,
    timestamp,
    entity_id,
    kind,
    lat,
    lon,
    basis,
    source_id,
    digest,
    metadata,
    valid_until,
):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid position")
    model = MODEL_VERSION if basis == "schedule_prediction" else None
    data = {
        "id": entity_id,
        "kind": kind,
        "latitude": lat,
        "longitude": lon,
        "timestamp": timestamp.isoformat(),
        "valid_until": valid_until.isoformat(),
        "basis": basis,
        "source_id": source_id,
        "model_version": model,
        **metadata,
    }
    # Metadata cannot override identity/provenance/coordinates.
    data.update(
        id=entity_id,
        kind=kind,
        latitude=lat,
        longitude=lon,
        timestamp=timestamp.isoformat(),
        valid_until=valid_until.isoformat(),
        basis=basis,
        source_id=source_id,
        model_version=model,
    )
    await conn.execute(
        """INSERT INTO movement_positions(timestamp,entity_id,kind,latitude,longitude,basis,
        source_id,payload_sha256,model_version,metadata) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING""",
        (
            timestamp,
            entity_id,
            kind,
            lat,
            lon,
            basis,
            source_id,
            digest,
            model,
            Jsonb(metadata),
        ),
    )
    await conn.execute(
        """INSERT INTO movement_latest(entity_id,basis,timestamp,valid_until,data)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT(entity_id,basis) DO UPDATE SET
        timestamp=EXCLUDED.timestamp,valid_until=EXCLUDED.valid_until,data=EXCLUDED.data
        WHERE EXCLUDED.timestamp >= movement_latest.timestamp""",
        (entity_id, basis, timestamp, valid_until, Jsonb(data)),
    )


async def predict_tick(conn, now=None):
    now = now or datetime.now(UTC)
    # Quantized ticks are replay-safe and do not create duplicate samples on restart.
    now = datetime.fromtimestamp(int(now.timestamp()) // 10 * 10, UTC)
    async with conn.transaction():
        cursor = await conn.execute("SELECT pg_try_advisory_xact_lock(2026092201)")
        if not (await cursor.fetchone())[0]:
            return 0
        cursor = await conn.execute(
            """SELECT s.source_id,s.trip_id,s.service_date,s.kind,s.ends_at,s.payload_sha256,s.trajectory,s.metadata,
                COALESCE(u.delay_seconds,0),u.payload_sha256,u.delay_basis
            FROM movement_schedules s LEFT JOIN movement_trip_updates u ON u.source_id=s.source_id
                AND u.trip_id=s.trip_id AND u.service_date=s.service_date AND u.valid_until > %s
            WHERE s.starts_at + make_interval(secs => COALESCE(u.delay_seconds,0)) <= %s
            AND s.ends_at + make_interval(secs => COALESCE(u.delay_seconds,0)) > %s
            AND NOT COALESCE(u.cancelled,FALSE)
            AND s.fetched_at > %s - INTERVAL '48 hours'""",
            (now, now, now, now),
        )
        rows = await cursor.fetchall()
        for (
            source,
            trip,
            date,
            kind,
            end,
            digest,
            trajectory,
            metadata,
            delay,
            update_digest,
            delay_basis,
        ) in rows:
            position = position_at(trajectory, now.timestamp() - delay)
            if position is None:
                continue
            lat, lon, speed = position
            if metadata.get("display_bbox"):
                south, west, north, east = metadata["display_bbox"]
                if not south <= lat <= north or not west <= lon <= east:
                    continue
            await store_position(
                conn,
                timestamp=now,
                entity_id=f"{source}:{date}:{trip}",
                kind=kind,
                lat=lat,
                lon=lon,
                basis="schedule_prediction",
                source_id=source,
                digest=digest,
                metadata={
                    **{k: v for k, v in metadata.items() if k != "stop_times"},
                    "trip_id": trip,
                    "speed_kmh": speed,
                    "delay_seconds": delay,
                    "delay_basis": delay_basis or "schedule_only",
                    "realtime_input_sha256": update_digest,
                },
                valid_until=min(
                    end + timedelta(seconds=delay), now + timedelta(seconds=30)
                ),
            )
        # Remove expired entries only from the small latest table; history is retained.
        await conn.execute("DELETE FROM movement_latest WHERE valid_until < %s", (now,))
    await conn.commit()
    return len(rows)
