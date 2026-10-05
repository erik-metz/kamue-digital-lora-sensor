from endpoints import (
    archives,
    bikes,
    buses,
    collected,
    data_exports,
    map_sensors,
    satellite,
    sensors,
    social_daily_life,
    street_closures,
    telemetry,
    traffic,
    waste_trucks,
)
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(collected.router)
api_router.include_router(satellite.router)
api_router.include_router(sensors.router, tags=["Sensors Metadata"])
api_router.include_router(telemetry.router, tags=["Telemetry Data"])
api_router.include_router(archives.router)
api_router.include_router(data_exports.router)
api_router.include_router(map_sensors.router)
api_router.include_router(waste_trucks.router)
api_router.include_router(buses.router)
api_router.include_router(bikes.router)
api_router.include_router(traffic.router)
api_router.include_router(street_closures.router)
api_router.include_router(social_daily_life.router)
api_router.include_router(social_daily_life.router, prefix="/v1")
api_router.include_router(collected.legacy_router)
