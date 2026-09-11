from datetime import datetime
from pydantic import BaseModel, Field

class SensorMetadataCreate(BaseModel):
    sensor_id: str = Field(..., json_schema_extra={"example": "temp-sensor-01"})
    friendly_name: str = Field(..., json_schema_extra={"example": "North Field Sensor"})
    latitude: float | None = Field(None, json_schema_extra={"example": 52.5200})
    longitude: float | None = Field(None, json_schema_extra={"example": 13.4050})

class SensorMetadataResponse(SensorMetadataCreate):
    created_at: datetime

class SensorReading(BaseModel):
    sensor_id: str = Field(..., json_schema_extra={"example": "temp-sensor-01"})
    value: float = Field(..., json_schema_extra={"example": 24.5})
    unit: str = Field(..., json_schema_extra={"example": "celsius"})
    timestamp: datetime | None = None

class BatchSensorReadings(BaseModel):
    readings: list[SensorReading]

class SensorAggregateResponse(BaseModel):
    bucket: datetime
    avg_value: float | None
    min_value: float | None
    max_value: float | None
    sample_count: int
    unit: str