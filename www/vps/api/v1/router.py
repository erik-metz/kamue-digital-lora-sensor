from endpoints import archives, bikes, buses, map_sensors, mobility, sensors, telemetry, waste_trucks
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(sensors.router, tags=["Sensors Metadata"])
api_router.include_router(telemetry.router, tags=["Telemetry Data"])
api_router.include_router(archives.router)
api_router.include_router(map_sensors.router)
api_router.include_router(mobility.router)
api_router.include_router(waste_trucks.router)
api_router.include_router(buses.router)
api_router.include_router(bikes.router)



