"""Unit tests for traffic flow and corridor congestion modeling."""

import unittest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from config import Settings
from normalize import ParsedIncident
from traffic_flow import (
    RIED_CORRIDORS,
    FlowObservation,
    collect_traffic_flows,
    estimate_corridor_flow,
    fetch_tomtom_flow,
    haversine_distance_km,
    incident_affects_corridor,
)


def sample_settings(tomtom_key: str | None = None) -> Settings:
    return Settings(
        roads=("A67", "A5", "A6"),
        poll_seconds=180,
        state_dir="/tmp",
        db={},
        tomtom_api_key=tomtom_key,
    )


def sample_incident(
    road: str = "B44",
    cause_type: str = "warning",
    delay_seconds: int = 0,
    coordinates: list[list[float]] | None = None,
) -> ParsedIncident:
    return ParsedIncident(
        id=f"inc-{road}-{cause_type}",
        road_name=road,
        direction="süd",
        location_from="Start",
        location_to="End",
        cause_type=cause_type,
        closure_kind="full" if cause_type == "closure" else "none",
        severity="slight",
        delay_seconds=delay_seconds,
        length_meters=500,
        coordinates=coordinates or [[49.6150, 8.4800]],
        source="autobahn_api",
        delay_kind="measured" if delay_seconds > 0 else "unknown",
        category="warning",
        description="Verkehrsbehinderung",
    )


try:
    import psycopg
except ImportError:
    psycopg = None


class TrafficFlowTests(unittest.IsolatedAsyncioTestCase):
    def test_corridor_definitions(self):
        self.assertGreaterEqual(len(RIED_CORRIDORS), 5)
        for c in RIED_CORRIDORS:
            self.assertTrue(c.id.startswith("road-"))
            self.assertIn(c.road, ("B44", "B47", "A67"))
            self.assertGreater(c.free_flow_speed_kmh, 50.0)
            self.assertGreater(c.length_km, 1.0)
            self.assertTrue(49.45 <= c.lat <= 49.90)
            self.assertTrue(8.25 <= c.lon <= 8.75)

    def test_haversine_distance(self):
        # Distance between Bürstadt (49.6425, 8.4552) and Lampertheim (49.5936, 8.5283) is approx 7.4 km
        dist = haversine_distance_km(49.6425, 8.4552, 49.5936, 8.5283)
        self.assertAlmostEqual(dist, 7.4, delta=1.5)

    def test_incident_affects_corridor(self):
        b44 = next(c for c in RIED_CORRIDORS if c.road == "B44")
        inc_b44 = sample_incident(road="B44")
        self.assertTrue(incident_affects_corridor(inc_b44, b44))

        inc_other = sample_incident(
            road="A8", coordinates=[[52.0, 10.0]]
        )  # far away
        self.assertFalse(incident_affects_corridor(inc_other, b44))

    def test_corridor_flow_estimation_clear(self):
        for c in RIED_CORRIDORS:
            flow = estimate_corridor_flow(c, [])
            self.assertEqual(flow.status, "clear")
            self.assertEqual(flow.speed_kmh, c.free_flow_speed_kmh)
            self.assertEqual(flow.delay_seconds, 0.0)
            self.assertEqual(flow.congestion_ratio, 1.0)
            self.assertEqual(flow.source, "traffic_flow_model")

    def test_corridor_flow_estimation_closure(self):
        b44 = next(c for c in RIED_CORRIDORS if c.road == "B44")
        inc = sample_incident(road="B44", cause_type="closure")
        flow = estimate_corridor_flow(b44, [inc])
        self.assertEqual(flow.status, "closed")
        self.assertEqual(flow.speed_kmh, 0.0)
        self.assertEqual(flow.congestion_ratio, 0.0)
        self.assertGreaterEqual(flow.delay_seconds, 1800.0)

    def test_corridor_flow_estimation_delay(self):
        a67 = next(c for c in RIED_CORRIDORS if c.road == "A67")
        # 10 minutes delay (600s) on A67
        inc = sample_incident(road="A67", cause_type="warning", delay_seconds=600)
        flow = estimate_corridor_flow(a67, [inc])
        self.assertEqual(flow.status, "congestion")
        self.assertEqual(flow.delay_seconds, 600.0)
        self.assertLess(flow.speed_kmh, a67.free_flow_speed_kmh)
        self.assertLess(flow.congestion_ratio, 1.0)

    def test_corridor_flow_estimation_roadworks(self):
        b47 = next(c for c in RIED_CORRIDORS if c.road == "B47")
        inc = sample_incident(road="B47", cause_type="roadworks", delay_seconds=0)
        flow = estimate_corridor_flow(b47, [inc])
        self.assertEqual(flow.status, "clear")
        self.assertEqual(flow.delay_seconds, 60.0)
        self.assertLess(flow.speed_kmh, b47.free_flow_speed_kmh)

    async def test_tomtom_flow_fetch_success(self):
        corridor = RIED_CORRIDORS[0]
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "flowSegmentData": {
                "currentSpeed": 85,
                "freeFlowSpeed": 100,
                "currentTravelTime": 290,
                "freeFlowTravelTime": 259,
                "confidence": 0.98,
                "roadClosure": False,
            }
        }
        client = AsyncMock()
        client.get.return_value = mock_response

        flow = await fetch_tomtom_flow(client, corridor, "dummy-key")
        self.assertIsNotNone(flow)
        self.assertEqual(flow.speed_kmh, 85.0)
        self.assertEqual(flow.free_flow_speed_kmh, 100.0)
        self.assertEqual(flow.delay_seconds, 31.0)
        self.assertEqual(flow.congestion_ratio, 0.85)
        self.assertEqual(flow.status, "clear")
        self.assertEqual(flow.source, "tomtom_flow")

    async def test_tomtom_flow_fetch_road_closure(self):
        corridor = RIED_CORRIDORS[0]
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "flowSegmentData": {
                "currentSpeed": 0,
                "freeFlowSpeed": 100,
                "currentTravelTime": 9999,
                "freeFlowTravelTime": 259,
                "confidence": 1.0,
                "roadClosure": True,
            }
        }
        client = AsyncMock()
        client.get.return_value = mock_response

        flow = await fetch_tomtom_flow(client, corridor, "dummy-key")
        self.assertIsNotNone(flow)
        self.assertEqual(flow.status, "closed")
        self.assertEqual(flow.speed_kmh, 0.0)
        self.assertEqual(flow.congestion_ratio, 0.0)

    async def test_tomtom_flow_fallback_on_error(self):
        corridor = RIED_CORRIDORS[0]
        client = AsyncMock()
        client.get.side_effect = TimeoutError("Connection timed out")

        flow = await fetch_tomtom_flow(client, corridor, "dummy-key")
        self.assertIsNone(flow)

        # Integration via collect_traffic_flows falls back to estimation
        settings = sample_settings(tomtom_key="dummy-key")
        flows = await collect_traffic_flows(client, settings, [], corridors=(corridor,))
        self.assertEqual(len(flows), 1)
        self.assertEqual(flows[0].source, "traffic_flow_model")
        self.assertEqual(flows[0].status, "clear")

    @unittest.skipIf(psycopg is None, "psycopg not installed")
    async def test_storage_writes_measurements_when_core_present(self):
        from storage import persist_traffic_incidents

        corridor = RIED_CORRIDORS[0]
        flow = FlowObservation(
            corridor=corridor,
            speed_kmh=80.0,
            free_flow_speed_kmh=100.0,
            delay_seconds=45.0,
            congestion_ratio=0.8,
            status="clear",
            source="traffic_flow_model",
        )

        mock_cur = AsyncMock()
        # Routine check returns 1 (core present), version check returns 20260916
        mock_cur.fetchone.side_effect = [
            (20260916,),  # collector_schema_versions
            (1,),  # write_measurement routine present
        ]

        mock_conn = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock()
        mock_conn.transaction.return_value.__aexit__ = AsyncMock()
        mock_conn.cursor.return_value.__aenter__ = AsyncMock(return_value=mock_cur)
        mock_conn.cursor.return_value.__aexit__ = AsyncMock()

        settings = sample_settings()
        now = datetime.now(UTC)
        res = await persist_traffic_incidents(
            mock_conn, [], settings, now=now, flows=[flow]
        )
        self.assertEqual(res["persisted_flows"], 1)

        # Verify SQL executions
        executed_sqls = [call[0][0] for call in mock_cur.execute.call_args_list]
        has_entities_insert = any("INSERT INTO entities" in s for s in executed_sqls)
        has_measurement_write = any(
            "SELECT write_measurement" in s for s in executed_sqls
        )
        self.assertTrue(has_entities_insert)
        self.assertTrue(has_measurement_write)

    @unittest.skipIf(psycopg is None, "psycopg not installed")
    async def test_storage_safely_skips_when_core_absent(self):
        from storage import persist_traffic_incidents

        mock_cur = AsyncMock()
        # Routine check returns None (core absent)
        mock_cur.fetchone.side_effect = [
            (20260916,),  # collector_schema_versions
            None,  # write_measurement routine absent
        ]

        mock_conn = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock()
        mock_conn.transaction.return_value.__aexit__ = AsyncMock()
        mock_conn.cursor.return_value.__aenter__ = AsyncMock(return_value=mock_cur)
        mock_conn.cursor.return_value.__aexit__ = AsyncMock()

        settings = sample_settings()
        now = datetime.now(UTC)
        res = await persist_traffic_incidents(mock_conn, [], settings, now=now)
        self.assertEqual(res["active_incidents"], 0)


if __name__ == "__main__":
    unittest.main()
