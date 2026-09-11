import os
from fastapi import FastAPI
from api.v1.router import api_router as v1_router
from contextlib import asynccontextmanager
import psycopg_pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Build connection string from individual config values
    conninfo = (
        f"postgresql://{os.getenv('POSTGRES_USER',"postgres")}:{os.getenv('POSTGRES_PASSWORD',"")}"
        f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT',"5432")}/{os.getenv('POSTGRES_DB')}"
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
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    lifespan=lifespan
)

# Mount version 1 endpoints
app.include_router(v1_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}