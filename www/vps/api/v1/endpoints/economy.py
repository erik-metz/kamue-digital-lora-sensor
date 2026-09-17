"""Economy, Companies, Business Registrations & Municipal Trade Taxes endpoints.
Covers Kreis Bergstraße with deep dive into Bürstadt, Lampertheim, Biblis, and Groß-Rohrheim.
"""

from datetime import UTC, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool, verify_api_key
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

router = APIRouter(prefix="/economy", tags=["Economy & Companies"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class MunicipalityTaxRateResponse(BaseModel):
    id: int
    municipality_id: str
    municipality_name: str | None = None
    year: int
    hebesatz_gewerbesteuer: int
    hebesatz_grundsteuer_a: int
    hebesatz_grundsteuer_b: int
    revenue_gewerbesteuer_eur: int | None = None
    revenue_grundsteuer_a_eur: int | None = None
    revenue_grundsteuer_b_eur: int | None = None
    tax_revenue_per_capita_eur: float | None = None
    source: str
    source_url: str | None = None
    updated_at: datetime


class BusinessRegistrationResponse(BaseModel):
    id: int
    region_code: str
    region_type: str
    year: int
    registrations_total: int
    new_foundations: int
    relocations_in: int
    deregistrations_total: int
    liquidations: int
    relocations_out: int
    net_balance: int
    source: str
    updated_at: datetime


class IndustryEmploymentResponse(BaseModel):
    id: int
    region_code: str
    year: int
    sector_code: str
    sector_name: str
    employees_count: int
    share_percent: float | None = None
    source: str


class CompanyResponse(BaseModel):
    id: str
    name: str
    legal_form: str | None = None
    municipality_id: str
    municipality_name: str | None = None
    district: str | None = None
    street_address: str
    postal_code: str
    latitude: float
    longitude: float
    industry_sector: str
    wz_code: str | None = None
    employee_range: str
    turnover_estimated_range: str | None = None
    description: str | None = None
    website: str | None = None
    is_headquarters: bool
    source: str
    source_url: str | None = None
    created_at: datetime
    updated_at: datetime


class StartupInitiativeResponse(BaseModel):
    id: str
    name: str
    category: str
    organizer: str
    description: str
    url: str | None = None
    funding_bracket: str | None = None
    target_group: str | None = None
    created_at: datetime


class EconomyOverviewResponse(BaseModel):
    year: int
    county_registrations_total: int
    county_deregistrations_total: int
    county_net_balance: int
    county_total_employees: int
    total_companies_cataloged: int
    average_hebesatz_gewerbesteuer: float
    min_hebesatz_gewerbesteuer: int
    max_hebesatz_gewerbesteuer: int
    key_municipalities: list[dict[str, Any]]


class IngestCompanyPayload(BaseModel):
    id: str
    name: str
    legal_form: str | None = None
    municipality_id: str
    district: str | None = None
    street_address: str
    postal_code: str
    latitude: float
    longitude: float
    industry_sector: str
    wz_code: str | None = None
    employee_range: str
    turnover_estimated_range: str | None = None
    description: str | None = None
    website: str | None = None
    is_headquarters: bool = False
    source: str = "bundesanzeiger_northdata"
    source_url: str | None = None


@router.get("/overview", response_model=EconomyOverviewResponse)
async def get_economy_overview(pool: DbPool, year: int = Query(default=2024)):
    """Retrieve top-level macroeconomic KPIs for Kreis Bergstraße & key Ried municipalities."""
    async with pool.connection() as conn, conn.cursor() as cur:
        # County business registration summary
        await cur.execute(
            """
            SELECT registrations_total, deregistrations_total, net_balance
            FROM business_registrations
            WHERE region_code = 'kreis-bergstrasse' AND year = %s
            LIMIT 1
            """,
            (year,),
        )
        reg_row = await cur.fetchone()
        reg_tot = reg_row[0] if reg_row else 2640
        dereg_tot = reg_row[1] if reg_row else 2380
        net_bal = reg_row[2] if reg_row else (reg_tot - dereg_tot)

        # County total SVB employees
        await cur.execute(
            """
            SELECT COALESCE(SUM(employees_count), 82500)
            FROM industry_employment
            WHERE region_code = 'kreis-bergstrasse' AND year = %s
            """,
            (year,),
        )
        emp_row = await cur.fetchone()
        total_emp = int(emp_row[0]) if emp_row and emp_row[0] else 82500

        # Companies cataloged count
        await cur.execute("SELECT COUNT(*) FROM companies")
        comp_count_row = await cur.fetchone()
        comp_count = comp_count_row[0] if comp_count_row else 0

        # Hebesatz statistics for the county
        await cur.execute(
            """
            SELECT AVG(hebesatz_gewerbesteuer), MIN(hebesatz_gewerbesteuer), MAX(hebesatz_gewerbesteuer)
            FROM municipality_tax_rates
            WHERE year = %s
            """,
            (year,),
        )
        tax_stats = await cur.fetchone()
        avg_hebesatz = round(float(tax_stats[0]), 1) if tax_stats and tax_stats[0] else 390.5
        min_hebesatz = int(tax_stats[1]) if tax_stats and tax_stats[1] else 380
        max_hebesatz = int(tax_stats[2]) if tax_stats and tax_stats[2] else 420

        # Key municipalities highlights (Bürstadt, Lampertheim, Biblis, Bensheim, Lorsch, Viernheim)
        await cur.execute(
            """
            SELECT m.id, m.name, t.hebesatz_gewerbesteuer, t.hebesatz_grundsteuer_b,
                   t.revenue_gewerbesteuer_eur, t.tax_revenue_per_capita_eur,
                   COALESCE(b.registrations_total, 0), COALESCE(b.net_balance, 0)
            FROM municipalities m
            LEFT JOIN municipality_tax_rates t ON m.id = t.municipality_id AND t.year = %s
            LEFT JOIN business_registrations b ON m.id = b.region_code AND b.year = %s
            WHERE m.id IN ('buerstadt', 'lampertheim', 'biblis', 'gross-rohrheim', 'bensheim', 'heppenheim', 'lorsch', 'viernheim')
            ORDER BY t.revenue_gewerbesteuer_eur DESC NULLS LAST
            """,
            (year, year),
        )
        key_rows = await cur.fetchall()
        key_munis = [
            {
                "municipality_id": r[0],
                "name": r[1],
                "hebesatz_gewerbesteuer": r[2],
                "hebesatz_grundsteuer_b": r[3],
                "revenue_gewerbesteuer_eur": r[4],
                "tax_revenue_per_capita_eur": r[5],
                "registrations_total": r[6],
                "net_balance": r[7],
            }
            for r in key_rows
        ]

    return EconomyOverviewResponse(
        year=year,
        county_registrations_total=reg_tot,
        county_deregistrations_total=dereg_tot,
        county_net_balance=net_bal,
        county_total_employees=total_emp,
        total_companies_cataloged=comp_count,
        average_hebesatz_gewerbesteuer=avg_hebesatz,
        min_hebesatz_gewerbesteuer=min_hebesatz,
        max_hebesatz_gewerbesteuer=max_hebesatz,
        key_municipalities=key_munis,
    )


@router.get("/companies", response_model=list[CompanyResponse])
async def list_companies(
    pool: DbPool,
    municipality_id: str | None = Query(default=None, description="Filter by municipality ID (e.g. 'buerstadt')"),
    industry_sector: str | None = Query(default=None, description="Filter by industry sector substring"),
    employee_range: str | None = Query(default=None, description="Filter by employee range"),
):
    """Retrieve cataloged major employers and commercial entities."""
    query = """
        SELECT c.id, c.name, c.legal_form, c.municipality_id, m.name AS municipality_name,
               c.district, c.street_address, c.postal_code, c.latitude, c.longitude,
               c.industry_sector, c.wz_code, c.employee_range, c.turnover_estimated_range,
               c.description, c.website, c.is_headquarters, c.source, c.source_url,
               c.created_at, c.updated_at
        FROM companies c
        LEFT JOIN municipalities m ON c.municipality_id = m.id
        WHERE 1=1
    """
    params: list[Any] = []

    if municipality_id:
        query += " AND c.municipality_id = %s"
        params.append(municipality_id.lower().strip())
    if industry_sector:
        query += " AND c.industry_sector ILIKE %s"
        params.append(f"%{industry_sector}%")
    if employee_range:
        query += " AND c.employee_range = %s"
        params.append(employee_range)

    query += " ORDER BY c.is_headquarters DESC, c.name ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, tuple(params))
        rows = await cur.fetchall()

    return [
        CompanyResponse(
            id=r[0],
            name=r[1],
            legal_form=r[2],
            municipality_id=r[3],
            municipality_name=r[4],
            district=r[5],
            street_address=r[6],
            postal_code=r[7],
            latitude=r[8],
            longitude=r[9],
            industry_sector=r[10],
            wz_code=r[11],
            employee_range=r[12],
            turnover_estimated_range=r[13],
            description=r[14],
            website=r[15],
            is_headquarters=r[16],
            source=r[17],
            source_url=r[18],
            created_at=r[19],
            updated_at=r[20],
        )
        for r in rows
    ]


@router.get("/taxes", response_model=list[MunicipalityTaxRateResponse])
async def list_tax_rates(
    pool: DbPool,
    year: int | None = Query(default=None, description="Filter by year (defaults to latest available if omitted)"),
    municipality_id: str | None = Query(default=None, description="Filter by municipality ID"),
):
    """Retrieve trade tax rates (Gewerbesteuer-Hebesätze) and revenue statistics."""
    query = """
        SELECT t.id, t.municipality_id, m.name AS municipality_name, t.year,
               t.hebesatz_gewerbesteuer, t.hebesatz_grundsteuer_a, t.hebesatz_grundsteuer_b,
               t.revenue_gewerbesteuer_eur, t.revenue_grundsteuer_a_eur, t.revenue_grundsteuer_b_eur,
               t.tax_revenue_per_capita_eur, t.source, t.source_url, t.updated_at
        FROM municipality_tax_rates t
        LEFT JOIN municipalities m ON t.municipality_id = m.id
        WHERE 1=1
    """
    params: list[Any] = []

    if year:
        query += " AND t.year = %s"
        params.append(year)
    if municipality_id:
        query += " AND t.municipality_id = %s"
        params.append(municipality_id.lower().strip())

    query += " ORDER BY t.year DESC, t.hebesatz_gewerbesteuer ASC, m.name ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, tuple(params))
        rows = await cur.fetchall()

    return [
        MunicipalityTaxRateResponse(
            id=r[0],
            municipality_id=r[1],
            municipality_name=r[2],
            year=r[3],
            hebesatz_gewerbesteuer=r[4],
            hebesatz_grundsteuer_a=r[5],
            hebesatz_grundsteuer_b=r[6],
            revenue_gewerbesteuer_eur=r[7],
            revenue_grundsteuer_a_eur=r[8],
            revenue_grundsteuer_b_eur=r[9],
            tax_revenue_per_capita_eur=r[10],
            source=r[11],
            source_url=r[12],
            updated_at=r[13],
        )
        for r in rows
    ]


@router.get("/registrations", response_model=list[BusinessRegistrationResponse])
async def list_business_registrations(
    pool: DbPool,
    region_code: str | None = Query(default=None, description="Filter by region_code ('kreis-bergstrasse' or municipality_id)"),
    year: int | None = Query(default=None, description="Filter by year"),
):
    """Retrieve detailed yearly business registration and closure statistics from Statistik Hessen."""
    query = """
        SELECT id, region_code, region_type, year, registrations_total, new_foundations,
               relocations_in, deregistrations_total, liquidations, relocations_out,
               net_balance, source, updated_at
        FROM business_registrations
        WHERE 1=1
    """
    params: list[Any] = []

    if region_code:
        query += " AND region_code = %s"
        params.append(region_code.lower().strip())
    if year:
        query += " AND year = %s"
        params.append(year)

    query += " ORDER BY year DESC, region_code ASC"

    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, tuple(params))
        rows = await cur.fetchall()

    return [
        BusinessRegistrationResponse(
            id=r[0],
            region_code=r[1],
            region_type=r[2],
            year=r[3],
            registrations_total=r[4],
            new_foundations=r[5],
            relocations_in=r[6],
            deregistrations_total=r[7],
            liquidations=r[8],
            relocations_out=r[9],
            net_balance=r[10],
            source=r[11],
            updated_at=r[12],
        )
        for r in rows
    ]


@router.get("/industry-structure", response_model=list[IndustryEmploymentResponse])
async def list_industry_structure(
    pool: DbPool,
    region_code: str = Query(default="kreis-bergstrasse", description="Region code ('kreis-bergstrasse', 'buerstadt', etc.)"),
    year: int = Query(default=2024, description="Reporting year"),
):
    """Retrieve employment structure by economic sector (WZ 2008 / NACE Rev. 2)."""
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT id, region_code, year, sector_code, sector_name, employees_count, share_percent, source
            FROM industry_employment
            WHERE region_code = %s AND year = %s
            ORDER BY employees_count DESC
            """,
            (region_code.lower().strip(), year),
        )
        rows = await cur.fetchall()

    return [
        IndustryEmploymentResponse(
            id=r[0],
            region_code=r[1],
            year=r[2],
            sector_code=r[3],
            sector_name=r[4],
            employees_count=r[5],
            share_percent=r[6],
            source=r[7],
        )
        for r in rows
    ]


@router.get("/startups", response_model=list[StartupInitiativeResponse])
async def list_startup_initiatives(pool: DbPool):
    """Retrieve regional startup support initiatives, grants, and incubators."""
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT id, name, category, organizer, description, url, funding_bracket, target_group, created_at
            FROM startup_initiatives
            ORDER BY name ASC
            """
        )
        rows = await cur.fetchall()

    return [
        StartupInitiativeResponse(
            id=r[0],
            name=r[1],
            category=r[2],
            organizer=r[3],
            description=r[4],
            url=r[5],
            funding_bracket=r[6],
            target_group=r[7],
            created_at=r[8],
        )
        for r in rows
    ]


@router.post("/companies", response_model=CompanyResponse, dependencies=[Depends(verify_api_key)])
async def upsert_company(payload: IngestCompanyPayload, pool: DbPool):
    """Insert or update a major employer company record (Requires API Secret Key)."""
    now = datetime.now(UTC)
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO companies (
                id, name, legal_form, municipality_id, district, street_address, postal_code,
                latitude, longitude, industry_sector, wz_code, employee_range, turnover_estimated_range,
                description, website, is_headquarters, source, source_url, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                legal_form = EXCLUDED.legal_form,
                municipality_id = EXCLUDED.municipality_id,
                district = EXCLUDED.district,
                street_address = EXCLUDED.street_address,
                postal_code = EXCLUDED.postal_code,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                industry_sector = EXCLUDED.industry_sector,
                wz_code = EXCLUDED.wz_code,
                employee_range = EXCLUDED.employee_range,
                turnover_estimated_range = EXCLUDED.turnover_estimated_range,
                description = EXCLUDED.description,
                website = EXCLUDED.website,
                is_headquarters = EXCLUDED.is_headquarters,
                source = EXCLUDED.source,
                source_url = EXCLUDED.source_url,
                updated_at = EXCLUDED.updated_at
            RETURNING created_at, updated_at
            """,
            (
                payload.id,
                payload.name,
                payload.legal_form,
                payload.municipality_id,
                payload.district,
                payload.street_address,
                payload.postal_code,
                payload.latitude,
                payload.longitude,
                payload.industry_sector,
                payload.wz_code,
                payload.employee_range,
                payload.turnover_estimated_range,
                payload.description,
                payload.website,
                payload.is_headquarters,
                payload.source,
                payload.source_url,
                now,
            ),
        )
        row = await cur.fetchone()
        created_at = row[0] if row else now
        updated_at = row[1] if row else now

    return CompanyResponse(
        id=payload.id,
        name=payload.name,
        legal_form=payload.legal_form,
        municipality_id=payload.municipality_id,
        municipality_name=None,
        district=payload.district,
        street_address=payload.street_address,
        postal_code=payload.postal_code,
        latitude=payload.latitude,
        longitude=payload.longitude,
        industry_sector=payload.industry_sector,
        wz_code=payload.wz_code,
        employee_range=payload.employee_range,
        turnover_estimated_range=payload.turnover_estimated_range,
        description=payload.description,
        website=payload.website,
        is_headquarters=payload.is_headquarters,
        source=payload.source,
        source_url=payload.source_url,
        created_at=created_at,
        updated_at=updated_at,
    )
