import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote_plus
from fastapi import FastAPI
import psycopg
import psycopg_pool
from psycopg.rows import dict_row
from api.v1.router import api_router as v1_router

import logging

logger = logging.getLogger(__name__)

SCHEMA_FILE = Path(__file__).parent / "schema.sql"
SCHEMA_SQL = SCHEMA_FILE.read_text(encoding="utf-8") if SCHEMA_FILE.exists() else ""


async def init_db(pool: psycopg_pool.AsyncConnectionPool) -> None:
    """Initializes the database schema if schema.sql is available."""
    if SCHEMA_SQL:
        try:
            async with pool.connection() as conn:
                await conn.execute(SCHEMA_SQL)
            logger.info("Database schema initialized successfully.")
        except (psycopg.Error, OSError) as e:
            logger.error("Failed to initialize database schema: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "timescaledb")
    port = os.getenv("DB_PORT", "5432")
    db = os.getenv("DB_NAME", "")

    conninfo = f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{db}"

    app.state.pool = psycopg_pool.AsyncConnectionPool(
        conninfo=conninfo,
        open=False,
        kwargs={"row_factory": dict_row},
    )
    await app.state.pool.open()

    await init_db(app.state.pool)

    yield

    await app.state.pool.close()


app = FastAPI(
    title="Open-Ried-Sens Telemetry API",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}