import bz2
import io
import math
import struct
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
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


@dataclass
class NormalizedRadar:
    sensor_id: str
    precipitation_mm: float
    timestamp: datetime
    latitude: float
    longitude: float


@dataclass
class NormalizedForecast:
    station_id: str
    timestamp: datetime
    temperature_c: float | None = None
    dew_point_c: float | None = None
    wind_speed_ms: float | None = None
    precipitation_prob: float | None = None
    precipitation_mm: float | None = None


class NormalizedEnvironment(tuple):
    """Backwards-compatible tuple that unpacks as (gauges, weather_list)
    while also exposing .radar and .forecasts."""

    def __new__(cls, gauges, weather_list, radar=None, forecasts=None):
        return super().__new__(cls, (gauges, weather_list))

    def __init__(self, gauges, weather_list, radar=None, forecasts=None):
        self.gauges = gauges
        self.weather_list = weather_list
        self.radar: list[NormalizedRadar] = radar or []
        self.forecasts: list[NormalizedForecast] = forecasts or []


def parse_radolan_rw(raw_bytes: bytes, target_lat: float, target_lon: float) -> NormalizedRadar | None:
    """Parse DWD RADOLAN RW binary composite (optionally bz2-compressed)."""
    if not raw_bytes:
        return None
    if raw_bytes[:3] == b"BZh":
        try:
            data = bz2.decompress(raw_bytes)
        except (bz2.BZ2Error, OSError, ValueError):
            return None
    else:
        data = raw_bytes

    etx_idx = data.find(b"\x03")
    if etx_idx == -1:
        return None

    header_str = data[:etx_idx].decode("latin1", errors="ignore")
    now_utc = datetime.now(UTC)
    try:
        day = int(header_str[2:4])
        hour = int(header_str[4:6])
        minute = int(header_str[6:8])
        month = int(header_str[13:15]) if len(header_str) > 16 and header_str[13:15].isdigit() else now_utc.month
        year = 2000 + int(header_str[15:17]) if len(header_str) > 16 and header_str[15:17].isdigit() else now_utc.year
        dt = datetime(year, month, day, hour, minute, tzinfo=UTC)
    except (ValueError, IndexError):
        dt = now_utc

    # DWD polar stereographic projection (standard 900x900 national grid)
    phi_0 = math.radians(60.0)
    lambda_0 = math.radians(10.0)
    phi = math.radians(target_lat)
    lam = math.radians(target_lon)
    m = (1.0 + math.sin(phi_0)) / (1.0 + math.sin(phi))
    x = 6370.04 * m * math.cos(phi) * math.sin(lam - lambda_0)
    y = -6370.04 * m * math.cos(phi) * math.cos(lam - lambda_0)

    # South-West origin offsets for national 900x900 grid
    col = round(x - (-523.4622))
    row = round(y - (-4658.6447))

    if not (0 <= col < 900 and 0 <= row < 900):
        return None

    # Binary values are 16-bit unsigned ints (little endian), row 0 is at south
    binary_start = etx_idx + 1
    offset = binary_start + (row * 900 + col) * 2
    if offset + 2 > len(data):
        return None

    raw_val = struct.unpack("<H", data[offset : offset + 2])[0]
    if raw_val >= 2500 or (raw_val & 0x1000):
        precip_mm = 0.0
    else:
        precip_mm = round(raw_val * 0.1, 2)

    return NormalizedRadar(
        sensor_id="weather-radolan-ried",
        precipitation_mm=precip_mm,
        timestamp=dt,
        latitude=target_lat,
        longitude=target_lon,
    )


def parse_mosmix(raw_bytes: bytes, station_id: str = "10729") -> list[NormalizedForecast]:
    """Parse DWD MOSMIX point forecasts from KMZ/KML."""
    if not raw_bytes:
        return []
    if raw_bytes[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                names = [n for n in z.namelist() if n.endswith(".kml")]
                if not names:
                    return []
                kml_bytes = z.read(names[0])
        except (zipfile.BadZipFile, OSError, ValueError):
            return []
    else:
        kml_bytes = raw_bytes

    try:
        root = ET.fromstring(kml_bytes)
    except (ET.ParseError, ValueError):
        return []

    timesteps_raw = [elem.text.strip() for elem in root.findall(".//{*}TimeStep") if elem.text]
    if not timesteps_raw:
        return []

    elements: dict[str, list[str]] = {}
    for fc in root.findall(".//{*}Forecast"):
        name = fc.get("{https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd}elementName") or fc.get("elementName")
        val_node = fc.find("{*}value")
        if name and val_node is not None and val_node.text:
            elements[name] = val_node.text.strip().split()

    forecasts: list[NormalizedForecast] = []
    # Capture up to 24 hourly steps
    count = min(len(timesteps_raw), 24)
    for i in range(count):
        ts_str = timesteps_raw[i]
        try:
            ts = datetime.fromisoformat(ts_str)
        except (ValueError, IndexError):
            continue

        temp_c = None
        if "TTT" in elements and i < len(elements["TTT"]):
            val_str = elements["TTT"][i]
            if val_str not in ("-", "nil"):
                try:
                    temp_c = round(float(val_str) - 273.15, 1)
                except ValueError:
                    pass

        dew_c = None
        if "Td" in elements and i < len(elements["Td"]):
            val_str = elements["Td"][i]
            if val_str not in ("-", "nil"):
                try:
                    dew_c = round(float(val_str) - 273.15, 1)
                except ValueError:
                    pass

        wind_ms = None
        if "FF" in elements and i < len(elements["FF"]):
            val_str = elements["FF"][i]
            if val_str not in ("-", "nil"):
                try:
                    wind_ms = round(float(val_str), 1)
                except ValueError:
                    pass

        prob = None
        if "R101" in elements and i < len(elements["R101"]):
            val_str = elements["R101"][i]
            if val_str not in ("-", "nil"):
                try:
                    prob = round(float(val_str), 1)
                except ValueError:
                    pass

        precip_mm = None
        if "RR1c" in elements and i < len(elements["RR1c"]):
            val_str = elements["RR1c"][i]
            if val_str not in ("-", "nil"):
                try:
                    precip_mm = max(0.0, round(float(val_str), 1))
                except ValueError:
                    pass

        forecasts.append(
            NormalizedForecast(
                station_id=f"dwd-mosmix-{station_id}",
                timestamp=ts,
                temperature_c=temp_c,
                dew_point_c=dew_c,
                wind_speed_ms=wind_ms,
                precipitation_prob=prob,
                precipitation_mm=precip_mm,
            )
        )
    return forecasts


def normalize(payload: dict[str, Any], settings) -> NormalizedEnvironment:
    gauges: list[NormalizedGauge] = []
    weather_list: list[NormalizedWeather] = []
    radar_list: list[NormalizedRadar] = []
    forecast_list: list[NormalizedForecast] = []

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
            status = "unknown"

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

    # 3. Parse DWD RADOLAN
    radolan_raw = payload.get("radolan")
    if radolan_raw and isinstance(radolan_raw, (bytes, bytearray)):
        target_lat = getattr(settings, "ried_lat", 49.6425)
        target_lon = getattr(settings, "ried_lon", 8.4552)
        radar_point = parse_radolan_rw(bytes(radolan_raw), target_lat, target_lon)
        if radar_point:
            radar_list.append(radar_point)

    # 4. Parse DWD MOSMIX
    mosmix_raw = payload.get("mosmix")
    if mosmix_raw and isinstance(mosmix_raw, (bytes, bytearray)):
        forecast_list = parse_mosmix(bytes(mosmix_raw), station_id="10729")

    return NormalizedEnvironment(gauges, weather_list, radar_list, forecast_list)

