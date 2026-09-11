from fastapi import FastAPI
from api.v1.router import api_router as v1_router
from contextlib import asynccontextmanager
import psycopg_pool
from core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Build connection string from individual config values
    conninfo = (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    
    # Initialize connection pool on startup
    app.state.pool = psycopg_pool.AsyncConnectionPool(
        conninfo=conninfo,
        open=False
    )
    await app.state.pool.open()
    
    yield
    
    # Close connection pool on shutdown
    await app.state.pool.close()

app = FastAPI(
    title="Open-Ried-Sens Telemetry API",
    openapi_url="/api/v1/openapi.json", # Clean Swagger docs location
    docs_url="/docs"
    lifespan=lifespan
)

# Mount version 1 endpoints
app.include_router(v1_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}