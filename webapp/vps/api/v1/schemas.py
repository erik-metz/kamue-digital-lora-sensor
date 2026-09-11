from datetime import datetime
from pydantic import BaseModel, Field

class SensorMetadataCreate(BaseModel):
    sensor_id: str = Field(..., min_length=1, max_length=64, json_schema_extra={"example": "ried-01"})
    friendly_name: str = Field(..., min_length=1, max_length=255, json_schema_extra={"example": "Station 1: Bürstadt Mitte"})
    latitude: float | None = Field(None, ge=-90.0, le=90.0, json_schema_extra={"example": 49.6425})
    longitude: float | None = Field(None, ge=-180.0, le=180.0, json_schema_extra={"example": 8.4560})
    is_hidden: bool = Field(default=False, description="When true, sensor is hidden from public endpoints")
    description: str | None = Field(default=None, max_length=1000, json_schema_extra={"example": "KAMÜ Kulturzentrum Industriestr. 11"})

class SensorMetadataUpdate(BaseModel):
    friendly_name: str | None = Field(None, min_length=1, max_length=255)
    latitude: float | None = Field(None, ge=-90.0, le=90.0)
    longitude: float | None = Field(None, ge=-180.0, le=180.0)
    is_hidden: bool | None = Field(None, description="Toggle visibility in public feeds")
    description: str | None = Field(None, max_length=1000)

class SensorVisibilityUpdate(BaseModel):
    is_hidden: bool = Field(..., description="Set to true to hide, or false to publish")

class SensorMetadataResponse(SensorMetadataCreate):
    created_at: datetime
    updated_at: datetime | None = None

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