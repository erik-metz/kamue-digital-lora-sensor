"""Daily regional GTFS ingestion including service exceptions, shapes and overnight trips."""

import asyncio
import csv
import io
import zipfile
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb
from publications import acquire, publish

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def seconds(value):
    h, m, s = map(int, value.split(":"))
    if h < 0 or not 0 <= m < 60 or not 0 <= s < 60:
        raise ValueError("Invalid GTFS time")
    return h * 3600 + m * 60 + s


def active_services(calendar, exceptions, day):
    key = day.strftime("%Y%m%d")
    active = {
        r["service_id"]
        for r in calendar
        if r["start_date"] <= key <= r["end_date"] and r[DAYS[day.weekday()]] == "1"
    }
    for row in exceptions:
        if row["date"] == key:
            if row["exception_type"] == "1":
                active.add(row["service_id"])
            elif row["exception_type"] == "2":
                active.discard(row["service_id"])
    return active


def service_epoch(day, timezone):
    # GTFS specifies noon minus 12 elapsed hours, including DST transition days.
    return (
        datetime.combine(
            day, datetime.min.time().replace(hour=12), ZoneInfo(timezone)
        ).timestamp()
        - 43200
    )


def rows(archive, filename):
    if filename not in archive.namelist():
        return
    with archive.open(filename) as raw:
        yield from csv.DictReader(
            io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        )


def trajectory(stops, shape, epoch):
    """Match stops monotonically onto the provider's polyline; label missing geometry."""
    anchors = []
    lower = 0
    for stop in stops:
        point = (stop["lat"], stop["lon"])
        if shape:
            index = min(
                range(lower, len(shape)),
                key=lambda i: (
                    (shape[i][0] - point[0]) ** 2 + (shape[i][1] - point[1]) ** 2
                ),
            )
            lower = index
        else:
            index = 0
        anchors.append((stop, index))
    output = []

    def append(time, lat, lon):
        if not output or time > output[-1][0]:
            output.append([time, lat, lon])

    for i, (stop, index) in enumerate(anchors):
        arrival, departure = (
            epoch + seconds(stop["arrival_time"]),
            epoch + seconds(stop["departure_time"]),
        )
        append(arrival, stop["lat"], stop["lon"])
        append(departure, stop["lat"], stop["lon"])
        if i + 1 < len(anchors):
            nxt, end_index = anchors[i + 1]
            next_arrival = epoch + seconds(nxt["arrival_time"])
            if next_arrival < departure:
                raise ValueError("Non-monotonic GTFS stop times")
            if shape and next_arrival > departure:
                segment = [
                    (stop["lat"], stop["lon"]),
                    *shape[index : end_index + 1],
                    (nxt["lat"], nxt["lon"]),
                ]
                distances = [0.0]
                for a, b in pairwise(segment):
                    distances.append(
                        distances[-1] + ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
                    )
                if distances[-1]:
                    for (lat, lon), distance in zip(segment[1:-1], distances[1:-1]):
                        append(
                            departure
                            + (next_arrival - departure) * distance / distances[-1],
                            lat,
                            lon,
                        )
    return output


def parse_gtfs(body, bbox, now):
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if sum(f.file_size for f in archive.infolist()) > 2_000_000_000:
            raise ValueError("GTFS archive exceeds expanded size limit")
        required = {
            "agency.txt",
            "stops.txt",
            "routes.txt",
            "trips.txt",
            "stop_times.txt",
        }
        if not required.issubset(archive.namelist()):
            raise ValueError("Incomplete GTFS archive")
        stops = {
            r["stop_id"]: r
            for r in rows(archive, "stops.txt")
            if r.get("stop_lat") and r.get("stop_lon")
        }
        south, west, north, east = bbox
        region = {
            key
            for key, r in stops.items()
            if south <= float(r["stop_lat"]) <= north
            and west <= float(r["stop_lon"]) <= east
        }
        trip_ids = {
            r["trip_id"]
            for r in rows(archive, "stop_times.txt")
            if r["stop_id"] in region
        }
        frequencies = {r["trip_id"] for r in rows(archive, "frequencies.txt")}
        # Frequency/headway trips do not have exact departures; don't pretend otherwise.
        trips = {
            r["trip_id"]: r
            for r in rows(archive, "trips.txt")
            if r["trip_id"] in trip_ids and r["trip_id"] not in frequencies
        }
        times = defaultdict(list)
        for row in rows(archive, "stop_times.txt"):
            if row["trip_id"] in trips and row["stop_id"] in stops:
                times[row["trip_id"]].append(row)
        routes = {r["route_id"]: r for r in rows(archive, "routes.txt")}
        agencies = {
            r.get("agency_id", ""): r["agency_timezone"]
            for r in rows(archive, "agency.txt")
        }
        needed_shapes = {r.get("shape_id") for r in trips.values()}
        shapes = defaultdict(list)
        for row in rows(archive, "shapes.txt"):
            if row["shape_id"] in needed_shapes:
                shapes[row["shape_id"]].append(row)
        for key in shapes:
            shapes[key] = [
                (float(r["shape_pt_lat"]), float(r["shape_pt_lon"]))
                for r in sorted(shapes[key], key=lambda r: int(r["shape_pt_sequence"]))
            ]
        calendar = list(rows(archive, "calendar.txt"))
        exceptions = list(rows(archive, "calendar_dates.txt"))
        if not calendar and not exceptions:
            raise ValueError("No GTFS service calendar")
        schedules = []
        service_days = {}
        for tz in set(agencies.values()):
            today = now.astimezone(ZoneInfo(tz)).date()
            service_days[tz] = [
                (
                    today + timedelta(days=offset),
                    active_services(
                        calendar, exceptions, today + timedelta(days=offset)
                    ),
                )
                for offset in [-1, 0, 1]
            ]
        for trip_id, trip in trips.items():
            route = routes[trip["route_id"]]
            route_type = int(route["route_type"])
            kind = (
                "train"
                if route_type in (0, 1, 2) or 100 <= route_type < 200
                else "bus"
                if route_type == 3 or 700 <= route_type < 800
                else None
            )
            if kind is None:
                continue
            timezone = agencies.get(
                route.get("agency_id", ""), next(iter(agencies.values()))
            )
            today = now.astimezone(ZoneInfo(timezone)).date()
            ordered = sorted(times[trip_id], key=lambda r: int(r["stop_sequence"]))
            if len(ordered) < 2 or any(
                not r.get("arrival_time") or not r.get("departure_time")
                for r in ordered
            ):
                continue
            points = [
                {
                    **r,
                    "lat": float(stops[r["stop_id"]]["stop_lat"]),
                    "lon": float(stops[r["stop_id"]]["stop_lon"]),
                }
                for r in ordered
            ]
            shape = shapes.get(trip.get("shape_id"), [])
            for day, services in service_days[timezone]:
                if trip["service_id"] not in services:
                    continue
                path = trajectory(points, shape, service_epoch(day, timezone))
                if len(path) < 2:
                    continue
                schedules.append(
                    {
                        "trip_id": trip_id,
                        "service_date": day,
                        "kind": kind,
                        "trajectory": path,
                        "metadata": {
                            "line": route.get("route_short_name")
                            or route.get("route_long_name", ""),
                            "destination": trip.get("trip_headsign")
                            or stops[ordered[-1]["stop_id"]]["stop_name"],
                            "geometry_basis": "provider_shape"
                            if shape
                            else "stop_to_stop",
                            "schedule_timezone": timezone,
                            "display_bbox": bbox,
                            "stop_times": [
                                {
                                    "stop_id": r["stop_id"],
                                    "sequence": int(r["stop_sequence"]),
                                    "arrival": service_epoch(day, timezone)
                                    + seconds(r["arrival_time"]),
                                    "departure": service_epoch(day, timezone)
                                    + seconds(r["departure_time"]),
                                }
                                for r in ordered
                            ],
                        },
                    }
                )
        public_stops = [
            {
                "id": key,
                "name": stops[key]["stop_name"],
                "latitude": float(stops[key]["stop_lat"]),
                "longitude": float(stops[key]["stop_lon"]),
            }
            for key in sorted(region)
        ]
        return schedules, public_stops


async def import_gtfs(conn, client, source):
    now = datetime.now(UTC)
    response, digest, attempt = await acquire(conn, client, source)
    schedules, stops = await asyncio.to_thread(
        parse_gtfs, response.content, source["bbox"], now
    )
    async with conn.transaction():
        # Replace the active source projection atomically; raw inputs retain all revisions.
        await conn.execute(
            "DELETE FROM movement_schedules WHERE source_id=%s", (source["id"],)
        )
        await conn.execute(
            "DELETE FROM movement_latest WHERE basis='schedule_prediction' AND data->>'source_id'=%s",
            (source["id"],),
        )
        for item in schedules:
            points = item["trajectory"]
            await conn.execute(
                """INSERT INTO movement_schedules(source_id,trip_id,service_date,kind,starts_at,ends_at,
                payload_sha256,fetched_at,trajectory,metadata) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    source["id"],
                    item["trip_id"],
                    item["service_date"],
                    item["kind"],
                    datetime.fromtimestamp(points[0][0], UTC),
                    datetime.fromtimestamp(points[-1][0], UTC),
                    digest,
                    now,
                    Jsonb(points),
                    Jsonb(item["metadata"]),
                ),
            )
        async with conn.cursor() as cursor:
            await cursor.executemany(
                """INSERT INTO movement_stop_times
                (source_id,trip_id,service_date,sequence,stop_id,arrival_at,departure_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                [
                    (source["id"], item["trip_id"], item["service_date"], stop["sequence"],
                     stop["stop_id"], datetime.fromtimestamp(stop["arrival"], UTC),
                     datetime.fromtimestamp(stop["departure"], UTC))
                    for item in schedules for stop in item["metadata"]["stop_times"]
                ],
            )
        await publish(
            conn, source, f"transport/stops/{source['id']}", stops, digest, now, now
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
