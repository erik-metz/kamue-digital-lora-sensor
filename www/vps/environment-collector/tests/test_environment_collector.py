"""Tests for EnvironmentCollector normalization and healthcheck."""

import unittest

from config import Settings
from normalize import normalize


class TestEnvironmentCollector(unittest.TestCase):
    def test_normalize_pegel_and_weather(self):
        settings = Settings(db={})
        sample_payload = {
            "pegel": {
                "number": "WORMS",
                "shortname": "WORMS",
                "currentMeasurement": {"timestamp":"2026-09-22T10:00:00+02:00", "value": 284, "stateMnwMhw": "normal"},
            },
            "weather": {
                "current": {
                    "time":"2026-09-22T08:00", "temperature_2m": 18.5,
                    "relative_humidity_2m": 65,
                    "precipitation": 0.0,
                }
            },
        }
        gauges, weather_list = normalize(sample_payload, settings)
        self.assertEqual(len(gauges), 1)
        self.assertEqual(gauges[0].id, "pegel-rhein-worms")
        self.assertEqual(gauges[0].level_m, 2.84)
        self.assertEqual(gauges[0].status, "unknown")

        self.assertEqual(len(weather_list), 1)
        self.assertEqual(weather_list[0].sensor_id, "weather-dwd-ried")
        self.assertEqual(weather_list[0].temperature, 18.5)
        self.assertEqual(gauges[0].measured_at.isoformat(), "2026-09-22T10:00:00+02:00")
        self.assertEqual(weather_list[0].timestamp.isoformat(), "2026-09-22T08:00:00+00:00")

    def test_normalize_pegel_high_stage(self):
        settings = Settings(db={})
        sample_payload = {
            "pegel": {
                "number": "WORMS",
                "currentMeasurement": {"timestamp":"2026-09-22T10:00:00+02:00", "value": 560},
            }
        }
        gauges, _ = normalize(sample_payload, settings)
        self.assertEqual(len(gauges), 1)
        self.assertEqual(gauges[0].level_m, 5.60)
        self.assertEqual(gauges[0].status, "unknown")


    def test_normalize_radolan(self):
        settings = Settings(db={}, ried_lat=49.6425, ried_lon=8.4552)
        # Synthetic 900x900 grid
        # Col 406, Row 292 for Bürstadt
        col = 406
        row = 292
        header = b"RW020650100001026BY1620153VS 3SW   2.29.1PR E-01INT  60GP 900x 900\x03"
        grid_bytes = bytearray(900 * 900 * 2)
        offset = (row * 900 + col) * 2
        # Write 25 (2.5 mm) in little endian
        grid_bytes[offset] = 25
        grid_bytes[offset + 1] = 0
        raw_payload = header + bytes(grid_bytes)

        res = normalize({"radolan": raw_payload}, settings)
        self.assertEqual(len(res.radar), 1)
        self.assertEqual(res.radar[0].sensor_id, "weather-radolan-ried")
        self.assertEqual(res.radar[0].precipitation_mm, 2.5)

    def test_normalize_mosmix(self):
        settings = Settings(db={})
        kml = b"""<?xml version="1.0" encoding="ISO-8859-1"?>
<kml:kml xmlns:dwd="https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd" xmlns:kml="http://www.opengis.net/kml/2.2">
  <kml:Document>
    <kml:ExtendedData>
      <dwd:ProductDefinition>
        <dwd:ForecastTimeSteps>
          <dwd:TimeStep>2026-10-02T10:00:00.000Z</dwd:TimeStep>
        </dwd:ForecastTimeSteps>
      </dwd:ProductDefinition>
    </kml:ExtendedData>
    <kml:Placemark>
      <kml:ExtendedData>
        <dwd:Forecast dwd:elementName="TTT">
          <dwd:value>288.15</dwd:value>
        </dwd:Forecast>
        <dwd:Forecast dwd:elementName="Td">
          <dwd:value>283.15</dwd:value>
        </dwd:Forecast>
        <dwd:Forecast dwd:elementName="FF">
          <dwd:value>3.5</dwd:value>
        </dwd:Forecast>
        <dwd:Forecast dwd:elementName="R101">
          <dwd:value>15.0</dwd:value>
        </dwd:Forecast>
        <dwd:Forecast dwd:elementName="RR1c">
          <dwd:value>0.4</dwd:value>
        </dwd:Forecast>
      </kml:ExtendedData>
    </kml:Placemark>
  </kml:Document>
</kml:kml>"""
        res = normalize({"mosmix": kml}, settings)
        self.assertEqual(len(res.forecasts), 1)
        fc = res.forecasts[0]
        self.assertEqual(fc.station_id, "dwd-mosmix-10729")
        self.assertEqual(fc.temperature_c, 15.0)
        self.assertEqual(fc.dew_point_c, 10.0)
        self.assertEqual(fc.wind_speed_ms, 3.5)
        self.assertEqual(fc.precipitation_prob, 15.0)
        self.assertEqual(fc.precipitation_mm, 0.4)

    def test_normalize_blitzortung_empty(self):
        settings = Settings(db={})
        res = normalize({"blitzortung": ""}, settings)
        self.assertIsNotNone(res.lightning)
        self.assertEqual(res.lightning.zone_id, "lightning-zone-ried-25km")
        self.assertEqual(res.lightning.strikes_count, 0)
        self.assertIsNone(res.lightning.distance_min_km)
        self.assertIsNone(res.lightning.peak_current_max_ka)

    def test_normalize_blitzortung_json_lines(self):
        settings = Settings(db={}, ried_lat=49.6425, ried_lon=8.4552)
        # Line 1: Bürstadt center (approx 0.1 km)
        # Line 2: Worms Rheinbrücke (approx 7 km)
        # Line 3: Frankfurt North (approx 60 km - should be filtered out)
        lines = (
            '{"time": 1727860000000000000, "lat": 49.6420, "lon": 8.4550, "mcg": 42.5}\n'
            '{"time": 1727860010000000000, "lat": 49.6300, "lon": 8.3600, "mcg": 18.2}\n'
            '{"time": 1727860020000000000, "lat": 50.3000, "lon": 8.6000, "mcg": 85.0}\n'
        )
        res = normalize({"blitzortung": lines}, settings)
        self.assertIsNotNone(res.lightning)
        self.assertEqual(res.lightning.strikes_count, 2)
        self.assertLess(res.lightning.distance_min_km, 1.0)
        self.assertEqual(res.lightning.peak_current_max_ka, 42.5)

    def test_normalize_blitzortung_json_list(self):
        settings = Settings(db={}, ried_lat=49.6425, ried_lon=8.4552)
        json_data = [
            {"time": 1727860000, "lat": 49.6000, "lon": 8.5000, "current": 25.0},
        ]
        res = normalize({"blitzortung": json_data}, settings)
        self.assertIsNotNone(res.lightning)
        self.assertEqual(res.lightning.strikes_count, 1)
        self.assertAlmostEqual(res.lightning.distance_min_km, 5.7, delta=1.5)
        self.assertEqual(res.lightning.peak_current_max_ka, 25.0)


if __name__ == "__main__":
    unittest.main()

