from endpoints import archives, map_sensors, mobility, sensors, telemetry
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(sensors.router, tags=["Sensors Metadata"])
api_router.include_router(telemetry.router, tags=["Telemetry Data"])
api_router.include_router(archives.router)
api_router.include_router(map_sensors.router)
api_router.include_router(mobility.router)
