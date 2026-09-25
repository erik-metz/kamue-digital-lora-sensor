"""Real SQL coverage; explicit disposable database required."""
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))
from datetime import UTC, datetime, timedelta

from db_support import DatabaseCase
from prediction import predict_tick, store_position
from psycopg.types.json import Jsonb
from publications import publish


class PipelineDatabaseTests(DatabaseCase):
    async def test_disk_archive_preserves_bytes_and_deduplicates(self):
        import tempfile

        from streamed_archive import archive_file
        body = bytes(range(256)) * 4097
        digest = hashlib.sha256(body).hexdigest()
        with tempfile.TemporaryFile() as file:
            file.write(body)
            await archive_file(self.conn, file, digest, 'application/zip')
            await archive_file(self.conn, file, digest, 'application/zip')
        self.assertEqual(await self.scalar('SELECT body FROM collected_payloads'), body)
        self.assertEqual(await self.scalar('SELECT count(*) FROM collected_payloads'), 1)

    async def test_publication_and_shared_prediction_are_replay_safe(self):
        now = datetime.fromtimestamp(int(datetime.now(UTC).timestamp()) // 10 * 10, UTC)
        digest = hashlib.sha256(b'fixture').hexdigest()
        await self.conn.execute("INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json')", (digest,b'fixture'))
        source = {'id':'fixture','url':'https://example.org/fixture','max_age_seconds':60}
        await publish(self.conn,source,'test/data',[{'value':1}],digest,now)
        await publish(self.conn,source,'test/data',[{'value':0}],digest,now-timedelta(hours=1))
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='test/data'"),[{'value':1}])
        points = [[now.timestamp()-60,49.6,8.4],[now.timestamp()+60,49.7,8.5]]
        await self.conn.execute('''INSERT INTO movement_schedules(source_id,trip_id,service_date,kind,starts_at,ends_at,payload_sha256,fetched_at,trajectory,metadata)
            VALUES ('fixture','trip',%s,'bus',%s,%s,%s,%s,%s,'{}')''',
            (now.date(),now-timedelta(seconds=60),now+timedelta(seconds=60),digest,now,Jsonb(points)))
        await predict_tick(self.conn,now)
        await predict_tick(self.conn,now)
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM movement_positions'),1)
        data = await self.scalar('SELECT data FROM movement_latest')
        self.assertAlmostEqual(data['latitude'],49.65)
        self.assertEqual(data['basis'],'schedule_prediction')
        await store_position(self.conn,timestamp=now,entity_id=data['id'],kind='bus',lat=49.66,lon=8.45,basis='observed',source_id='fixture',digest=digest,metadata={'basis':'fake'},valid_until=now+timedelta(seconds=20))
        best = await self.scalar("SELECT data FROM movement_latest WHERE valid_until>NOW() ORDER BY CASE WHEN basis='observed' THEN 0 ELSE 1 END LIMIT 1")
        self.assertEqual(best['basis'],'observed')
        await predict_tick(self.conn,now+timedelta(seconds=120))
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM movement_latest'),0)
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM movement_positions'),2)

    async def test_gtfs_import_replaces_indexed_stop_times_atomically(self):
        from unittest.mock import patch

        import httpx
        from gtfs import import_gtfs
        from test_collected_pipeline import feed_fixture
        now = datetime(2026, 9, 22, 12, tzinfo=UTC)
        source = {'id':'test-gtfs','url':'https://example.org/gtfs','bbox':[49.55,8.3,49.8,8.65]}
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200,content=feed_fixture()))) as client:
            with patch('gtfs.datetime', wraps=datetime) as clock:
                clock.now.return_value = now
                clock.fromtimestamp = datetime.fromtimestamp
                await import_gtfs(self.conn,client,source)
                count = await self.scalar('SELECT COUNT(*) FROM movement_stop_times')
                self.assertGreater(count,0)
                await import_gtfs(self.conn,client,source)
                self.assertEqual(await self.scalar('SELECT COUNT(*) FROM movement_stop_times'),count)
        # Rehearse the upgrade from existing JSON-only schedules and repeat initialization.
        await self.conn.execute('DELETE FROM movement_stop_times')
        await self.conn.execute('DELETE FROM collector_schema_versions WHERE version=20260927')
        schema = (Path(__file__).resolve().parents[2] / 'api/v1/schema.sql').read_text()
        await self.conn.execute(schema)
        await self.conn.execute(schema)
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM movement_stop_times'),count)
