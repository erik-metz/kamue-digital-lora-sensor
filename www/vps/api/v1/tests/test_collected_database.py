"""Exercise publication read SQL against the disposable integration database."""
import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tests"))

from db_support import DatabaseCase
from endpoints.collected import collection_status
from psycopg.rows import dict_row
from starlette.requests import Request


class CollectedDatabaseTests(DatabaseCase):
    async def test_status_includes_registered_and_unregistered_sources(self):
        await self.conn.execute("""INSERT INTO collection_sources
            (id,source_url,adapter,enabled,interval_seconds)
            VALUES ('configured','https://example.org/data','json',FALSE,3600)""")
        await self.conn.execute("""INSERT INTO collection_attempts(source_id,status)
            VALUES ('legacy-worker','success')""")
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection

        request = Request({'type': 'http', 'method': 'GET', 'path': '/',
                           'headers': [], 'query_string': b''})
        response = await collection_status(request, Pool())
        rows = {row['source_id']: row for row in json.loads(response.body)['sources']}
        self.assertFalse(rows['configured']['enabled'])
        self.assertEqual(rows['configured']['status'], 'pending')
        self.assertIsNone(rows['legacy-worker']['enabled'])
        self.assertIsNotNone(rows['legacy-worker']['last_success_at'])
        self.assertTrue(rows['legacy-worker']['completion_recorded'])
        self.assertIsNotNone(rows['legacy-worker']['last_processed_at'])
        self.assertIsNone(rows['legacy-worker']['item_count'])
        self.assertIsNone(rows['configured']['last_processed_at'])

    async def test_indexed_departures_scope_sources_and_cascade(self):
        from datetime import UTC, datetime, timedelta

        from endpoints.collected import departures
        from psycopg.types.json import Jsonb
        now = datetime.now(UTC)
        digest = 'a' * 64
        await self.conn.execute("INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,'fixture','text/plain')", (digest,))
        for source in ['one', 'two']:
            await self.conn.execute("""INSERT INTO movement_schedules
                (source_id,trip_id,service_date,kind,starts_at,ends_at,payload_sha256,fetched_at,trajectory,metadata)
                VALUES (%s,'trip',%s,'bus',%s,%s,%s,%s,'[]',%s)""",
                (source,now.date(),now,now+timedelta(hours=1),digest,now,Jsonb({'line':'1','destination':'Test'})))
            await self.conn.execute("""INSERT INTO movement_stop_times
                VALUES (%s,'trip',%s,1,'shared-stop',%s,%s)""",
                (source,now.date(),now+timedelta(minutes=2),now+timedelta(minutes=3)))
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection

        request = Request({'type':'http','method':'GET','path':'/', 'headers':[], 'query_string':b'source=one'})
        body = json.loads((await departures('shared-stop', request, Pool())).body)
        self.assertEqual([row['source_id'] for row in body['departures']], ['one'])
        await self.conn.execute("""INSERT INTO movement_trip_updates
            (source_id,trip_id,service_date,observed_at,valid_until,cancelled,delay_seconds,payload_sha256)
            VALUES ('one','trip',%s,%s,%s,TRUE,0,%s)""", (now.date(),now,now+timedelta(minutes=5),digest))
        body = json.loads((await departures('shared-stop', request, Pool())).body)
        self.assertEqual(body['departures'], [])
        await self.conn.execute("DELETE FROM movement_schedules WHERE source_id='one'")
        cursor = await self.conn.execute("SELECT COUNT(*) AS count FROM movement_stop_times WHERE source_id='one'")
        self.assertEqual((await cursor.fetchone())['count'], 0)

    async def test_map_reads_real_traffic_rows_and_excludes_stale_incidents(self):
        await self.conn.execute((Path(__file__).resolve().parents[1] / "migrations/20260930_measurements.sql").read_text())
        from endpoints.collected import map_layers
        for identity, age in [('current', 0), ('stale', 3)]:
            await self.conn.execute("""INSERT INTO traffic_incidents
                (id,road_name,direction,location_from,location_to,start_time,last_seen_at,coordinates,cause_type)
                VALUES (%s,'A67','Nord','A','B',NOW(),NOW()-%s*INTERVAL '1 hour','[[49.6,8.4],[49.61,8.41]]','closure')""", (identity, age))
        self.conn.row_factory = dict_row
        connection = self.conn

        class Pool:
            @asynccontextmanager
            async def connection(self):
                yield connection

        request = Request({'type':'http','method':'GET','path':'/', 'headers':[], 'query_string':b''})
        body = json.loads((await map_layers(request, Pool())).body)
        self.assertEqual([f['properties']['id'] for f in body['layers']['traffic']['features'] if f['properties'].get('kind') != 'corridor'], ['current'])
        self.assertEqual([f['properties']['id'] for f in body['layers']['closures']['features'] if f['properties']['id'] in ('current', 'stale')], ['current'])

    async def test_download_is_not_processing_and_history_is_not_rewritten(self):
        await self.conn.execute("""INSERT INTO collection_attempts(source_id,status,http_status)
            VALUES ('download-only','received',200),('broken','failed',401)""")
        downloaded = await (await self.conn.execute("""SELECT fetched_at,processed_at
            FROM collection_attempts WHERE source_id='download-only'""")).fetchone()
        self.assertIsNotNone(downloaded[0])
        self.assertIsNone(downloaded[1])
        await self.conn.execute("""UPDATE collection_attempts SET status='partial',item_count=0,
            error_stage='processing' WHERE source_id='download-only'""")
        self.assertIsNotNone(await self.scalar("SELECT processed_at FROM collection_attempts WHERE source_id='download-only'"))
        self.assertIsNone(await self.scalar("SELECT fetched_at FROM collection_attempts WHERE source_id='broken'"))
        # A historical success with no instrumented completion must remain unknown.
        await self.conn.execute('ALTER TABLE collection_attempts DISABLE TRIGGER collection_attempt_completion')
        await self.conn.execute("INSERT INTO collection_attempts(source_id,status) VALUES ('historic','success')")
        await self.conn.execute('ALTER TABLE collection_attempts ENABLE TRIGGER collection_attempt_completion')
        await self.conn.execute((Path(__file__).resolve().parents[1] / 'migrations/20261007_collection_status.sql').read_text())
        self.assertIsNone(await self.scalar("SELECT processed_at FROM collection_attempts WHERE source_id='historic'"))
