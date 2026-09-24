"""Read-only publications: no provider requests, generated values or seed fallback."""

import hashlib
import json
from datetime import UTC, datetime

from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder

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
    municipality = None
    parts = dataset.split("/")
    if len(parts) == 3 and parts[0] == "demographics" and parts[2] == "commuters":
        municipality = parts[1]
        dataset = "demographics/commuters"
    async with pool.connection() as conn:
        cursor = await conn.execute(
            "SELECT * FROM collected_datasets WHERE dataset=%s", (dataset,)
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
        cursor = await conn.execute("""SELECT DISTINCT ON (entity_id) data FROM movement_latest
            WHERE valid_until > NOW() AND NOT EXISTS (
                SELECT 1 FROM movement_trip_updates u WHERE u.cancelled AND u.valid_until>NOW()
                AND movement_latest.entity_id=u.source_id||':'||u.service_date::text||':'||u.trip_id)
            ORDER BY entity_id,
            CASE WHEN basis='observed' THEN 0 ELSE 1 END, timestamp DESC""")
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


@router.get("/map/collected-layers")
async def map_layers(request: Request, pool=Depends(get_db_pool)):
    expected = {
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
    }
    async with pool.connection() as conn:
        cursor = await conn.execute(
            "SELECT dataset,data,expires_at FROM collected_datasets WHERE (dataset LIKE 'map/layers/%%' OR dataset LIKE 'transport/stops/%%') AND expires_at > NOW()"
        )
        rows = await cursor.fetchall()
    layers = {
        r["dataset"].removeprefix("map/layers/"): r["data"]
        for r in rows
        if r["dataset"].startswith("map/layers/")
    }
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
