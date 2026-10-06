import json
import unittest
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from collector import persist, persist_sample
from db_support import DatabaseCase
from map_protocol import SOURCE, map_vessels, position
from test_ais import event

# Small golden excerpts of actual public headed-browser responses, 2026-10-05.
FRAME = bytes.fromhex('43000c500000004700046ef70c97d1f860300c97d1f801c785d9004d90ad0e100000000b010648454c454e456ac3e7e3')
LOCATION = bytes.fromhex('010000004d90ad01c785d90648454c454e4500054ce8000000006ac3e7e3')
DETAIL = b'{"name":"HELENE","ts":1791223779,"ss":0.0,"cu":360.0,"al":62,"aw":14}'
STAMP = datetime.fromtimestamp(1791223779, UTC)


class ProtocolTests(unittest.TestCase):
    def test_real_map_discovery_and_paired_position(self):
        rows = map_vessels(FRAME)
        self.assertEqual([r['mmsi'] for r in rows], ['211276280'])
        sample = position(LOCATION, DETAIL, rows[0]['mmsi'], STAMP+timedelta(minutes=1))
        self.assertAlmostEqual(sample['latitude'], 49.7552416667)
        self.assertEqual(sample['timestamp'], STAMP)
        self.assertEqual(sample['motion'], {'speed_kmh': 0.0})  # AIS 360° is unavailable.
        self.assertEqual(sample['details'], {'name': 'HELENE', 'length_m': 62, 'beam_m': 14})
        self.assertIsNone(position(LOCATION, DETAIL, '211276280', STAMP+timedelta(minutes=11)))

    def test_format_changes_and_mismatched_times_fail_closed(self):
        for body in [b'', FRAME[:-1], b'<html>Forbidden</html>', b'X'+FRAME[1:]]:
            with self.assertRaises(ValueError):
                map_vessels(body)
        changed = json.loads(DETAIL)
        changed['ts'] += 1
        with self.assertRaises(ValueError):
            position(LOCATION, json.dumps(changed).encode(), '211276280', STAMP)
        with self.assertRaises(ValueError):
            position(LOCATION[:-1], DETAIL, '211276280', STAMP)


class CrossProviderTests(DatabaseCase):
    async def test_shared_mmsi_latest_timestamp_and_duplicate_history(self):
        from measurement_migration import install
        await install(self.conn)
        now = datetime.now(UTC)
        await persist(self.conn, event(now-timedelta(minutes=2)), now)
        sample = position(LOCATION, DETAIL, '211276280', STAMP)
        sample['timestamp'] = now-timedelta(minutes=1)
        raw = b'golden-map-test'
        await persist_sample(self.conn, sample, raw, SOURCE)
        await persist_sample(self.conn, sample, raw, SOURCE)
        row = await (await self.conn.execute("SELECT data FROM movement_latest WHERE entity_id='ais:211276280'")).fetchone()
        self.assertEqual(row[0]['source_id'], SOURCE)
        self.assertNotIn('source_url', row[0])
        await persist(self.conn, event(now-timedelta(minutes=3)), now)
        row = await (await self.conn.execute("SELECT data FROM movement_latest WHERE entity_id='ais:211276280'")).fetchone()
        self.assertEqual(row[0]['source_id'], SOURCE)
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM movement_positions WHERE entity_id='ais:211276280'"), 3)
        await persist(self.conn, event(now), now)
        row = await (await self.conn.execute("SELECT data FROM movement_latest WHERE entity_id='ais:211276280'")).fetchone()
        self.assertEqual(row[0]['source_id'], 'aisstream-rhein')
        # A healthy five-minute map poll remains available despite a newer AIS failure.
        await self.conn.execute("INSERT INTO collection_attempts(source_id,status,received_at) VALUES ('rhein-map','success',NOW()-INTERVAL '5 minutes'),('aisstream-rhein','failed',NOW())")
        from endpoints.collected import mobility_snapshot
        from psycopg.rows import dict_row, tuple_row
        self.conn.row_factory = dict_row
        class Pool:
            @asynccontextmanager
            async def connection(inner):
                yield self.conn
        self.assertEqual((await mobility_snapshot(Pool()))['ship_source']['status'], 'connected')
        await self.conn.execute("UPDATE collection_attempts SET received_at=NOW()-INTERVAL '12 minutes' WHERE source_id='rhein-map'")
        self.assertEqual((await mobility_snapshot(Pool()))['ship_source']['status'], 'unavailable')
        self.conn.row_factory = tuple_row
