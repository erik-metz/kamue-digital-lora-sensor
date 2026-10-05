"""Read-only publications: no provider requests, generated values or seed fallback."""

import hashlib
import json
import math
from datetime import UTC, datetime

from dependencies import get_db_pool
from endpoints.infrastructure import get_emf_sites
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from measurement_reads import core_reads, read_sql

router = APIRouter(tags=["Collected data"])


def filtered(data, params):
    """Filter stored publications without fabricating records or summary values."""
    if not isinstance(data, list):
        if params.get("year") and str(data.get("year")) != params["year"]:
            raise HTTPException(404, "No publication for requested year")
        return data
    aliases = {
        "year": "year",
        "municipality": "municipality",
        "municipality_id": "municipality_id",
        "region_code": "region_code",
        "category": "category",
        "industry_sector": "industry_sector",
    }
    result = data
    for query, field in aliases.items():
        value = params.get(query)
        if value and value != "all":
            result = [
                row
                for row in result
                if str(
                    row.get(field, row.get("fiscal_year") if field == "year" else "")
                ).casefold()
                == value.casefold()
            ]
    if params.get("search"):
        needle = params["search"].casefold()
        result = [
            row
            for row in result
            if needle
            in (
                str(row.get("title", "")) + " " + str(row.get("description", ""))
            ).casefold()
        ]
    for param, compare in (
        ("from_date", lambda a, b: a >= b),
        ("to_date", lambda a, b: a <= b),
    ):
        if params.get(param):
            result = [
                r
                for r in result
                if compare(str(r.get("start_time", ""))[:10], params[param][:10])
            ]
    return result


def cached_response(data, request, seconds, headers=None):
    body = json.dumps(
        jsonable_encoder(data),
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()
    etag = '"' + hashlib.sha256(body).hexdigest() + '"'
    response_headers = {
        "Cache-Control": f"public, max-age={seconds}, s-maxage={seconds}",
        "ETag": etag,
        **(headers or {}),
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=response_headers)
    return Response(body, media_type="application/json", headers=response_headers)


@router.get("/collected/{dataset:path}")
async def dataset_publication(
    dataset: str, request: Request, pool=Depends(get_db_pool)
):
    if dataset == "infrastructure/emf":
        return cached_response(await get_emf_sites(pool), request, 300)
    municipality = None
    parts = dataset.split("/")
    if len(parts) == 3 and parts[0] == "demographics" and parts[2] == "commuters":
        municipality = parts[1]
        dataset = "demographics/commuters"
    async with pool.connection() as conn:
        cursor = await conn.execute(
            ("SELECT * FROM core_statistical_datasets WHERE dataset=%s"
             if core_reads() and dataset.startswith("statistics/")
             else "SELECT * FROM core_charger_datasets WHERE dataset=%s"
             if core_reads() and dataset in {"infrastructure/ev-charging", "map/layers/charging"}
             else "SELECT * FROM core_gauge_datasets WHERE dataset=%s"
             if core_reads() and dataset in {"environment/flood/gauges", "map/layers/floods"}
             else "SELECT * FROM core_coordinate_datasets WHERE dataset=%s"
             if core_reads() and (dataset.startswith('transport/stops/') or dataset in {
                 'map/layers/companies','map/layers/crops','map/layers/crossings','map/layers/energy',
                 'map/layers/nature','map/layers/places','map/layers/wifi','waste/address-inventory','waste/calendar'})
             else "SELECT * FROM collected_datasets WHERE dataset=%s"), (dataset,)
        )
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(
            503, "Source not collected yet", headers={"Cache-Control": "no-store"}
        )
    now = datetime.now(UTC)
    # Expired measurements must not appear current, even if a collector stopped.
    if row["expires_at"] <= now:
        raise HTTPException(
            503,
            "Stored source data expired",
            headers={
                "Cache-Control": "no-store",
                "X-Source-Updated-At": row["source_updated_at"].isoformat(),
            },
        )
    params = dict(request.query_params)
    if dataset.startswith("demographics/") and "municipality" in params:
        params["municipality_id"] = params.pop("municipality")
    if dataset == "demographics/commuters":
        municipality = municipality or params.pop("municipality_id", None)
    data = filtered(row["data"], params)
    if municipality:
        data = [row for row in data if row.get("home_municipality_id") == municipality]
    if dataset == "social/events" and params.get("include_past") != "true":
        data = [
            event
            for event in data
            if datetime.fromisoformat(event.get("end_time") or event["start_time"])
            >= now
        ]
    ttl = max(0, min(300, int((row["expires_at"] - now).total_seconds())))
    return cached_response(
        data,
        request,
        ttl,
        {
            "X-Source-Updated-At": row["source_updated_at"].isoformat(),
            "X-Collected-At": row["fetched_at"].isoformat(),
            "X-Data-Expires-At": row["expires_at"].isoformat(),
            "X-Data-Source": row["source_id"],
        },
    )


@router.get("/movements/latest")
async def movements(request: Request, pool=Depends(get_db_pool)):
    async with pool.connection() as conn:
        cursor = await conn.execute(read_sql("""SELECT DISTINCT ON (entity_id) data FROM movement_latest
            WHERE valid_until > NOW() AND NOT EXISTS (
                SELECT 1 FROM movement_trip_updates u WHERE u.cancelled AND u.valid_until>NOW()
                AND movement_latest.entity_id=u.source_id||':'||u.service_date::text||':'||u.trip_id)
            ORDER BY entity_id,
            CASE WHEN basis='observed' THEN 0 ELSE 1 END, timestamp DESC"""))
        rows = await cursor.fetchall()
    return cached_response({"positions": [r["data"] for r in rows]}, request, 5)


@router.get("/map-tiles/{layer}/{z}/{x}/{y}.png")
async def tile(
    layer: str, z: int, x: int, y: int, request: Request, pool=Depends(get_db_pool)
):
    if (
        layer not in {"base", "rain"}
        or not 0 <= z <= 19
        or not (0 <= x < 2**z and 0 <= y < 2**z)
    ):
        raise HTTPException(404)
    async with pool.connection() as conn:
        cursor = await conn.execute(
            """SELECT p.body,p.content_type,p.sha256 FROM collected_map_tiles t
            JOIN collected_payloads p ON p.sha256=t.payload_sha256
            WHERE layer=%s AND z=%s AND x=%s AND y=%s""",
            (layer, z, x, y),
        )
        row = await cursor.fetchone()
    if not row:
        # Deliberately no on-demand external fetch.
        raise HTTPException(404, "Tile not collected")
    headers = {
        "Cache-Control": "public, max-age=86400",
        "ETag": '"' + row["sha256"] + '"',
    }
    if request.headers.get("if-none-match") == headers["ETag"]:
        return Response(status_code=304, headers=headers)
    return Response(bytes(row["body"]), media_type=row["content_type"], headers=headers)


RIED_CORRIDORS = [
    {
        "id": "corridor-a67",
        "road_name": "A67",
        "name": "A67 (Darmstadt ↔ Lorsch ↔ Viernheim)",
        "coordinates": [
            [8.5830, 49.8220],
            [8.5730, 49.7950],
            [8.5480, 49.7520],
            [8.5580, 49.6920],
            [8.5660, 49.6540],
            [8.5650, 49.6210],
            [8.5530, 49.5780],
        ],
    },
    {
        "id": "corridor-b47",
        "road_name": "B47",
        "name": "B47 (Worms Rheinbrücke ↔ Bürstadt ↔ Lorsch ↔ Bensheim)",
        "coordinates": [
            [8.3595, 49.6318],
            [8.3780, 49.6350],
            [8.4100, 49.6420],
            [8.4420, 49.6457],
            [8.4650, 49.6450],
            [8.5020, 49.6470],
            [8.5450, 49.6520],
            [8.5660, 49.6540],
            [8.6050, 49.6680],
        ],
    },
    {
        "id": "corridor-b44",
        "road_name": "B44",
        "name": "B44 (Biblis ↔ Bürstadt ↔ Lampertheim ↔ Mannheim)",
        "coordinates": [
            [8.4550, 49.7350],
            [8.4520, 49.6890],
            [8.4510, 49.6580],
            [8.4560, 49.6457],
            [8.4600, 49.6200],
            [8.4680, 49.5960],
            [8.4820, 49.5650],
            [8.4900, 49.5350],
        ],
    },
    {
        "id": "corridor-a5",
        "road_name": "A5",
        "name": "A5 (Darmstadt ↔ Bensheim ↔ Heppenheim ↔ Weinheim)",
        "coordinates": [
            [8.6250, 49.8050],
            [8.6280, 49.7550],
            [8.6220, 49.7020],
            [8.6180, 49.6680],
            [8.6200, 49.6350],
            [8.6250, 49.5850],
            [8.6400, 49.5520],
        ],
    },
    {
        "id": "corridor-a6",
        "road_name": "A6",
        "name": "A6 (Viernheim ↔ Sandhofen ↔ Ludwigshafen)",
        "coordinates": [
            [8.5530, 49.5780],
            [8.5020, 49.5520],
            [8.4350, 49.5380],
        ],
    },
]


@router.get("/map/collected-layers")
async def map_layers(request: Request, pool=Depends(get_db_pool)):
    expected = {
        "crossings",
        "places",
        "nature",
        "crops",
        "floods",
        "charging",
        "energy",
        "road",
        "wifi",
        "broadband",
        "boris",
        "devplans",
        "elections",
        "companies",
        "closures",
        "traffic",
        "stops",
        "lora",
        "emf",
    }
    async with pool.connection() as conn:
        cursor = await conn.execute(
            "SELECT dataset,data,expires_at FROM "
            + ("core_map_datasets" if core_reads() else "collected_datasets")
            + " WHERE (dataset LIKE 'map/layers/%%' OR dataset LIKE 'transport/stops/%%') AND expires_at > NOW()"
        )
        rows = await cursor.fetchall()
        gateway_cursor = await conn.execute(
            """SELECT e.id, e.name, e.metadata,
                      MAX(lr.value) FILTER (WHERE md.metric='latitude') AS latitude,
                      MAX(lr.value) FILTER (WHERE md.metric='longitude') AS longitude,
                      MAX(lr.value) FILTER (WHERE md.metric='online_status') AS online_status
               FROM entities e
               JOIN measurement_definitions md ON md.entity_id=e.id
               JOIN latest_readings lr ON lr.measurement_id=md.id
               WHERE e.entity_type='lora_gateway' AND e.is_hidden=FALSE
               GROUP BY e.id, e.name, e.metadata ORDER BY e.id"""
        )
        gateways = await gateway_cursor.fetchall()
        traffic_cursor = await conn.execute(
            """SELECT id,road_name,direction,location_from,location_to,description,cause_type,
                      delay_seconds,length_meters,severity,coordinates,last_seen_at FROM traffic_incidents
               WHERE is_active=TRUE AND last_seen_at>NOW()-INTERVAL '2 hours'""")
        incidents = await traffic_cursor.fetchall()
        try:
            closures_cursor = await conn.execute(
                """SELECT id,municipality,district,street_name,location_from,location_to,
                          closure_type,status,start_time,end_time,reason,description,
                          detour,coordinates,source
                   FROM street_closures
                   WHERE is_active=TRUE"""
            )
            municipal_closures = await closures_cursor.fetchall()
        except Exception:  # noqa: BLE001
            municipal_closures = []
    layers = {
        r["dataset"].removeprefix("map/layers/"): r["data"]
        for r in rows
        if r["dataset"].startswith("map/layers/")
    }
    emf = await get_emf_sites(pool)
    emf_features = [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [site.longitude, site.latitude]},
         "properties": site.model_dump()}
        for site in emf.sites
        if site.latitude is not None and site.longitude is not None
        and math.isfinite(site.latitude) and math.isfinite(site.longitude)
    ]
    if emf_features:
        layers["emf"] = {"type": "FeatureCollection", "features": emf_features}
    gateway_features = []
    for gateway in gateways:
        # Only a confirmed online status represents active infrastructure.
        if gateway["online_status"] != 1:
            continue
        lat, lon = gateway["latitude"], gateway["longitude"]
        if lat is None or lon is None:
            continue
        lat, lon = float(lat), float(lon)
        if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        metadata = gateway["metadata"] or {}
        gateway_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                **metadata, "id": gateway["id"], "name": gateway["name"],
                "kind": "lora_gateway",
                "online_status": "Online",
            },
        })
    # Do not fall back to a historical map dataset when no gateways are online.
    layers.pop("lora", None)
    if gateway_features:
        layers["lora"] = {"type": "FeatureCollection", "features": gateway_features}
    incident_features = []
    for incident in incidents:
        coordinates = incident["coordinates"]
        if isinstance(coordinates, str):
            coordinates = json.loads(coordinates)
        if not coordinates:
            continue
        # Collector stores [latitude, longitude]; GeoJSON uses the reverse order.
        points = [[p[1], p[0]] for p in coordinates if isinstance(p, list) and len(p) >= 2]
        if not points:
            continue
        properties = {k: v for k, v in incident.items() if k != "coordinates"}
        properties["name"] = incident["road_name"]
        incident_features.append({"type": "Feature", "geometry": {
            "type": "LineString" if len(points) > 1 else "Point",
            "coordinates": points if len(points) > 1 else points[0],
        }, "properties": properties})

    corridor_features = []
    for c in RIED_CORRIDORS:
        road = c["road_name"].upper()
        road_incidents = [i for i in incidents if str(i.get("road_name", "")).upper() == road]
        count = len(road_incidents)
        max_delay = max((i.get("delay_seconds") or 0 for i in road_incidents), default=0)
        has_closure = any(i.get("cause_type") == "closure" for i in road_incidents)
        has_standstill = any(i.get("severity") == "standstill" for i in road_incidents)
        if count == 0:
            status = "clear"
            desc = "Freie Fahrt ohne gemeldete Behinderungen"
        elif has_closure:
            status = "closure"
            desc = f"Vollsperrung / erhebliche Störung ({count} Meldung(en))"
        elif has_standstill or max_delay >= 900:
            status = "congestion"
            desc = f"{count} Störung(en), bis zu +{round(max_delay / 60)} Min. Zeitverlust"
        elif max_delay >= 300:
            status = "sluggish"
            desc = f"Zähflüssiger Verkehr, ca. +{round(max_delay / 60)} Min. Verzögerung"
        else:
            status = "clear"
            desc = f"{count} Meldung(en), geringer Zeitverlust"
        corridor_features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": c["coordinates"],
            },
            "properties": {
                "id": c["id"],
                "name": c["name"],
                "road_name": c["road_name"],
                "status": status,
                "delay_minutes": round(max_delay / 60),
                "active_incidents_count": count,
                "description": desc,
                "kind": "corridor",
            },
        })

    municipal_closure_features = []
    for row in municipal_closures:
        coords = row["coordinates"]
        if isinstance(coords, str):
            coords = json.loads(coords)
        if not coords:
            continue
        is_line = isinstance(coords, list) and len(coords) > 0 and isinstance(coords[0], list)
        if is_line:
            points = [[p[1], p[0]] for p in coords if isinstance(p, list) and len(p) >= 2]
            geom = {"type": "LineString", "coordinates": points}
        else:
            geom = {"type": "Point", "coordinates": [coords[1], coords[0]]}
        desc_text = str(row.get("description") or "").lower()
        reason_text = str(row.get("reason") or "").lower()
        closure_type = str(row.get("closure_type") or "full").lower()
        is_baustelle = "teil" in closure_type or "baustelle" in reason_text or "baustelle" in desc_text or "bau" in reason_text or "instandsetzung" in reason_text
        start_val = row.get("start_time")
        end_val = row.get("end_time")
        municipal_closure_features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "id": row["id"],
                "name": f"{row['street_name']} ({row['municipality']})",
                "street_name": row["street_name"],
                "municipality": row["municipality"],
                "district": row.get("district"),
                "location_from": row.get("location_from"),
                "location_to": row.get("location_to"),
                "closure_type": row.get("closure_type", "full"),
                "status": row.get("status", "active"),
                "start_time": start_val.isoformat() if hasattr(start_val, "isoformat") else str(start_val or ""),
                "end_time": end_val.isoformat() if hasattr(end_val, "isoformat") else (str(end_val) if end_val else None),
                "reason": row.get("reason"),
                "description": row.get("description"),
                "detour": row.get("detour"),
                "cause_type": "roadwork" if is_baustelle else "closure",
                "source": row.get("source", "hessen_mobil"),
            },
        })

    traffic_features = incident_features + corridor_features
    closure_features = municipal_closure_features + [
        f for f in incident_features if f["properties"].get("cause_type") in ("closure", "roadwork")
    ]
    if traffic_features:
        layers["traffic"] = {"type": "FeatureCollection", "features": traffic_features}
    if closure_features:
        layers["closures"] = {"type": "FeatureCollection", "features": closure_features}
    stops = [
        {**stop, "source_id": row["dataset"].removeprefix("transport/stops/")}
        for row in rows
        if row["dataset"].startswith("transport/stops/")
        for stop in row["data"]
    ]
    if stops:
        layers["stops"] = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [s["longitude"], s["latitude"]],
                    },
                    "properties": {"name": s["name"], "stop_id": s["id"], "source_id": s["source_id"]},
                }
                for s in stops
            ],
        }
    return cached_response(
        {"layers": layers, "unavailable": sorted(expected - set(layers))},
        request,
        30,
        {"X-Data-Expires-At": min(r["expires_at"] for r in rows).isoformat()}
        if rows
        else {},
    )


@router.get("/collection/status")
async def collection_status(request: Request, pool=Depends(get_db_pool)):
    async with pool.connection() as conn:
        cursor = await conn.execute("""WITH sources AS (
            SELECT id,source_url,enabled,interval_seconds FROM collection_sources
            UNION ALL SELECT DISTINCT a.source_id,NULL::text,NULL::boolean,NULL::integer FROM collection_attempts a
            WHERE NOT EXISTS(SELECT 1 FROM collection_sources s WHERE s.id=a.source_id))
            SELECT s.id AS source_id,s.source_url,s.enabled,s.interval_seconds,
                a.received_at,COALESCE(a.status,'pending') AS status,a.error,
                (SELECT MAX(received_at) FROM collection_attempts ok
                 WHERE ok.source_id=s.id AND ok.status='success') AS last_success_at
            FROM sources s LEFT JOIN LATERAL (
                SELECT received_at,status,error FROM collection_attempts
                WHERE source_id=s.id ORDER BY received_at DESC,id DESC LIMIT 1) a ON TRUE ORDER BY s.id""")
        rows = await cursor.fetchall()
    return cached_response({"sources": rows}, request, 30)


# Compatibility URLs now share the collector publication boundary. Old seeded
# registry endpoint implementations are not mounted by the application.
legacy_router = APIRouter(tags=["Collected registry compatibility"])


@legacy_router.get("/elections")
async def collected_elections(request: Request, pool=Depends(get_db_pool)):
    return await dataset_publication("elections", request, pool)


@legacy_router.get("/{domain}/{resource:path}")
async def collected_legacy(
    domain: str, resource: str, request: Request, pool=Depends(get_db_pool)
):
    if domain not in {
        "demographics",
        "realestate",
        "economy",
        "finance",
        "elections",
        "environment",
        "social",
        "infrastructure",
    }:
        raise HTTPException(404)
    return await dataset_publication(f"{domain}/{resource}", request, pool)


@router.get("/transport/stops/{stop_id}/departures")
async def departures(stop_id: str, request: Request, pool=Depends(get_db_pool)):
    async with pool.connection() as conn:
        cursor = await conn.execute(
            """SELECT s.source_id,s.trip_id,s.metadata->>'line' AS line,
            s.metadata->>'destination' AS destination,t.departure_at AS scheduled_at,
            t.departure_at + make_interval(secs => COALESCE(u.delay_seconds,0)) AS expected_at,
            COALESCE(u.delay_basis,'schedule_only') AS delay_basis
            FROM movement_stop_times t JOIN movement_schedules s USING(source_id,trip_id,service_date)
            LEFT JOIN movement_trip_updates u ON u.source_id=s.source_id AND u.trip_id=s.trip_id
                AND u.service_date=s.service_date AND u.valid_until>NOW()
            WHERE t.stop_id=%s AND (%s::text IS NULL OR t.source_id=%s) AND s.fetched_at>NOW()-INTERVAL '48 hours'
            AND NOT COALESCE(u.cancelled,FALSE)
            AND t.departure_at+make_interval(secs => COALESCE(u.delay_seconds,0))>NOW()
            ORDER BY expected_at LIMIT 12""",
            (stop_id, request.query_params.get("source"), request.query_params.get("source")),
        )
        rows = await cursor.fetchall()
    return cached_response(
        {"departures": rows, "basis": "schedule_prediction"}, request, 10
    )
