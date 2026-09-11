import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import psycopg_pool
from api.v1.router import api_router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "timescaledb")
    port = os.getenv("DB_PORT", "5432")
    db = os.getenv("DB_NAME")

    conninfo = f"postgresql://{user}:{password}@{host}:{port}/{db}"

    app.state.pool = psycopg_pool.AsyncConnectionPool(
        conninfo=conninfo, open=False
    )
    await app.state.pool.open()

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