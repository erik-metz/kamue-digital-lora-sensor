"""Election Results, Voter Turnout & Voting Districts (Stimmbezirke) endpoints.
Covers Municipal (Kommunalwahl), Mayoral (Bürgermeisterwahl), and European elections in the Ried.
"""

from datetime import date, datetime
from typing import Annotated, Any

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/elections", tags=["Elections & Voter Turnout"])

DbPool = Annotated[psycopg_pool.AsyncConnectionPool, Depends(get_db_pool)]


class ElectionEventResponse(BaseModel):
    id: str
    municipality: str
    election_type: str
    title: str
    election_date: date
    eligible_voters: int
    total_voters: int
    turnout_percent: float
    valid_votes: int
    invalid_votes: int
    seats_total: int | None = None
    results_summary: dict[str, Any]
    source: str | None = None
    source_url: str | None = None


class ElectionDistrictFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: dict[str, Any] | None = None
    properties: dict[str, Any]


class ElectionDistrictsGeoJSON(BaseModel):
    type: str = "FeatureCollection"
    election_id: str
    election_title: str
    municipality: str
    features: list[ElectionDistrictFeature]


@router.get("", response_model=list[ElectionEventResponse])
async def list_elections(
    pool: DbPool,
    municipality: str | None = Query(None, description="e.g. Bürstadt, Lampertheim, Biblis"),
    election_type: str | None = Query(None, description="e.g. kommunalwahl, buergermeister, europawahl"),
):
    query = """
        SELECT id, municipality, election_type, title, election_date, eligible_voters,
               total_voters, turnout_percent, valid_votes, invalid_votes, seats_total,
               results_summary, source, source_url
        FROM election_events
        WHERE 1=1
    """
    params: list[Any] = []
    if municipality:
        query += " AND LOWER(municipality) = LOWER(%s)"
        params.append(municipality)
    if election_type:
        query += " AND election_type = %s"
        params.append(election_type)

    query += " ORDER BY election_date DESC, municipality ASC"

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()
            return [
                ElectionEventResponse(
                    id=r[0],
                    municipality=r[1],
                    election_type=r[2],
                    title=r[3],
                    election_date=r[4],
                    eligible_voters=r[5],
                    total_voters=r[6],
                    turnout_percent=r[7],
                    valid_votes=r[8],
                    invalid_votes=r[9],
                    seats_total=r[10],
                    results_summary=r[11],
                    source=r[12],
                    source_url=r[13],
                )
                for r in rows
            ]


@router.get("/{election_id}", response_model=ElectionEventResponse)
async def get_election_detail(election_id: str, pool: DbPool):
    query = """
        SELECT id, municipality, election_type, title, election_date, eligible_voters,
               total_voters, turnout_percent, valid_votes, invalid_votes, seats_total,
               results_summary, source, source_url
        FROM election_events
        WHERE id = %s
    """
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, [election_id])
            r = await cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Election event not found")
            return ElectionEventResponse(
                id=r[0],
                municipality=r[1],
                election_type=r[2],
                title=r[3],
                election_date=r[4],
                eligible_voters=r[5],
                total_voters=r[6],
                turnout_percent=r[7],
                valid_votes=r[8],
                invalid_votes=r[9],
                seats_total=r[10],
                results_summary=r[11],
                source=r[12],
                source_url=r[13],
            )


@router.get("/{election_id}/districts", response_model=ElectionDistrictsGeoJSON)
async def get_election_districts(election_id: str, pool: DbPool):
    # Fetch election info
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id, title, municipality FROM election_events WHERE id = %s", [election_id])
            elec = await cur.fetchone()
            if not elec:
                raise HTTPException(status_code=404, detail="Election event not found")

            # Fetch districts with boundaries and results
            query = """
                SELECT ed.id, ed.district_number, ed.name, ed.polling_station_name,
                       ed.polling_station_address, ed.center_lat, ed.center_lng, ed.boundaries,
                       edr.eligible_voters, edr.total_voters, edr.turnout_percent,
                       edr.valid_votes, edr.invalid_votes, edr.party_results, edr.winning_party
                FROM election_districts ed
                LEFT JOIN election_district_results edr
                       ON edr.district_id = ed.id AND edr.election_id = %s
                WHERE LOWER(ed.municipality) = LOWER(%s)
                ORDER BY ed.district_number ASC
            """
            await cur.execute(query, [election_id, elec[2]])
            rows = await cur.fetchall()

            features: list[ElectionDistrictFeature] = []
            for r in rows:
                geom = r[7] if r[7] else {
                    "type": "Point",
                    "coordinates": [r[6], r[5]],
                }
                props = {
                    "district_id": r[0],
                    "district_number": r[1],
                    "name": r[2],
                    "polling_station_name": r[3],
                    "polling_station_address": r[4],
                    "center_lat": r[5],
                    "center_lng": r[6],
                    "eligible_voters": r[8],
                    "total_voters": r[9],
                    "turnout_percent": r[10],
                    "valid_votes": r[11],
                    "invalid_votes": r[12],
                    "party_results": r[13] or {},
                    "winning_party": r[14],
                }
                features.append(ElectionDistrictFeature(
                    id=r[0],
                    geometry=geom,
                    properties=props,
                ))

            return ElectionDistrictsGeoJSON(
                election_id=elec[0],
                election_title=elec[1],
                municipality=elec[2],
                features=features,
            )
