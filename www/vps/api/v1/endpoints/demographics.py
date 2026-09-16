"""Demographics, Commuters & Educational Infrastructure endpoints for the Ried area.
Covers Bürstadt, Lampertheim, Biblis, Groß-Rohrheim, Hofheim (Ried).
"""

from datetime import datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_admin_key
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/demographics", tags=["People & Demographics"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]
AdminAuth = Annotated[str, Depends(verify_admin_key)]


class MunicipalityResponse(BaseModel):
    id: str
    ags: str
    name: str
    county: str
    state: str
    area_sqkm: float
    center_lat: float
    center_lng: float


class DemographicSummaryItem(BaseModel):
    municipality_id: str
    name: str
    total_population: int | None = None
    population_density: float | None = None
    foreign_share_pct: float | None = None
    births: int | None = None
    deaths: int | None = None
    inflow: int | None = None
    outflow: int | None = None
    net_migration: int | None = None
    avg_household_size: float | None = None
    schools_count: int = 0
    kitas_count: int = 0
    year: int = 2024


class DemographicSnapshotResponse(BaseModel):
    municipality_id: str
    year: int
    category: str
    metric: str
    value: float
    unit: str
    dimension: str
    source: str
    source_url: str | None = None
    recorded_at: datetime


class CommuterFlowResponse(BaseModel):
    year: int
    home_municipality_id: str
    partner_ags: str
    partner_name: str
    direction: str = Field(..., description="'inbound' | 'outbound'")
    commuter_count: int
    source: str


class EducationalFacilityResponse(BaseModel):
    id: str
    name: str
    facility_type: str = Field(..., description="'kita' | 'krippe' | 'grundschule' | 'gesamtschule' | 'gymnasium' | 'foerderschule'")
    municipality_id: str
    district: str | None = None
    address: str
    latitude: float
    longitude: float
    operator: str
    operator_name: str | None = None
    capacity: int | None = None
    current_enrollment: int | None = None
    utilization_rate: float | None = None
    min_age_years: int | None = None
    max_age_years: int | None = None
    opening_hours: str | None = None
    website_url: str | None = None
    reporting_year: int = 2025
    is_active: bool = True


class IngestSnapshotPayload(BaseModel):
    municipality_id: str
    year: int
    category: str
    metric: str
    value: float
    unit: str = "count"
    dimension: str = "total"
    source: str = "hessisches_statistisches_landesamt"
    source_url: str | None = None


class IngestFacilityPayload(BaseModel):
    id: str
    name: str
    facility_type: str
    municipality_id: str
    district: str | None = None
    address: str
    latitude: float
    longitude: float
    operator: str
    operator_name: str | None = None
    capacity: int | None = None
    current_enrollment: int | None = None
    min_age_years: int | None = None
    max_age_years: int | None = None
    opening_hours: str | None = None
    website_url: str | None = None
    reporting_year: int = 2025
    is_active: bool = True


@router.get("/municipalities", response_model=list[MunicipalityResponse])
async def list_municipalities(pool: DbPool):
    """List all tracked municipalities in the Hessian Ried."""
    query = """
        SELECT id, ags, name, county, state, area_sqkm, center_lat, center_lng
        FROM municipalities
        ORDER BY name ASC
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query)
        rows = await cur.fetchall()
    return [MunicipalityResponse(**r) for r in rows]


@router.get("/summary", response_model=list[DemographicSummaryItem])
async def get_demographic_summary(
    pool: DbPool,
    year: int = Query(default=2024, description="Target reporting year"),
):
    """Returns comparative demographic and infrastructure scorecard for all Ried municipalities."""
    query_munis = """
        SELECT id, name FROM municipalities ORDER BY name ASC
    """
    query_snaps = """
        SELECT municipality_id, metric, value
        FROM demographic_snapshots
        WHERE year = %s
    """
    query_facs = """
        SELECT municipality_id, facility_type, COUNT(*) as count
        FROM educational_facilities
        WHERE is_active = TRUE
        GROUP BY municipality_id, facility_type
    """

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query_munis)
        munis = await cur.fetchall()

        await cur.execute(query_snaps, [year])
        snaps = await cur.fetchall()

        await cur.execute(query_facs)
        facs = await cur.fetchall()

    snap_map: dict[str, dict[str, float]] = {}
    for s in snaps:
        m_id = s["municipality_id"]
        if m_id not in snap_map:
            snap_map[m_id] = {}
        snap_map[m_id][s["metric"]] = s["value"]

    fac_map: dict[str, dict[str, int]] = {}
    for f in facs:
        m_id = f["municipality_id"]
        if m_id not in fac_map:
            fac_map[m_id] = {"schools": 0, "kitas": 0}
        ftype = f["facility_type"]
        if ftype in ("kita", "krippe"):
            fac_map[m_id]["kitas"] += f["count"]
        else:
            fac_map[m_id]["schools"] += f["count"]

    results: list[DemographicSummaryItem] = []
    for m in munis:
        m_id = m["id"]
        metrics = snap_map.get(m_id, {})
        counts = fac_map.get(m_id, {"schools": 0, "kitas": 0})
        item = DemographicSummaryItem(
            municipality_id=m_id,
            name=m["name"],
            total_population=int(metrics["total_population"]) if "total_population" in metrics else None,
            population_density=metrics.get("population_density"),
            foreign_share_pct=metrics.get("foreign_share_pct"),
            births=int(metrics["births"]) if "births" in metrics else None,
            deaths=int(metrics["deaths"]) if "deaths" in metrics else None,
            inflow=int(metrics["inflow"]) if "inflow" in metrics else None,
            outflow=int(metrics["outflow"]) if "outflow" in metrics else None,
            net_migration=int(metrics["net_migration"]) if "net_migration" in metrics else None,
            avg_household_size=metrics.get("avg_household_size"),
            schools_count=counts["schools"],
            kitas_count=counts["kitas"],
            year=year,
        )
        results.append(item)
    return results


@router.get("/{municipality_id}/timeseries", response_model=list[DemographicSnapshotResponse])
async def get_municipality_timeseries(
    municipality_id: str,
    pool: DbPool,
    category: str | None = Query(default=None, description="'population' | 'age_structure' | 'migration' | 'household' | 'citizenship'"),
    metric: str | None = Query(default=None, description="Specific metric name"),
):
    """Retrieve historical demographic snapshot records for a municipality."""
    query = """
        SELECT municipality_id, year, category, metric, value, unit, dimension,
               source, source_url, recorded_at
        FROM demographic_snapshots
        WHERE municipality_id = %s
    """
    params: list[Any] = [municipality_id]
    if category:
        query += " AND category = %s"
        params.append(category)
    if metric:
        query += " AND metric = %s"
        params.append(metric)

    query += " ORDER BY year DESC, category ASC, metric ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [DemographicSnapshotResponse(**r) for r in rows]


@router.get("/{municipality_id}/commuters", response_model=list[CommuterFlowResponse])
async def get_municipality_commuters(
    municipality_id: str,
    pool: DbPool,
    direction: str | None = Query(default=None, description="'inbound' | 'outbound'"),
    year: int = Query(default=2024, description="Reporting year"),
):
    """Retrieve commuter flow connections (Pendlerströme) for a municipality."""
    query = """
        SELECT year, home_municipality_id, partner_ags, partner_name, direction,
               commuter_count, source
        FROM commuter_flows
        WHERE home_municipality_id = %s AND year = %s
    """
    params: list[Any] = [municipality_id, year]
    if direction:
        query += " AND direction = %s"
        params.append(direction)
    query += " ORDER BY commuter_count DESC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    return [CommuterFlowResponse(**r) for r in rows]


@router.get("/facilities", response_model=list[EducationalFacilityResponse])
async def list_educational_facilities(
    pool: DbPool,
    municipality_id: str | None = Query(default=None, description="Filter by municipality, e.g. buerstadt, lampertheim"),
    facility_type: str | None = Query(default=None, description="Filter: 'kita', 'grundschule', 'gymnasium', etc."),
):
    """List schools and childcare facilities (Kitas) with coordinates and capacity metrics."""
    query = """
        SELECT id, name, facility_type, municipality_id, district, address,
               latitude, longitude, operator, operator_name, capacity,
               current_enrollment, min_age_years, max_age_years, opening_hours,
               website_url, reporting_year, is_active
        FROM educational_facilities
        WHERE is_active = TRUE
    """
    params: list[Any] = []
    if municipality_id:
        query += " AND municipality_id = %s"
        params.append(municipality_id)
    if facility_type:
        query += " AND facility_type = %s"
        params.append(facility_type)

    query += " ORDER BY municipality_id ASC, facility_type ASC, name ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()

    results: list[EducationalFacilityResponse] = []
    for r in rows:
        cap = r.get("capacity")
        enr = r.get("current_enrollment")
        rate = round((enr / cap) * 100, 1) if cap and enr and cap > 0 else None
        item_data = dict(r)
        item_data["utilization_rate"] = rate
        results.append(EducationalFacilityResponse(**item_data))
    return results


@router.post("/snapshots", status_code=status.HTTP_201_CREATED)
async def ingest_demographic_snapshot(
    payload: IngestSnapshotPayload,
    pool: DbPool,
    _: AdminAuth,
):
    """Admin-only endpoint to ingest or update demographic snapshot metrics."""
    query = """
        INSERT INTO demographic_snapshots (
            municipality_id, year, category, metric, value, unit, dimension, source, source_url
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (municipality_id, year, category, metric, dimension) DO UPDATE SET
            value = EXCLUDED.value,
            unit = EXCLUDED.unit,
            source = EXCLUDED.source,
            source_url = EXCLUDED.source_url,
            recorded_at = NOW()
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            query,
            [
                payload.municipality_id,
                payload.year,
                payload.category,
                payload.metric,
                payload.value,
                payload.unit,
                payload.dimension,
                payload.source,
                payload.source_url,
            ],
        )
    return {"status": "ok", "message": "Snapshot metric recorded"}


@router.post("/facilities", status_code=status.HTTP_201_CREATED)
async def ingest_educational_facility(
    payload: IngestFacilityPayload,
    pool: DbPool,
    _: AdminAuth,
):
    """Admin-only endpoint to upsert educational or childcare facilities."""
    query = """
        INSERT INTO educational_facilities (
            id, name, facility_type, municipality_id, district, address,
            latitude, longitude, operator, operator_name, capacity,
            current_enrollment, min_age_years, max_age_years, opening_hours,
            website_url, reporting_year, is_active
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            facility_type = EXCLUDED.facility_type,
            municipality_id = EXCLUDED.municipality_id,
            district = EXCLUDED.district,
            address = EXCLUDED.address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            operator = EXCLUDED.operator,
            operator_name = EXCLUDED.operator_name,
            capacity = EXCLUDED.capacity,
            current_enrollment = EXCLUDED.current_enrollment,
            min_age_years = EXCLUDED.min_age_years,
            max_age_years = EXCLUDED.max_age_years,
            opening_hours = EXCLUDED.opening_hours,
            website_url = EXCLUDED.website_url,
            reporting_year = EXCLUDED.reporting_year,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            query,
            [
                payload.id,
                payload.name,
                payload.facility_type,
                payload.municipality_id,
                payload.district,
                payload.address,
                payload.latitude,
                payload.longitude,
                payload.operator,
                payload.operator_name,
                payload.capacity,
                payload.current_enrollment,
                payload.min_age_years,
                payload.max_age_years,
                payload.opening_hours,
                payload.website_url,
                payload.reporting_year,
                payload.is_active,
            ],
        )
    return {"status": "ok", "message": "Facility saved"}
