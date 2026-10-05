"""Persist barrier estimates alongside the shared ten-second movement tick."""

import math
from collections import OrderedDict
from datetime import timedelta
from itertools import pairwise

from psycopg.types.json import Jsonb

MODEL_VERSION = "rail-barrier-window-v1"
BARRIERS = {"yes", "full", "half", "double_half"}
_PASSAGES = OrderedDict()


def route_passages(route, site):
    # A payload digest and service trajectory start identify immutable schedule
    # geometry. Cache only small projected time lists, never entire trajectories.
    if len(route["trajectory"]) < 2:
        return []
    if "digest" not in route:
        return passage_times(route["trajectory"], site)
    key = (
        route["source"],
        route["trip"],
        route["digest"],
        route["trajectory"][0][0],
        site["latitude"],
        site["longitude"],
    )
    if key not in _PASSAGES:
        _PASSAGES[key] = passage_times(route["trajectory"], site)
        if len(_PASSAGES) > 8192:
            _PASSAGES.popitem(last=False)
    _PASSAGES.move_to_end(key)
    return _PASSAGES[key]


def barrier_sites(features):
    """One site for nearby track nodes of the same named barrier (max 30 m)."""
    sites = []
    for feature in sorted(
        features, key=lambda f: str(f.get("properties", {}).get("id", ""))
    ):
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        if props.get("barrier") not in BARRIERS or geometry.get("type") != "Point":
            continue
        lon, lat = geometry["coordinates"][:2]
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        name = props.get("name", "Bahnübergang")
        site = next(
            (
                s
                for s in sites
                if s["name"] == name
                and s["barrier"] == props["barrier"]
                and distance(lat, lon, s["latitude"], s["longitude"]) <= 30
            ),
            None,
        )
        if site:
            site["members"].append(props["id"])
        else:
            sites.append(
                {
                    "id": props["id"],
                    "name": name,
                    "barrier": props["barrier"],
                    "latitude": lat,
                    "longitude": lon,
                    "members": [props["id"]],
                }
            )
    return sites


def distance(lat, lon, other_lat, other_lon):
    return math.hypot(
        (other_lat - lat) * 111320,
        (other_lon - lon) * 111320 * math.cos(math.radians(lat)),
    )


def passage_times(points, site):
    """Project a barrier onto provider route segments; ignore parallel/distant tracks."""
    result = []
    scale = 111320 * math.cos(math.radians(site["latitude"]))
    for left, right in pairwise(points):
        ax, ay = (
            (left[2] - site["longitude"]) * scale,
            (left[1] - site["latitude"]) * 111320,
        )
        bx, by = (
            (right[2] - site["longitude"]) * scale,
            (right[1] - site["latitude"]) * 111320,
        )
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        if right[0] <= left[0]:
            continue
        if length2 < 1:
            if math.hypot(ax, ay) <= 25:
                # A train stopped on a barrier must keep it closed throughout
                # its dwell, rather than reopening thirty seconds after arrival.
                result.extend(range(int(left[0]), int(right[0]), 60))
                result.append(right[0])
            continue
        fraction = -(ax * dx + ay * dy) / length2
        if not 0 <= fraction <= 1:
            continue
        if math.hypot(ax + fraction * dx, ay + fraction * dy) <= 25:
            result.append(left[0] + fraction * (right[0] - left[0]))
    return result


def estimate(site, routes, timestamp):
    """0=open, 1=closing soon, 2=closed; None=no suitable fresh train schedule input.

    Windows use the same delayed provider trajectory as persisted GPS positions.
    Opening is only an estimate from supported collected routes, not proof that no
    unscheduled train exists. Never use buses, waste tours or stop-to-stop chords.
    """
    supported = []
    for route in routes:
        if (
            route["kind"] != "train"
            or route["metadata"].get("geometry_basis") != "provider_shape"
        ):
            continue
        passages = route_passages(route, site)
        if passages:
            supported.extend(t + route["delay"] for t in passages)
    if not supported:
        return None
    if any(t - 60 <= timestamp <= t + 30 for t in supported):
        return 2
    if any(t - 120 <= timestamp < t - 60 for t in supported):
        return 1
    return 0


async def persist_crossings(conn, now):
    # Explicit core migration owns schema installation; legacy deployments retain
    # their movement tick while the API reports missing barrier estimates.
    ready = await (
        await conn.execute(
            "SELECT to_regprocedure('write_measurement(text,text,text,text,text,jsonb,timestamp with time zone,numeric,timestamp with time zone,jsonb,text,timestamp with time zone,timestamp with time zone,text,boolean)') IS NOT NULL"
        )
    ).fetchone()
    if not ready[0]:
        return
    cursor = await conn.execute(
        """SELECT data,payload_sha256 FROM collected_datasets
        WHERE dataset='map/layers/crossings' AND expires_at > %s ORDER BY fetched_at DESC LIMIT 1""",
        (now,),
    )
    inventory = await cursor.fetchone()
    if not inventory:
        return
    # Include neighbouring services so the estimate can say open between trips,
    # and close before a service's first position or clear after its final one.
    # All inputs are persisted provider schedules used by the GPS predictor.
    cursor = await conn.execute(
        """SELECT s.source_id,s.trip_id,s.payload_sha256,s.trajectory,s.metadata,
        COALESCE(u.delay_seconds,0),u.payload_sha256 FROM movement_schedules s
        LEFT JOIN movement_trip_updates u ON u.source_id=s.source_id AND u.trip_id=s.trip_id
            AND u.service_date=s.service_date AND u.valid_until>%s
        WHERE s.kind='train' AND s.fetched_at>%s-INTERVAL '48 hours'
            AND s.starts_at+make_interval(secs=>COALESCE(u.delay_seconds,0))<=%s+INTERVAL '2 hours'
            AND s.ends_at+make_interval(secs=>COALESCE(u.delay_seconds,0))>=%s-INTERVAL '2 hours'
            AND NOT COALESCE(u.cancelled,FALSE)""",
        (now, now, now, now),
    )
    routes = [
        {
            "source": source,
            "trip": trip,
            "digest": digest,
            "trajectory": points,
            "metadata": metadata,
            "delay": delay,
            "update_digest": update_digest,
            "kind": "train",
        }
        for source, trip, digest, points, metadata, delay, update_digest in await cursor.fetchall()
    ]
    for site in barrier_sites(inventory[0].get("features", [])):
        entity = "crossing:" + site["id"]
        await conn.execute(
            """INSERT INTO entities(id,name,entity_type,metadata)
            VALUES (%s,%s,'rail_crossing',%s) ON CONFLICT(id) DO UPDATE
            SET name=EXCLUDED.name,metadata=EXCLUDED.metadata,updated_at=NOW()""",
            (entity, site["name"], Jsonb(site)),
        )
        state = estimate(site, routes, now.timestamp())
        supported = [
            r
            for r in routes
            if r["metadata"].get("geometry_basis") == "provider_shape"
            and route_passages(r, site)
        ]
        provenance = {
            "model_version": MODEL_VERSION,
            "valid_until": (now + timedelta(seconds=30)).isoformat(),
            "payload_sha256": inventory[1],
            "schedule_payloads": sorted({r["digest"] for r in supported}),
            "closure_lead_seconds": 60,
            "clearance_seconds": 30,
            "warning_seconds": 120,
            "train_inputs": [
                {
                    "source_id": r["source"],
                    "trip_id": r["trip"],
                    "payload_sha256": r["digest"],
                    "delay_seconds": r["delay"],
                    "realtime_input_sha256": r["update_digest"],
                }
                for r in supported
                if any(
                    t + r["delay"] - 120 <= now.timestamp() <= t + r["delay"] + 30
                    for t in route_passages(r, site)
                )
            ],
        }
        await conn.execute(
            """SELECT write_measurement(%s,'crossing_state','state','rail-barrier-model','model',
            '{}'::jsonb,%s,%s,%s,%s,%s,NULL,NULL,'state')""",
            (
                entity,
                now,
                state,
                now,
                Jsonb(provenance),
                "valid" if state is not None else "missing",
            ),
        )
