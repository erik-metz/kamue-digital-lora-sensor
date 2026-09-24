"""Normalization of river gauge and open weather data."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo


@dataclass
class NormalizedGauge:
    id: str
    name: str
    water_body: str
    level_m: float
    status: str
    source_station_id: str
    measured_at: datetime
    latitude: float | None = None
    longitude: float | None = None


@dataclass
class NormalizedWeather:
    sensor_id: str
    temperature: float | None
    humidity: float | None
    precipitation: float | None
    timestamp: datetime
    latitude: float | None = None
    longitude: float | None = None


def normalize(
    payload: dict[str, Any], settings
) -> tuple[list[NormalizedGauge], list[NormalizedWeather]]:
    gauges: list[NormalizedGauge] = []
    weather_list: list[NormalizedWeather] = []

    # 1. Parse Pegelonline
    pegel = payload.get("pegel")
    if pegel and isinstance(pegel, dict):
        series = next(
            (t for t in pegel.get("timeseries", []) if t.get("shortname") == "W"), pegel
        )
        curr = series.get("currentMeasurement")
        if curr and "value" in curr:
            cm_val = float(curr["value"])
            m_val = round(cm_val / 100.0, 2)
            status = "unknown"  # Alarm thresholds require a separately collected official source.

            gauges.append(
                NormalizedGauge(
                    id="pegel-rhein-worms",
                    name=pegel.get("longname", "WORMS"),
                    water_body=pegel.get("water", {}).get("longname", ""),
                    level_m=m_val,
                    status=status,
                    source_station_id=pegel.get("number", "WORMS"),
                    measured_at=datetime.fromisoformat(curr["timestamp"]),
                    latitude=pegel.get("latitude"),
                    longitude=pegel.get("longitude"),
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
                    latitude=weather.get("latitude"),
                    longitude=weather.get("longitude"),
                    temperature=current.get("temperature_2m"),
                    humidity=current.get("relative_humidity_2m"),
                    precipitation=current.get("precipitation"),
                    timestamp=datetime.fromisoformat(current["time"]).replace(
                        tzinfo=ZoneInfo(weather.get("timezone", "UTC"))
                    ),
                )
            )

    return gauges, weather_list
