"""Public Finance, Municipal Budgets, Tax Revenues & Product Area Spending endpoints.
Covers Bürstadt, Lampertheim, Biblis, and Groß-Rohrheim.
"""

from datetime import datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

router = APIRouter(prefix="/finance", tags=["Public Finance & Budgets"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class FinanceBudgetResponse(BaseModel):
    id: str
    municipality: str
    fiscal_year: int
    record_type: str
    total_revenue_eur: float
    total_expense_eur: float
    net_result_eur: float
    tax_gewerbesteuer_eur: float | None = None
    tax_grundsteuer_a_eur: float | None = None
    tax_grundsteuer_b_eur: float | None = None
    tax_income_share_eur: float | None = None
    tax_vat_share_eur: float | None = None
    hebesatz_gewerbesteuer: int | None = None
    hebesatz_grundsteuer_a: int | None = None
    hebesatz_grundsteuer_b: int | None = None
    total_debt_eur: float | None = None
    debt_per_capita_eur: float | None = None
    reserves_eur: float | None = None
    source_document_url: str | None = None
    updated_at: datetime


class FinanceExpenditureResponse(BaseModel):
    id: int
    budget_id: str
    municipality: str
    fiscal_year: int
    product_area_code: str
    category_name: str
    title: str
    expense_budgeted_eur: float
    expense_actual_eur: float | None = None
    investments_eur: float
    notes: str | None = None


class MunicipalFinanceComparison(BaseModel):
    municipality: str
    fiscal_year: int
    total_revenue_eur: float
    total_expense_eur: float
    net_result_eur: float
    tax_gewerbesteuer_eur: float | None = None
    tax_grundsteuer_b_eur: float | None = None
    hebesatz_gewerbesteuer: int | None = None
    hebesatz_grundsteuer_b: int | None = None
    total_debt_eur: float | None = None
    debt_per_capita_eur: float | None = None
    reserves_eur: float | None = None


@router.get("/budgets", response_model=list[FinanceBudgetResponse])
async def get_budgets(
    pool: DbPool,
    municipality: str | None = Query(None, description="e.g. Bürstadt, Lampertheim"),
    year: int | None = Query(None, description="Fiscal year e.g. 2024, 2025"),
    record_type: str | None = Query(None, description="'plan' or 'actual'"),
):
    query = """
        SELECT id, municipality, fiscal_year, record_type, total_revenue_eur, total_expense_eur,
               net_result_eur, tax_gewerbesteuer_eur, tax_grundsteuer_a_eur, tax_grundsteuer_b_eur,
               tax_income_share_eur, tax_vat_share_eur, hebesatz_gewerbesteuer, hebesatz_grundsteuer_a,
               hebesatz_grundsteuer_b, total_debt_eur, debt_per_capita_eur, reserves_eur,
               source_document_url, updated_at
        FROM finance_budgets
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND LOWER(municipality) = LOWER(%s)"
        params.append(municipality)
    if year:
        query += " AND fiscal_year = %s"
        params.append(year)
    if record_type:
        query += " AND record_type = %s"
        params.append(record_type)

    query += " ORDER BY fiscal_year DESC, municipality ASC"

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()
            return [
                FinanceBudgetResponse(
                    id=r[0],
                    municipality=r[1],
                    fiscal_year=r[2],
                    record_type=r[3],
                    total_revenue_eur=r[4],
                    total_expense_eur=r[5],
                    net_result_eur=r[6],
                    tax_gewerbesteuer_eur=r[7],
                    tax_grundsteuer_a_eur=r[8],
                    tax_grundsteuer_b_eur=r[9],
                    tax_income_share_eur=r[10],
                    tax_vat_share_eur=r[11],
                    hebesatz_gewerbesteuer=r[12],
                    hebesatz_grundsteuer_a=r[13],
                    hebesatz_grundsteuer_b=r[14],
                    total_debt_eur=r[15],
                    debt_per_capita_eur=r[16],
                    reserves_eur=r[17],
                    source_document_url=r[18],
                    updated_at=r[19],
                )
                for r in rows
            ]


@router.get("/spending", response_model=list[FinanceExpenditureResponse])
async def get_spending(
    pool: DbPool,
    municipality: str | None = Query(None, description="e.g. Bürstadt, Lampertheim"),
    year: int | None = Query(None, description="Fiscal year e.g. 2024"),
    category: str | None = Query(None, description="e.g. schools, roads_transport, culture_sport, social_childcare"),
):
    query = """
        SELECT id, budget_id, municipality, fiscal_year, product_area_code, category_name,
               title, expense_budgeted_eur, expense_actual_eur, investments_eur, notes
        FROM finance_expenditures
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND LOWER(municipality) = LOWER(%s)"
        params.append(municipality)
    if year:
        query += " AND fiscal_year = %s"
        params.append(year)
    if category:
        query += " AND category_name = %s"
        params.append(category)

    query += " ORDER BY product_area_code ASC"

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()
            return [
                FinanceExpenditureResponse(
                    id=r[0],
                    budget_id=r[1],
                    municipality=r[2],
                    fiscal_year=r[3],
                    product_area_code=r[4],
                    category_name=r[5],
                    title=r[6],
                    expense_budgeted_eur=r[7],
                    expense_actual_eur=r[8],
                    investments_eur=r[9],
                    notes=r[10],
                )
                for r in rows
            ]


@router.get("/compare", response_model=list[MunicipalFinanceComparison])
async def compare_finances(
    pool: DbPool,
    year: int = Query(2024, description="Fiscal year to compare"),
    record_type: str = Query("plan", description="'plan' or 'actual'"),
):
    query = """
        SELECT municipality, fiscal_year, total_revenue_eur, total_expense_eur, net_result_eur,
               tax_gewerbesteuer_eur, tax_grundsteuer_b_eur, hebesatz_gewerbesteuer,
               hebesatz_grundsteuer_b, total_debt_eur, debt_per_capita_eur, reserves_eur
        FROM finance_budgets
        WHERE fiscal_year = %s AND record_type = %s
        ORDER BY total_revenue_eur DESC
    """
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, [year, record_type])
            rows = await cur.fetchall()
            return [
                MunicipalFinanceComparison(
                    municipality=r[0],
                    fiscal_year=r[1],
                    total_revenue_eur=r[2],
                    total_expense_eur=r[3],
                    net_result_eur=r[4],
                    tax_gewerbesteuer_eur=r[5],
                    tax_grundsteuer_b_eur=r[6],
                    hebesatz_gewerbesteuer=r[7],
                    hebesatz_grundsteuer_b=r[8],
                    total_debt_eur=r[9],
                    debt_per_capita_eur=r[10],
                    reserves_eur=r[11],
                )
                for r in rows
            ]
