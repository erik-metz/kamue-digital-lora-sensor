"""Social & Daily Life endpoints for the Hessian Ried.
Covers:
- Unemployment rates & social benefit recipients (SGB II / SGB XII)
- Healthcare facilities & supply density (doctors, specialists, pharmacies)
- Cultural events, sports complexes & association landscape
- ZAKB waste statistics & recycling rates
- Tourism figures & regional leisure attractions
"""

from datetime import date, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_admin_key
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/social", tags=["Social & Daily Life"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]
AdminAuth = Annotated[str, Depends(verify_admin_key)]


# --- Models ---
class MunicipalIndicatorResponse(BaseModel):
    id: int
    municipality: str
    category: str
    metric_key: str
    period: str
    period_date: date
    value: float
    unit: str
    benchmark_value: float | None = None
    dimension: str
    source: str
    source_url: str | None = None


class SocialKpiSummary(BaseModel):
    municipality: str
    unemployment_rate: float | None = None
    unemployed_count: int | None = None
    sgb2_recipients: int | None = None
    sgb2_quota_pct: float | None = None
    gp_doctors_per_10k: float | None = None
    specialists_per_10k: float | None = None
    pharmacies_count: int | None = None
    versorgungsgrad_pct: float | None = None
    total_clubs_count: int | None = None
    sports_clubs_count: int | None = None
    cultural_clubs_count: int | None = None
    recycling_rate_percent: float | None = None
    waste_kg_per_capita: float | None = None


class ZakbWasteStatResponse(BaseModel):
    id: int
    municipality: str
    year: int
    fraction: str
    weight_tons: float
    kg_per_capita: float
    recycling_rate_percent: float | None = None
    source: str


class RegionalFacilityResponse(BaseModel):
    id: str
    name: str
    category: str = Field(..., description="'healthcare' | 'culture_sports' | 'tourism'")
    facility_type: str
    municipality: str
    district: str | None = None
    street_address: str
    postal_code: str
    latitude: float
    longitude: float
    phone: str | None = None
    website: str | None = None
    description: str | None = None
    opening_hours: dict[str, Any] | None = None
    extra_attributes: dict[str, Any] | None = None
    is_active: bool = True


class CulturalEventResponse(BaseModel):
    id: str
    title: str
    organizer: str
    venue_id: str | None = None
    venue_name: str
    municipality: str
    start_time: datetime
    end_time: datetime | None = None
    category: str
    description: str | None = None
    ticket_url: str | None = None
    is_free: bool = False


# --- Endpoints ---

@router.get("/indicators", response_model=list[MunicipalIndicatorResponse])
async def get_social_indicators(
    pool: DbPool,
    municipality: str | None = Query(default=None, description="Filter by municipality (e.g. Bürstadt, Lampertheim)"),
    category: str | None = Query(default=None, description="Filter by category ('employment', 'social', 'healthcare_density', 'associations', 'tourism')"),
    metric_key: str | None = Query(default=None, description="Filter by specific metric key"),
):
    """Retrieve social & labor market indicators, healthcare density, association numbers, and tourism metrics."""
    query = """
        SELECT id, municipality, category, metric_key, period, period_date,
               value, unit, benchmark_value, dimension, source, source_url
        FROM municipal_statistics
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")
    if category:
        query += " AND category = %s"
        params.append(category)
    if metric_key:
        query += " AND metric_key = %s"
        params.append(metric_key)

    query += " ORDER BY municipality ASC, category ASC, period_date DESC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [MunicipalIndicatorResponse(**dict(r)) for r in rows]


@router.get("/indicators/summary", response_model=list[SocialKpiSummary])
async def get_social_summary(pool: DbPool):
    """Get high-level Social & Daily Life KPI summary comparing Bürstadt, Lampertheim, Biblis, and benchmarks."""
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute("""
            SELECT municipality, metric_key, value
            FROM municipal_statistics
            WHERE period IN ('2025', '2026-Q2', '2024')
            ORDER BY period_date DESC
        """)
        stats_rows = await cur.fetchall()

        await cur.execute("""
            SELECT municipality, recycling_rate_percent, kg_per_capita
            FROM zakb_waste_statistics
            WHERE fraction = 'total' AND year = 2025
        """)
        waste_rows = await cur.fetchall()

    waste_map: dict[str, dict[str, float]] = {}
    for w in waste_rows:
        waste_map[w["municipality"]] = {
            "recycling_rate": w["recycling_rate_percent"],
            "kg_per_capita": w["kg_per_capita"],
        }

    muni_data: dict[str, dict[str, Any]] = {}
    target_munis = ["Bürstadt", "Lampertheim", "Biblis", "Groß-Rohrheim", "Kreis Bergstraße", "Hessen"]
    for m in target_munis:
        muni_data[m] = {}

    for row in stats_rows:
        m = row["municipality"]
        if m in muni_data and row["metric_key"] not in muni_data[m]:
            muni_data[m][row["metric_key"]] = row["value"]

    summaries: list[SocialKpiSummary] = []
    for m in target_munis:
        d = muni_data.get(m, {})
        w = waste_map.get(m, {})
        summaries.append(
            SocialKpiSummary(
                municipality=m,
                unemployment_rate=d.get("unemployment_rate"),
                unemployed_count=int(d["unemployed_count"]) if "unemployed_count" in d else None,
                sgb2_recipients=int(d["sgb2_recipients"]) if "sgb2_recipients" in d else None,
                sgb2_quota_pct=d.get("sgb2_quota_pct"),
                gp_doctors_per_10k=d.get("gp_doctors_per_10k"),
                specialists_per_10k=d.get("specialists_per_10k"),
                pharmacies_count=int(d["pharmacies_count"]) if "pharmacies_count" in d else None,
                versorgungsgrad_pct=d.get("versorgungsgrad_pct"),
                total_clubs_count=int(d["total_clubs"]) if "total_clubs" in d else None,
                sports_clubs_count=int(d["sports_clubs"]) if "sports_clubs" in d else None,
                cultural_clubs_count=int(d["cultural_music_clubs"]) if "cultural_music_clubs" in d else None,
                recycling_rate_percent=w.get("recycling_rate"),
                waste_kg_per_capita=w.get("kg_per_capita"),
            )
        )
    return summaries


@router.get("/waste-statistics", response_model=list[ZakbWasteStatResponse])
async def get_waste_statistics(
    pool: DbPool,
    municipality: str | None = Query(default=None, description="Filter by municipality"),
    year: int | None = Query(default=None, description="Filter by year (e.g. 2024, 2025)"),
):
    """Retrieve ZAKB waste streams, per-capita weights, and recycling quotas."""
    query = """
        SELECT id, municipality, year, fraction, weight_tons, kg_per_capita,
               recycling_rate_percent, source
        FROM zakb_waste_statistics
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")
    if year:
        query += " AND year = %s"
        params.append(year)

    query += " ORDER BY year DESC, municipality ASC, fraction ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [ZakbWasteStatResponse(**dict(r)) for r in rows]


@router.get("/facilities", response_model=list[RegionalFacilityResponse])
async def get_regional_facilities(
    pool: DbPool,
    category: str | None = Query(default=None, description="'healthcare' | 'culture_sports' | 'tourism'"),
    facility_type: str | None = Query(default=None, description="e.g. 'pharmacy', 'doctor_gp', 'sports_complex', 'attraction'"),
    municipality: str | None = Query(default=None, description="Filter by municipality"),
):
    """Retrieve regional facilities and POIs for mapping and exploration."""
    query = """
        SELECT id, name, category, facility_type, municipality, district,
               street_address, postal_code, latitude, longitude, phone, website,
               description, opening_hours, extra_attributes, is_active
        FROM regional_facilities
        WHERE is_active = TRUE
    """
    params: list[Any] = []
    if category:
        query += " AND category = %s"
        params.append(category)
    if facility_type:
        query += " AND facility_type = %s"
        params.append(facility_type)
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")

    query += " ORDER BY category ASC, municipality ASC, name ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [RegionalFacilityResponse(**dict(r)) for r in rows]


@router.get("/events", response_model=list[CulturalEventResponse])
async def get_cultural_events(
    pool: DbPool,
    municipality: str | None = Query(default=None, description="Filter by municipality"),
    category: str | None = Query(default=None, description="Filter by category (concert, workshop, sports, etc.)"),
):
    """Retrieve upcoming community and cultural events (including Kulturzentrum KAMÜ)."""
    query = """
        SELECT id, title, organizer, venue_id, venue_name, municipality,
               start_time, end_time, category, description, ticket_url, is_free
        FROM cultural_events
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality}%")
    if category:
        query += " AND category = %s"
        params.append(category)

    query += " ORDER BY start_time ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [CulturalEventResponse(**dict(r)) for r in rows]
