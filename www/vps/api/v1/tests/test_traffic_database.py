"""Real SQL coverage of event filters, GeoJSON and additive migration replay."""

import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tests"))

from db_support import DatabaseCase
from endpoints.collected import map_layers
from endpoints.infrastructure import EmfSitesSummary
from endpoints.traffic import get_corridor_statuses, list_active_incidents
from psycopg.rows import dict_row
from starlette.requests import Request


class TrafficDatabaseTests(DatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.conn.execute(
            (
                Path(__file__).resolve().parents[1]
                / "migrations/20260930_measurements.sql"
            ).read_text()
        )

    async def test_planned_filters_and_shared_corridor_status(self):
        for identity, future, subtype in [
            ("now", False, "entry_exit"),
            ("later", True, "full"),
        ]:
            await self.conn.execute(
                """INSERT INTO traffic_incidents
                (id,road_name,direction,location_from,location_to,start_time,last_seen_at,
                 coordinates,cause_type,source_category,provider_future,closure_kind,provider_start_at)
                VALUES (%s,'A67','Nord','A','B',NOW(),NOW(),'[[49.6,8.4],[49.61,8.41]]',
                        'closure','closure',%s,%s,NOW()+CASE WHEN %s THEN INTERVAL '1 day' ELSE INTERVAL '-1 day' END)""",
                (identity, future, subtype, future),
            )
        await self.conn.execute(
            "INSERT INTO traffic_source_checks VALUES ('A67','autobahn_api',NOW())"
        )
        migration = (
            Path(__file__).resolve().parents[1]
            / "migrations/20261009_traffic_events.sql"
        )
        await self.conn.execute(migration.read_text())
        await self.conn.execute(migration.read_text())
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection

        current = await list_active_incidents(Pool(), road="A67")
        planned = await list_active_incidents(
            Pool(), road="A67", event_status="planned", category="closure"
        )
        self.assertEqual([i.id for i in current], ["now"])
        self.assertEqual([i.id for i in planned], ["later"])
        self.assertIsNone(current[0].delay_seconds)
        self.assertEqual(planned[0].event_status, "planned")
        self.assertEqual(
            await list_active_incidents(
                Pool(), road="A67", event_status="planned", category="roadworks"
            ),
            [],
        )
        statuses = await get_corridor_statuses(Pool())
        a67 = next(c for c in statuses if c.road_name == "A67")
        self.assertEqual(a67.status, "sluggish")
        self.assertEqual(a67.active_incidents_count, 1)
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [],
                "query_string": b"",
            }
        )
        with patch(
            "endpoints.collected.get_emf_sites",
            new_callable=AsyncMock,
            return_value=EmfSitesSummary(total_sites=0, providers={}, sites=[]),
        ):
            body = json.loads((await map_layers(request, Pool())).body)
        features = body["layers"]["traffic"]["features"]
        events = [
            f["properties"]
            for f in features
            if f["properties"].get("kind") != "corridor"
        ]
        self.assertEqual({i["id"] for i in events}, {"now", "later"})
        self.assertTrue(all(i["delay_seconds"] is None for i in events))
        corridor = next(
            f["properties"] for f in features if f["properties"]["id"] == "corridor-a67"
        )
        self.assertEqual(corridor["status"], a67.status)
        self.assertEqual(corridor["active_incidents_count"], 1)
        self.assertIsNone(corridor["delay_minutes"])
