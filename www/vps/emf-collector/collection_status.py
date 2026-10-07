"""Durable cycle evidence. Error text excludes credential-bearing URLs."""

import httpx
import psycopg


async def start(settings, source_id):
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        row = await (
            await conn.execute(
                "INSERT INTO collection_attempts(source_id,status) VALUES (%s,'running') RETURNING id",
                (source_id,),
            )
        ).fetchone()
    return row[0]


async def received(settings, attempt_id):
    if attempt_id is None:
        return
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        await conn.execute(
            "UPDATE collection_attempts SET status='received',fetched_at=clock_timestamp() WHERE id=%s",
            (attempt_id,),
        )


async def finish(
    settings, attempt_id, count, unit, *, partial_error=None, error_stage="processing"
):
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        await conn.execute(
            """UPDATE collection_attempts SET status=%s,item_count=%s,item_count_unit=%s,
            error=%s,error_stage=%s WHERE id=%s""",
            (
                "partial" if partial_error else "success",
                count,
                unit,
                partial_error,
                error_stage if partial_error else None,
                attempt_id,
            ),
        )


async def fail(settings, attempt_id, exc):
    stage = (
        "acquisition"
        if isinstance(exc, httpx.HTTPError)
        else "storage"
        if isinstance(exc, psycopg.Error)
        else "processing"
    )
    http_status = (
        exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
    )
    async with await psycopg.AsyncConnection.connect(**settings.db) as conn:
        await conn.execute(
            """UPDATE collection_attempts SET status='failed',error=%s,error_stage=%s,
            http_status=%s WHERE id=%s""",
            (type(exc).__name__, stage, http_status, attempt_id),
        )
