import copy
import json
import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from normalize import normalize, query_tabs, sensor_id

NOW = datetime(2026, 9, 14, 7, tzinfo=UTC)
URL = "https://dashboard-service.smartcity-system.de/dashboards/overview"


def fixture():
    return json.loads((Path(__file__).parent / "fixtures/overview.json").read_text())


def dashboard(entity=None, unit="°C"):
    if entity is None:
        entity = {
            "id": "urn:ngsi-ld:WeatherObserved:test",
            "type": "WeatherObserved",
            "temperature": {
                "type": "Property",
                "value": 12,
                "observedAt": NOW.isoformat(),
            },
        }
    return {
        "panels": [
            {
                "widgets": [
                    {
                        "tabs": [
                            {
                                "chartUnit": unit,
                                "query": {
                                    "id": "test-query",
                                    "updatedAt": NOW.isoformat(),
                                    "queryData": [entity],
                                },
                            }
                        ]
                    }
                ]
            }
        ]
    }


class NormalizerTests(unittest.TestCase):
    def test_public_nested_fixture(self):
        result = normalize(fixture(), "buerstadt", URL, NOW)
        readings = result.observations
        temperature = next(r for r in readings if r.metric == "temperature")
        self.assertEqual((temperature.value, temperature.unit), (16.28, "°C"))
        self.assertEqual(
            (temperature.latitude, temperature.longitude), (49.6563801, 8.4092654)
        )
        self.assertEqual(
            temperature.observed_at.isoformat(), "2026-09-14T06:01:24.488000+00:00"
        )
        self.assertTrue(
            any(r.metric == "parking_capacity" and r.value == 32 for r in readings)
        )
        self.assertTrue(
            any(r.metric == "water_level_delta" and r.unit == "m" for r in readings)
        )
        self.assertTrue(
            any(r.metric == "water_surface_distance" and r.value == 0 for r in readings)
        )
        self.assertEqual(result.skipped["unsupported_entity_type"], 1)
        self.assertGreater(result.skipped["unmapped_attribute:NO2"], 0)

    def test_duplicate_widgets_do_not_duplicate_observations(self):
        payload = dashboard()
        widgets = payload["panels"][0]["widgets"]
        widgets.append(copy.deepcopy(widgets[0]))
        widgets[-1]["tabs"][0]["query"]["id"] = "another-query"
        result = normalize(payload, "buerstadt", URL, NOW)
        self.assertEqual(len(result.observations), 1)
        self.assertEqual(
            result.observations[0].query_ids, {"test-query", "another-query"}
        )

    def test_conflicting_same_timestamp_is_quarantined(self):
        payload = dashboard()
        widgets = payload["panels"][0]["widgets"]
        widgets.append(copy.deepcopy(widgets[0]))
        widgets[-1]["tabs"][0]["query"]["queryData"][0]["temperature"]["value"] = 14
        result = normalize(payload, "buerstadt", URL, NOW)
        self.assertEqual(result.observations, [])
        self.assertEqual(result.skipped["conflicting_observation"], 1)

    def test_old_ngsi_fallback_preserves_old_timestamp_and_zero(self):
        payload = dashboard(
            {
                "id": "old",
                "type": "WeatherObserved",
                "temperature": {"type": "Number", "value": "0"},
                "dateObserved": {"value": "2026-01-01T01:00:00+01:00"},
            }
        )
        row = normalize(payload, "buerstadt", URL, NOW).observations[0]
        self.assertEqual(row.value, 0)
        self.assertEqual(row.observed_at, datetime(2026, 1, 1, tzinfo=UTC))

    def test_invalid_and_missing_timestamps_are_not_poll_time(self):
        for value in [None, "nonsense", "2026-09-14T06:00:00", "2027-01-01T00:00:00Z"]:
            with self.subTest(value=value):
                payload = dashboard()
                next(query_tabs(payload))["query"]["queryData"][0]["temperature"][
                    "observedAt"
                ] = value
                self.assertEqual(
                    normalize(payload, "buerstadt", URL, NOW).observations, []
                )

    def test_reject_nonfinite_null_bool_and_non_numeric(self):
        for value in [None, True, "NaN", "Infinity", {}, "12 °C"]:
            with self.subTest(value=value):
                payload = dashboard()
                next(query_tabs(payload))["query"]["queryData"][0]["temperature"][
                    "value"
                ] = value
                self.assertEqual(
                    normalize(payload, "buerstadt", URL, NOW).observations, []
                )

    def test_unknown_or_missing_units_are_not_guessed(self):
        for unit in [None, "F", "ppm"]:
            self.assertEqual(
                normalize(dashboard(unit=unit), "buerstadt", URL, NOW).observations, []
            )

    def test_property_unit_conflict_is_rejected(self):
        payload = dashboard()
        next(query_tabs(payload))["query"]["queryData"][0]["temperature"][
            "unitCode"
        ] = "FAH"
        self.assertEqual(normalize(payload, "buerstadt", URL, NOW).observations, [])

    def test_chart_series_and_forecasts_are_excluded(self):
        payload = dashboard()
        next(query_tabs(payload))["query"]["queryData"] = {
            "index": [NOW.isoformat()],
            "attributes": [],
        }
        self.assertEqual(normalize(payload, "buerstadt", URL, NOW).observations, [])
        payload = dashboard()
        next(query_tabs(payload))["query"]["queryData"][0]["type"] = "WeatherForecast"
        self.assertEqual(normalize(payload, "buerstadt", URL, NOW).observations, [])

    def test_filters_and_stable_tenant_scoped_ids(self):
        result = normalize(dashboard(), "buerstadt", URL, NOW, metrics={"parking_free"})
        self.assertFalse(result.observations)
        result = normalize(dashboard(), "buerstadt", URL, NOW, entity_ids={"other"})
        self.assertFalse(result.observations)
        self.assertEqual(sensor_id("b", "a"), sensor_id("b", "a"))
        self.assertNotEqual(sensor_id("b", "a"), sensor_id("c", "a"))
        self.assertLessEqual(len(sensor_id("b", "a" * 1000)), 64)

    def test_missing_location_does_not_use_display_position(self):
        payload = dashboard()
        entity = next(query_tabs(payload))["query"]["queryData"][0]
        entity["position"] = {"coordinates": [49, 8]}
        self.assertIsNone(
            normalize(payload, "buerstadt", URL, NOW).observations[0].latitude
        )

    def test_fractional_parking_counts_are_excluded(self):
        payload = dashboard(
            {
                "id": "p",
                "type": "ParkingGroup",
                "totalOccupied": {
                    "type": "Property",
                    "value": 5.9,
                    "observedAt": NOW.isoformat(),
                },
            },
            unit="",
        )
        result = normalize(payload, "buerstadt", URL, NOW)
        self.assertFalse(result.observations)
        self.assertEqual(result.skipped["invalid_count"], 1)


if __name__ == "__main__":
    unittest.main()
