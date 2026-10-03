import unittest
from datetime import UTC, datetime

from config import Settings
from normalize import (
    compute_ried_snapshot,
    normalize_gateway,
    normalize_gateways_payload,
)


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            poll_seconds=900,
            state_dir="/tmp",
            db={},
            min_lat=49.40,
            max_lat=50.00,
            min_lon=8.25,
            max_lon=8.80,
            center_lat=49.64,
            center_lon=8.53,
            radius_meters=25000,
        )

    def test_normalize_valid_gateway(self):
        now = datetime(2026, 10, 4, 12, 0, 0, tzinfo=UTC)
        raw = {
            "id": "eui-58a0cbfffe801234",
            "name": "Bensheim Bergstraße Gateway",
            "location": {
                "latitude": 49.682,
                "longitude": 8.618,
                "altitude": 120.5,
            },
            "antennaPlacement": "OUTDOOR",
            "online": True,
            "updatedAt": "2026-10-04T11:45:00Z",
            "tenantID": "ttn",
            "netID": "000013",
        }

        gw = normalize_gateway(raw, self.settings, now=now)
        self.assertIsNotNone(gw)
        self.assertEqual(gw.gateway_id, "eui-58a0cbfffe801234")
        self.assertEqual(gw.sensor_id, "ttn-gw-eui-58a0cbfffe801234")
        self.assertEqual(gw.latitude, 49.682)
        self.assertEqual(gw.longitude, 8.618)
        self.assertEqual(gw.altitude, 120.5)
        self.assertEqual(gw.antenna_placement, "OUTDOOR")
        self.assertTrue(gw.online)
        self.assertEqual(gw.updated_at.year, 2026)

    def test_normalize_filters_out_of_bounds(self):
        raw = {
            "id": "eui-berlin-1234",
            "location": {"latitude": 52.52, "longitude": 13.40},
            "online": True,
        }
        gw = normalize_gateway(raw, self.settings)
        self.assertIsNone(gw)

    def test_normalize_payload_deduplication(self):
        raw_list = [
            {
                "id": "gw-1",
                "location": {"latitude": 49.64, "longitude": 8.53},
                "online": True,
            },
            {
                "id": "gw-1",
                "location": {"latitude": 49.64, "longitude": 8.53},
                "online": True,
            },
            {
                "id": "gw-2",
                "location": {"latitude": 49.65, "longitude": 8.54},
                "online": False,
            },
        ]
        gws = normalize_gateways_payload(raw_list, self.settings)
        self.assertEqual(len(gws), 2)
        self.assertEqual(gws[0].gateway_id, "gw-1")
        self.assertEqual(gws[1].gateway_id, "gw-2")

    def test_compute_ried_snapshot(self):
        now = datetime(2026, 10, 4, 12, 0, 0, tzinfo=UTC)
        raw_list = [
            {
                "id": "gw-1",
                "location": {"latitude": 49.64, "longitude": 8.53},
                "antennaPlacement": "OUTDOOR",
                "online": True,
            },
            {
                "id": "gw-2",
                "location": {"latitude": 49.65, "longitude": 8.54},
                "antennaPlacement": "INDOOR",
                "online": False,
            },
            {
                "id": "gw-3",
                "location": {"latitude": 49.66, "longitude": 8.55},
                "antennaPlacement": "OUTDOOR",
                "online": True,
            },
        ]
        gws = normalize_gateways_payload(raw_list, self.settings, now=now)
        snapshot = compute_ried_snapshot(gws, now=now)

        self.assertEqual(snapshot.total_gateways, 3)
        self.assertEqual(snapshot.active_gateways, 2)
        self.assertEqual(snapshot.outdoor_gateways, 2)
        self.assertEqual(snapshot.indoor_gateways, 1)
        self.assertAlmostEqual(snapshot.online_ratio_pct, 66.67, places=2)
