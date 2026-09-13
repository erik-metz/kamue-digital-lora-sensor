from datetime import datetime

import psycopg_pool
from dependencies import get_db_pool
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter()


class ArchiveFile(BaseModel):
    filename: str
    url: str
    size_bytes: int
    reading_count: int
    sha256: str


class Archive(BaseModel):
    month: str
    generated_at: datetime
    is_complete: bool
    reading_count: int
    size_bytes: int
    files: list[ArchiveFile]


@router.get(
    "/archives",
    tags=["Archives Public"],
    summary="List public monthly data downloads",
    response_model=list[Archive],
)
async def list_archives(pool: psycopg_pool.AsyncConnectionPool = Depends(get_db_pool)):
    """Monthly ZIP parts without the interactive API row limit. Download every
    part of a month for its full snapshot; late data may require a new version.
    Snapshots containing stations which became private are not listed.
    """
    async with pool.connection() as conn:
        cur = await conn.execute("""
            SELECT month, generated_at, is_complete, reading_count, size_bytes, files
            FROM data_archives a
            WHERE NOT EXISTS (
                SELECT 1 FROM unnest(a.station_ids) AS included(station_id)
                WHERE NOT EXISTS (SELECT 1 FROM sensor_metadata s
                    WHERE s.id = included.station_id AND NOT s.is_hidden)
            )
            ORDER BY month DESC;
        """)
        rows = await cur.fetchall()
    return [
        {
            **{key: row[key] for key in ("month", "generated_at", "is_complete", "reading_count", "size_bytes")},
            "files": [
                {key: file[key] for key in ("filename", "url", "size_bytes", "reading_count", "sha256")}
                for file in row["files"]
            ],
        }
        for row in rows
    ]
