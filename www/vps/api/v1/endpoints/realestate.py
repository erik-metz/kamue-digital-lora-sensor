"""Real Estate, Buildings, Land Use & Housing Stock endpoints for the Hessian Ried.
Covers Bürstadt, Lampertheim, Biblis, Groß-Rohrheim, Einhausen, and Lorsch.
"""

from datetime import date, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

router = APIRouter(prefix="/realestate", tags=["Real Estate & Buildings"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class HousingStockResponse(BaseModel):
    id: str
    municipality: str
    district: str | None = None
    reference_year: int
    total_buildings: int
    residential_buildings: int
    total_dwellings: int
    avg_living_space_sqm: float
    vacant_dwellings: int
    vacancy_rate_pct: float
    age_distribution: dict[str, int]
    building_types: dict[str, int]
    heating_energy: dict[str, float]
    source: str
    updated_at: datetime


class BorisZoneResponse(BaseModel):
    id: str
    zone_code: str
    municipality: str
    district: str | None = None
    stichtag: date
    land_value_eur_sqm: float
    zone_type: str
    development_status: str
    floor_space_index: float | None = None
    center_lat: float
    center_lng: float
    geometry: dict[str, Any]
    source: str
    updated_at: datetime


class LandUsePolygonResponse(BaseModel):
    id: str
    municipality: str
    district: str | None = None
    category: str
    category_detail: str
    area_sqm: float | None = None
    area_hectares: float | None = None
    center_lat: float
    center_lng: float
    geometry: dict[str, Any]
    source: str
    updated_at: datetime


class ConstructionPermitResponse(BaseModel):
    id: str
    municipality: str
    year: int
    residential_permits_count: int
    residential_dwellings_count: int
    residential_living_space_sqm: float | None = None
    non_residential_volume_m3: float | None = None
    completions_buildings_count: int
    completions_dwellings_count: int
    source: str
    updated_at: datetime


class MarketBenchmarkResponse(BaseModel):
    id: str
    municipality: str
    year: int
    metric_type: str
    median_val: float | None = None
    avg_val: float
    min_val: float | None = None
    max_val: float | None = None
    unit: str
    transaction_count: int | None = None
    source: str
    source_title: str | None = None
    updated_at: datetime


class DevelopmentPlanResponse(BaseModel):
    id: str
    municipality: str
    district: str | None = None
    plan_name: str
    plan_number: str | None = None
    status: str
    target_use: str
    area_hectares: float | None = None
    resolution_year: int | None = None
    document_url: str | None = None
    center_lat: float
    center_lng: float
    geometry: dict[str, Any] | None = None
    updated_at: datetime


class RealEstateSummaryItem(BaseModel):
    municipality: str
    total_dwellings: int
    vacancy_rate_pct: float
    avg_living_space_sqm: float
    avg_land_value_residential: float
    avg_rent_cold_sqm: float
    avg_apartment_buy_sqm: float | None = None
    recent_permits_dwellings: int
    recent_completions_dwellings: int
    active_bplaene_count: int


class RealEstateSourceResponse(BaseModel):
    id: str
    name: str
    provider: str
    dataset_type: str
    license: str
    source_url: str | None = None
    last_imported_at: datetime | None = None
    record_count: int


@router.get("/summary", response_model=list[RealEstateSummaryItem])
async def get_realestate_summary(pool: DbPool):
    """Provides high-level real estate and housing KPIs across all Ried municipalities."""
    query = """
        WITH stock AS (
            SELECT DISTINCT ON (municipality)
                municipality, total_dwellings, vacancy_rate_pct, avg_living_space_sqm
            FROM housing_stock_stats
            ORDER BY municipality, reference_year DESC
        ),
        boris_res AS (
            SELECT municipality, ROUND(AVG(land_value_eur_sqm)::numeric, 1) as avg_land_val
            FROM boris_land_value_zones
            WHERE zone_type = 'Wohnbaufläche'
            GROUP BY municipality
        ),
        rent AS (
            SELECT DISTINCT ON (municipality)
                municipality, avg_val as rent_val
            FROM realestate_market_benchmarks
            WHERE metric_type = 'rent_cold_sqm'
            ORDER BY municipality, year DESC
        ),
        apt AS (
            SELECT DISTINCT ON (municipality)
                municipality, avg_val as apt_val
            FROM realestate_market_benchmarks
            WHERE metric_type = 'apartment_buy_sqm'
            ORDER BY municipality, year DESC
        ),
        permits AS (
            SELECT DISTINCT ON (municipality)
                municipality, residential_dwellings_count, completions_dwellings_count
            FROM construction_permits
            ORDER BY municipality, year DESC
        ),
        plans AS (
            SELECT municipality, COUNT(*) as plan_count
            FROM development_plans
            GROUP BY municipality
        )
        SELECT
            s.municipality,
            s.total_dwellings,
            s.vacancy_rate_pct,
            s.avg_living_space_sqm,
            COALESCE(b.avg_land_val, 400.0) as avg_land_value_residential,
            COALESCE(r.rent_val, 8.5) as avg_rent_cold_sqm,
            a.apt_val as avg_apartment_buy_sqm,
            COALESCE(p.residential_dwellings_count, 0) as recent_permits_dwellings,
            COALESCE(p.completions_dwellings_count, 0) as recent_completions_dwellings,
            COALESCE(pl.plan_count, 0) as active_bplaene_count
        FROM stock s
        LEFT JOIN boris_res b ON s.municipality = b.municipality
        LEFT JOIN rent r ON s.municipality = r.municipality
        LEFT JOIN apt a ON s.municipality = a.municipality
        LEFT JOIN permits p ON s.municipality = p.municipality
        LEFT JOIN plans pl ON s.municipality = pl.municipality
        ORDER BY s.total_dwellings DESC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query)
        rows = await cur.fetchall()
    return [RealEstateSummaryItem(**r) for r in rows]


@router.get("/housing-stock", response_model=list[HousingStockResponse])
async def get_housing_stock(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
):
    """Housing stock, age structure, heating energy, and vacancy rates (Zensus 2022)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, municipality, district, reference_year, total_buildings,
            residential_buildings, total_dwellings, avg_living_space_sqm,
            vacant_dwellings, vacancy_rate_pct, age_distribution,
            building_types, heating_energy, source, updated_at
        FROM housing_stock_stats
        {where}
        ORDER BY total_dwellings DESC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [HousingStockResponse(**r) for r in rows]


@router.get("/boris", response_model=list[BorisZoneResponse])
async def get_boris_zones(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    zone_type: str | None = Query(None, description="Filter by zone type"),
):
    """BORIS Hessen official standard land value zones (Bodenrichtwerte)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)
    if zone_type:
        clauses.append("zone_type = %s")
        params.append(zone_type)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, zone_code, municipality, district, stichtag,
            land_value_eur_sqm, zone_type, development_status,
            floor_space_index, center_lat, center_lng, geometry,
            source, updated_at
        FROM boris_land_value_zones
        {where}
        ORDER BY land_value_eur_sqm DESC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [BorisZoneResponse(**r) for r in rows]


@router.get("/land-use", response_model=list[LandUsePolygonResponse])
async def get_land_use(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    category: str | None = Query(None, description="Filter by category (forest, agriculture, settlement, etc.)"),
):
    """ALKIS Tatsächliche Nutzung (land use zones and areas)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)
    if category:
        clauses.append("category = %s")
        params.append(category)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, municipality, district, category, category_detail,
            area_sqm, area_hectares, center_lat, center_lng, geometry,
            source, updated_at
        FROM land_use_polygons
        {where}
        ORDER BY area_hectares DESC NULLS LAST
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [LandUsePolygonResponse(**r) for r in rows]


@router.get("/construction-activity", response_model=list[ConstructionPermitResponse])
async def get_construction_activity(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
):
    """Construction activity: Baugenehmigungen and Baufertigstellungen (Statistik Hessen)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, municipality, year, residential_permits_count,
            residential_dwellings_count, residential_living_space_sqm,
            non_residential_volume_m3, completions_buildings_count,
            completions_dwellings_count, source, updated_at
        FROM construction_permits
        {where}
        ORDER BY municipality, year ASC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [ConstructionPermitResponse(**r) for r in rows]


@router.get("/market-benchmarks", response_model=list[MarketBenchmarkResponse])
async def get_market_benchmarks(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    metric_type: str | None = Query(None, description="Filter by metric type"),
):
    """Real estate purchase and rental price benchmarks (Gutachterausschuss)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)
    if metric_type:
        clauses.append("metric_type = %s")
        params.append(metric_type)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, municipality, year, metric_type, median_val,
            avg_val, min_val, max_val, unit, transaction_count,
            source, source_title, updated_at
        FROM realestate_market_benchmarks
        {where}
        ORDER BY municipality, year DESC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [MarketBenchmarkResponse(**r) for r in rows]


@router.get("/development-plans", response_model=list[DevelopmentPlanResponse])
async def get_development_plans(
    pool: DbPool,
    municipality: str | None = Query(None, description="Filter by municipality"),
    status_filter: str | None = Query(None, description="Filter by status"),
):
    """Active and legally approved municipal development plans (Bebauungspläne / B-Pläne)."""
    clauses: list[str] = []
    params: list[Any] = []
    if municipality:
        clauses.append("LOWER(municipality) = LOWER(%s)")
        params.append(municipality)
    if status_filter:
        clauses.append("status = %s")
        params.append(status_filter)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT
            id, municipality, district, plan_name, plan_number,
            status, target_use, area_hectares, resolution_year,
            document_url, center_lat, center_lng, geometry,
            updated_at
        FROM development_plans
        {where}
        ORDER BY municipality, area_hectares DESC NULLS LAST
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [DevelopmentPlanResponse(**r) for r in rows]


@router.get("/sources", response_model=list[RealEstateSourceResponse])
async def get_sources(pool: DbPool):
    """Metadata about real estate, cadastral, and statistical data sources."""
    query = """
        SELECT
            id, name, provider, dataset_type, license,
            source_url, last_imported_at, record_count
        FROM realestate_sources
        ORDER BY name ASC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query)
        rows = await cur.fetchall()
    return [RealEstateSourceResponse(**r) for r in rows]
