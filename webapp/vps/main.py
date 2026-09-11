from fastapi import FastAPI
from api.v1.router import api_router as v1_router

app = FastAPI(
    title="Open-Ried-Sens Telemetry API",
    openapi_url="/api/v1/openapi.json", # Clean Swagger docs location
    docs_url="/docs"
)

# Mount version 1 endpoints
app.include_router(v1_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}