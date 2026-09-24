"""Real SQL coverage; explicit disposable database required."""
import hashlib
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))
from datetime import UTC, datetime, timedelta

from db_support import DatabaseCase
from psycopg.types.json import Jsonb
from publications import publish
from prediction import predict_tick, store_position


class PipelineDatabaseTests(DatabaseCase):
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
