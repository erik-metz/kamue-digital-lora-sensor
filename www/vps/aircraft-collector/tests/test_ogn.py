import json
import unittest
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from db_support import DatabaseCase
from ogn import cleanup, decode, permissions, persist, refresh_permissions

NOW = datetime(2026,10,6,12,tzinfo=UTC)
HEADER = '#DEVICE_TYPE,DEVICE_ID,AIRCRAFT_MODEL,REGISTRATION,CN,TRACKED,IDENTIFIED\n'


def report(now=NOW, flags='06', clock=None):
    return f"FLRABC123>APRS,qAS,Ried:/{clock or now.strftime('%H%M%S')}h4939.00N/00827.00E'090/020/A=003000 !W52! id{flags}ABC123 +100fpm 15.0dB 0e"


class ParserTests(unittest.TestCase):
    def test_coordinates_time_units_category_and_explicit_address_type(self):
        key, stamp, data = decode(report(),NOW)
        self.assertEqual(key,'F:ABC123')
        self.assertEqual(stamp,NOW)
        self.assertAlmostEqual(data['latitude'],49.65+5/60000)
        self.assertAlmostEqual(data['longitude'],8.45+2/60000)
        self.assertEqual(data['speed_kmh'],37.04)
        self.assertEqual(data['altitude_ogn_m'],914.4)
        self.assertEqual(data['vertical_rate_ogn_mps'],.51)
        self.assertEqual(data['ogn_category'],1)
        self.assertNotIn('icao24',data)
        self.assertNotIn('altitude_geom_m',data)
        self.assertEqual(decode(report(flags='05'),NOW)[2]['icao24'],'abc123')

    def test_privacy_ground_invalid_and_stale_messages_are_rejected(self):
        for flags in ['46','86','C6','04','3A','3E','12']:
            self.assertIsNone(decode(report(flags=flags),NOW),flags)
        for line in [report(clock='235959'),report(clock='999999'),
            report().replace('4939.00','4961.00'),report().replace('4939.00','5139.00'),
            report().replace('0e','6e'),report().replace('090/020','090/000'),
            report().replace('id06','xx06'),'# heartbeat']:
            self.assertIsNone(decode(line,NOW),line)
        self.assertIsNone(decode(report(),NOW+timedelta(seconds=60)))

    def test_midnight_uses_nearest_day_without_refreshing_old_time(self):
        stamp = NOW.replace(hour=23,minute=59,second=59)
        self.assertEqual(decode(report(stamp),stamp+timedelta(seconds=2))[1],stamp)

    def test_ddb_requires_both_opt_ins_and_valid_complete_format(self):
        body = HEADER+"'F','ABC123','LS-4','D-TEST','AA','Y','Y'\n"
        self.assertEqual(permissions(body)['F:ABC123']['registration'],'D-TEST')
        for flags in ["'Y','N'","'N','Y'","'N','N'"]:
            self.assertNotIn('I:123ABC',permissions(body+f"'I','123ABC','','','',{flags}\n"))
        for bad in ['html error',HEADER,body+"'F','ABC123','','','','N','N'",body+'broken']:
            with self.assertRaises(ValueError):
                permissions(bad)


class OgnDatabaseTests(DatabaseCase):
    async def test_privacy_expiry_history_isolation_and_api_reader_modes(self):
        from endpoints.collected import mobility_snapshot, movement_telemetry
        from measurement_migration import install
        from psycopg.rows import dict_row, tuple_row
        from starlette.requests import Request
        now = datetime.now(UTC).replace(microsecond=0)
        allowed = {'F:ABC123':{'registration':'D-TEST','aircraft_type':'LS-4'}}
        self.assertFalse(await persist(self.conn,report(now),now))  # No default tracking.
        await refresh_permissions(self.conn,allowed,now)
        self.assertTrue(await persist(self.conn,report(now),now))
        self.assertFalse(await persist(self.conn,report(now),now))
        await install(self.conn)
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_positions'),1)
        for table in ['movement_positions','movement_latest','collected_payloads','readings','entities']:
            self.assertEqual(await self.scalar('SELECT COUNT(*) FROM '+table),0,table)
        self.conn.row_factory = dict_row
        class Pool:
            @asynccontextmanager
            async def connection(inner):
                yield self.conn
        request = Request({'type':'http','method':'GET','path':'/','headers':[],'query_string':b''})
        for mode in ['legacy','core']:
            with patch.dict('os.environ',{'MEASUREMENT_READ_MODE':mode}):
                aircraft = (await mobility_snapshot(Pool()))['positions'][0]
                self.assertEqual(aircraft['registration'],'D-TEST')
                self.assertEqual(aircraft['source_id'],'ogn-ried')
        result = await movement_telemetry('movement:aircraft:ogn:F:ABC123',request,Pool())
        self.assertIn('altitude_ogn',[r['metric'] for r in json.loads(result.body)['readings']])
        self.assertEqual(result.headers['cache-control'],'no-store')
        await self.conn.execute("UPDATE ogn_positions SET timestamp=NOW()-INTERVAL '24 hours'")
        self.assertEqual((await mobility_snapshot(Pool()))['positions'],[])
        old = await movement_telemetry('movement:aircraft:ogn:F:ABC123',request,Pool())
        self.assertEqual(json.loads(old.body)['history'],[])
        await cleanup(self.conn)
        self.conn.row_factory = tuple_row
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_positions'),0)
        await persist(self.conn,report(now),now)
        await refresh_permissions(self.conn,{'I:123ABC':{}},now)  # Revoked tracking cascades history.
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_positions'),0)
        await refresh_permissions(self.conn,allowed,now)
        await persist(self.conn,report(now),now)
        self.assertFalse(await persist(self.conn,report(now,flags='46'),now))
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_positions'),0)
        await refresh_permissions(self.conn,allowed,now)
        await persist(self.conn,report(now),now)
        await self.conn.execute("UPDATE ogn_permissions SET valid_until=NOW()-INTERVAL '1 second'")
        self.assertFalse(await persist(self.conn,report(now+timedelta(seconds=1)),now))
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_public_positions'),0)
        await cleanup(self.conn)
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM ogn_positions'),0)
