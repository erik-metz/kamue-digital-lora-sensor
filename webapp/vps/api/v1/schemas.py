from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# --- SENSOR METADATA SCHEMAS ---

class SensorMetadataCreate(BaseModel):
    sensor_id: str = Field(..., example="temp-sensor-01", description="Unique identifier for the sensor")
    friendly_name: str = Field(..., example="North Field Temperature Sensor")
    latitude: Optional[float] = Field(None, example=52.5200)
    longitude: Optional[float] = Field(None, example=13.4050)

class SensorMetadataResponse(SensorMetadataCreate):
    created_at: datetime


# --- TELEMETRY SCHEMAS ---

class SensorReading(BaseModel):
    sensor_id: str = Field(..., example="temp-sensor-01")
    value: float = Field(..., example=24.5)
    unit: str = Field(..., example="celsius")
    timestamp: Optional[datetime] = Field(None, description="Defaults to current UTC time if omitted")

class BatchSensorReadings(BaseModel):
    readings: List[SensorReading]

class SensorAggregateResponse(BaseModel):
    bucket: datetime
    avg_value: Optional[float]
    min_value: Optional[float]
    max_value: Optional[float]
    sample_count: int
    unit: str