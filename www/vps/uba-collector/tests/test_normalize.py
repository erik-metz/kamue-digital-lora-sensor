import unittest

from config import Settings
from normalize import normalize, parse_uba_timestamp


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            poll_seconds=1800,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.05,
            min_lon=8.25,
            max_lon=8.85,
        )

    def test_parse_uba_timestamp(self):
        # 2026-10-03 20:00:00 in CEST (UTC+2)
        dt = parse_uba_timestamp("2026-10-03 20:00:00")
        self.assertEqual(dt.hour, 18)
        self.assertEqual(dt.day, 3)

    def test_normalize_stations_and_measurements(self):
        payload = {
            "stations": {
                "indices": [
                    "station id",
                    "station code",
                    "station name",
                    "station city",
                    "station synonym",
                    "station active from",
                    "station active to",
                    "station longitude",
                    "station latitude",
                    "network id",
                    "station setting id",
                    "station type id",
                    "network code",
                    "network name",
                    "station setting name",
                    "station setting short name",
                    "station type name",
                    "station street",
                    "station street nr",
                    "station zip code",
                ],
                "data": {
                    # Station 1: Riedstadt (Inside BBOX: lat 49.8252, lon 8.5168)
                    "671": [
                        "671",
                        "DEHE043",
                        "Riedstadt",
                        "Riedstadt",
                        "",
                        "1990-01-01",
                        None,
                        "8.5168",
                        "49.8252",
                        "6",
                        "1",
                        "1",
                        "HE",
                        "Hessen",
                        "Hintergrund",
                        "urban",
                        "background",
                        "Starkenburger Str.",
                        "1",
                        "64560",
                    ],
                    # Station 2: Berlin (Outside BBOX: lat 52.5, lon 13.4)
                    "101": [
                        "101",
                        "DEBE001",
                        "Berlin Wedding",
                        "Berlin",
                        "",
                        "1990-01-01",
                        None,
                        "13.4000",
                        "52.5000",
                        "1",
                        "1",
                        "1",
                        "BE",
                        "Berlin",
                        "urban",
                        "urban",
                        "traffic",
                        "",
                        "",
                        "",
                    ],
                    # Station 3: Lampertheim inactive in 2014 (Inside BBOX, but expired)
                    "741": [
                        "741",
                        "DEHE113",
                        "Lampertheim",
                        "Lampertheim",
                        "",
                        "1990-01-01",
                        "2014-01-07",
                        "8.4696",
                        "49.5931",
                        "6",
                        "1",
                        "1",
                        "HE",
                        "Hessen",
                        "urban",
                        "urban",
                        "traffic",
                        "",
                        "",
                        "",
                    ],
                },
            },
            "airquality": {
                "data": {
                    "671": {
                        "2026-10-03 20:00:00": [
                            "2026-10-03 21:00:00",
                            1,  # total index: 1 (Very good)
                            1,  # data complete
                            [1, 12.0, 1, "1.1"],  # PM10
                            [3, 28.0, 1, "1.0"],  # O3
                            [5, 16.0, 1, "1.2"],  # NO2
                            [9, 5.0, 0, "1.0"],   # PM25
                        ]
                    }
                }
            },
        }

        stations, skipped = normalize(payload, self.settings)
        self.assertEqual(len(stations), 1)
        self.assertEqual(skipped, 2)

        st = stations[0]
        self.assertEqual(st.station_id, "671")
        self.assertEqual(st.station_code, "DEHE043")
        self.assertEqual(st.sensor_id, "uba-dehe043")
        self.assertEqual(st.city, "Riedstadt")
        self.assertAlmostEqual(st.latitude, 49.8252)
        self.assertAlmostEqual(st.longitude, 8.5168)

        # 4 pollutants + 1 air_quality_index = 5 measurements
        metrics = {m.metric: (m.value, m.unit) for m in st.measurements}
        self.assertIn("air_quality_index", metrics)
        self.assertEqual(metrics["air_quality_index"], (1.0, "index"))
        self.assertIn("PM10", metrics)
        self.assertEqual(metrics["PM10"], (12.0, "µg/m³"))
        self.assertIn("O3", metrics)
        self.assertEqual(metrics["O3"], (28.0, "µg/m³"))
        self.assertIn("NO2", metrics)
        self.assertEqual(metrics["NO2"], (16.0, "µg/m³"))
        self.assertIn("PM25", metrics)
        self.assertEqual(metrics["PM25"], (5.0, "µg/m³"))
