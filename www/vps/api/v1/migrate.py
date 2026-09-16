"""Apply the idempotent VPS schema before deploying collectors."""

import asyncio
import os
from pathlib import Path

import psycopg


async def migrate():
    async with await psycopg.AsyncConnection.connect(
        host=os.getenv("DB_HOST", "timescaledb"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "mydatabase"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=10,
    ) as conn:
        await conn.execute((Path(__file__).parent / "schema.sql").read_text())


if __name__ == "__main__":
    asyncio.run(migrate())
