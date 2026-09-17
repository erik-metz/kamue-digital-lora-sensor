"""Normalization of river gauge and open weather data."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass
class NormalizedGauge:
    id: str
    name: str
    water_body: str
    level_m: float
    status: str
    source_station_id: str
    measured_at: datetime


@dataclass
class NormalizedWeather:
    sensor_id: str
    temperature: float | None
    humidity: float | None
    precipitation: float | None
    timestamp: datetime


def normalize(payload: dict[str, Any], settings) -> tuple[list[NormalizedGauge], list[NormalizedWeather]]:
    gauges: list[NormalizedGauge] = []
    weather_list: list[NormalizedWeather] = []

    # 1. Parse Pegelonline
    pegel = payload.get("pegel")
    if pegel and isinstance(pegel, dict):
        curr = pegel.get("currentMeasurement")
        if curr and "value" in curr:
            cm_val = float(curr["value"])
            m_val = round(cm_val / 100.0, 2)
            status = "normal"
            if m_val >= 6.50:
                status = "stage_3"
            elif m_val >= 5.50:
                status = "stage_2"
            elif m_val >= 4.50:
                status = "stage_1"

            gauges.append(
                NormalizedGauge(
                    id="pegel-rhein-worms",
                    name="Rheinpegel Worms (km 443.4)",
                    water_body="Rhein",
                    level_m=m_val,
                    status=status,
                    source_station_id=pegel.get("number", "WORMS"),
                    measured_at=datetime.now(UTC),
                )
            )

    # 2. Parse Weather
    weather = payload.get("weather")
    if weather and isinstance(weather, dict):
        current = weather.get("current")
        if current:
            weather_list.append(
                NormalizedWeather(
                    sensor_id="weather-dwd-ried",
                    temperature=current.get("temperature_2m"),
                    humidity=current.get("relative_humidity_2m"),
                    precipitation=current.get("precipitation"),
                    timestamp=datetime.now(UTC),
                )
            )

    return gauges, weather_list
