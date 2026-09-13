from fastapi import APIRouter
from endpoints import sensors, telemetry

api_router = APIRouter()
api_router.include_router(sensors.router, tags=["Sensors Metadata"])
api_router.include_router(telemetry.router, tags=["Telemetry Data"])