"""Environment & Agriculture endpoints for the Hessisches Ried.
Provides groundwater monitoring, nature reserves, agricultural crop distribution,
river gauges, flood infrastructure, noise corridors, and WMS layer metadata.
"""

from datetime import UTC, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_api_key
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/environment", tags=["Environment & Agriculture"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class NatureAreaResponse(BaseModel):
    id: str
    name: str
    designation: str
    municipality: str
    area_hectares: float | None = None
    legal_ordinance_year: int | None = None
    conservation_aims: str | None = None
    visiting_rules: dict[str, Any] | None = None
    geojson: dict[str, Any]
    source: str


class CropZoneResponse(BaseModel):
    id: str
    municipality: str
    crop_name: str
    crop_family: str
    year: int
    area_hectares: float | None = None
    irrigation_demand_class: str | None = None
    geojson: dict[str, Any]


class AgriculturalMunicipalStat(BaseModel):
    municipality: str
    year: int
    crop_family: str
    crop_name: str
    area_hectares: float
    percentage_of_agricultural_land: float


class FloodGaugeResponse(BaseModel):
    id: str
    name: str
    water_body: str
    municipality: str
    latitude: float
    longitude: float
    current_level_m: float
    discharge_m3_s: float | None = None
    alarm_level_1_m: float
    alarm_level_2_m: float
    alarm_level_3_m: float
    status: str
    source: str
    updated_at: datetime


class FloodInfrastructureResponse(BaseModel):
    id: str
    name: str
    infrastructure_type: str
    water_body: str
    municipality: str
    latitude: float
    longitude: float
    protection_level: str | None = None
    description: str | None = None


class NoiseCorridorResponse(BaseModel):
    id: str
    corridor_type: str
    name: str
    noise_metric: str
    db_band: str
    geojson: dict[str, Any]


class MapServiceResponse(BaseModel):
    id: str
    title: str
    category: str
    service_type: str
    wms_url: str
    layer_name: str
    legend_url: str | None = None
    attribution: str
    default_opacity: float
    min_zoom: int
    max_zoom: int


class GroundwaterStationResponse(BaseModel):
    id: str
    friendly_name: str
    latitude: float | None
    longitude: float | None
    description: str | None
    depth_to_water_m: float | None = None
    nitrate_mg_l: float | None = None
    measured_at: datetime | None = None


@router.get("/protected-areas", response_model=list[NatureAreaResponse])
async def get_protected_areas(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    designation: str | None = Query(None, description="Filter by designation: nsg, ffh, spa, wsg"),
):
    query = "SELECT id, name, designation, municipality, area_hectares, legal_ordinance_year, conservation_aims, visiting_rules, geojson, source FROM nature_protected_areas WHERE 1=1"
    params: list[Any] = []
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")
    if designation:
        query += " AND designation = %s"
        params.append(designation.lower())
    query += " ORDER BY area_hectares DESC NULLS LAST"

    async with pool.connection() as conn:
        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/agriculture/stats", response_model=list[AgriculturalMunicipalStat])
async def get_agriculture_stats(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    year: int | None = Query(None, description="Filter by reporting year"),
):
    query = "SELECT municipality, year, crop_family, crop_name, area_hectares, percentage_of_agricultural_land FROM agriculture_municipal_stats WHERE 1=1"
    params: list[Any] = []
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")
    if year:
        query += " AND year = %s"
        params.append(year)
    query += " ORDER BY municipality, percentage_of_agricultural_land DESC"

    async with pool.connection() as conn:
        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/agriculture/parcels", response_model=list[CropZoneResponse])
async def get_crop_parcels(
    pool: DbPool,
    crop_family: str | None = Query(None, description="Filter by crop family: sonderkultur, gemuese, getreide"),
    year: int | None = Query(2025, description="Crop harvest year"),
):
    query = "SELECT id, municipality, crop_name, crop_family, year, area_hectares, irrigation_demand_class, geojson FROM agriculture_crop_zones WHERE 1=1"
    params: list[Any] = []
    if crop_family:
        query += " AND crop_family = %s"
        params.append(crop_family)
    if year:
        query += " AND year = %s"
        params.append(year)
    query += " ORDER BY area_hectares DESC NULLS LAST LIMIT 200"

    async with pool.connection() as conn:
        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/flood/gauges", response_model=list[FloodGaugeResponse])
async def get_flood_gauges(pool: DbPool):
    query = "SELECT id, name, water_body, municipality, latitude, longitude, current_level_m, discharge_m3_s, alarm_level_1_m, alarm_level_2_m, alarm_level_3_m, status, source, updated_at FROM flood_gauges ORDER BY water_body, name"
    async with pool.connection() as conn:
        cursor = await conn.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/flood/infrastructure", response_model=list[FloodInfrastructureResponse])
async def get_flood_infrastructure(pool: DbPool):
    query = "SELECT id, name, infrastructure_type, water_body, municipality, latitude, longitude, protection_level, description FROM flood_infrastructure ORDER BY water_body, name"
    async with pool.connection() as conn:
        cursor = await conn.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/noise/corridors", response_model=list[NoiseCorridorResponse])
async def get_noise_corridors(pool: DbPool):
    query = "SELECT id, corridor_type, name, noise_metric, db_band, geojson FROM noise_corridors ORDER BY corridor_type, db_band DESC"
    async with pool.connection() as conn:
        cursor = await conn.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/map-services", response_model=list[MapServiceResponse])
async def get_map_services(pool: DbPool):
    query = "SELECT id, title, category, service_type, wms_url, layer_name, legend_url, attribution, default_opacity, min_zoom, max_zoom FROM environmental_map_services WHERE is_active = TRUE ORDER BY id"
    async with pool.connection() as conn:
        cursor = await conn.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@router.get("/groundwater", response_model=list[GroundwaterStationResponse])
async def get_groundwater_stations(pool: DbPool):
    query = """
    SELECT sm.id, sm.friendly_name, sm.latitude, sm.longitude, sm.description,
           d.value AS depth_to_water_m,
           d.timestamp AS measured_at,
           n.value AS nitrate_mg_l
    FROM sensor_metadata sm
    LEFT JOIN sensor_latest d ON d.sensor_id = sm.id AND d.metric = 'groundwater_depth_m'
    LEFT JOIN sensor_latest n ON n.sensor_id = sm.id AND n.metric = 'groundwater_nitrate_mg_l'
    WHERE sm.id LIKE 'gw-%' AND sm.is_hidden = FALSE
    ORDER BY sm.friendly_name
    """
    async with pool.connection() as conn:
        cursor = await conn.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
