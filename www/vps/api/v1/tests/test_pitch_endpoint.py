import json
import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from endpoints.pitch import activity
from fastapi import HTTPException


class PitchEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_partial_sources_preserve_real_zeroes(self):
        start = datetime.now(UTC)-timedelta(minutes=1)
        with patch('endpoints.pitch.read_crossings', AsyncMock(return_value={'opened': 0, 'closed': 1})), \
             patch('endpoints.pitch.read_bikes', AsyncMock(side_effect=RuntimeError('offline'))), \
             patch('endpoints.pitch.mobility_snapshot', AsyncMock(return_value={'positions': [], 'ship_source': {'status': 'connected'}})):
            response = await activity(start, None)
        body = json.loads(response.body)
        self.assertEqual(body['crossings']['opened'], 0)
        self.assertIsNone(body['bikes'])
        self.assertEqual(body['moving']['ship']['count'], 0)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    async def test_invalid_window_never_reads_database(self):
        with patch('endpoints.pitch.read_crossings', AsyncMock()) as read:
            for start in [datetime.now(UTC)-timedelta(hours=3), datetime.now(UTC)+timedelta(minutes=1)]:
                with self.assertRaises(HTTPException) as error:
                    await activity(start, None)
                self.assertEqual(error.exception.status_code, 400)
            read.assert_not_called()

    async def test_total_failure_is_not_zero_activity(self):
        with patch('endpoints.pitch.read_crossings', AsyncMock(side_effect=RuntimeError('offline'))), \
             patch('endpoints.pitch.read_bikes', AsyncMock(side_effect=RuntimeError('offline'))), \
             patch('endpoints.pitch.mobility_snapshot', AsyncMock(side_effect=RuntimeError('offline'))):
            with self.assertRaises(HTTPException) as error:
                await activity(datetime.now(UTC)-timedelta(minutes=1), None)
            self.assertEqual(error.exception.status_code, 503)


@unittest.skipUnless(os.getenv('PITCH_TEST_DATABASE_URL'), 'Requires disposable PostgreSQL')
class PitchDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_queries_include_baseline_and_exclude_outside_stations(self):
        from psycopg.rows import dict_row
        from psycopg_pool import AsyncConnectionPool
        async with AsyncConnectionPool(os.environ['PITCH_TEST_DATABASE_URL'], kwargs={'row_factory': dict_row}, open=False) as pool:
            end = datetime.now(UTC)
            start = end-timedelta(minutes=1)
            async with pool.connection() as conn:
                await conn.execute('''CREATE TEMP TABLE unused_test_guard(id integer)''')
                # This database is created solely for this test, never production.
                await conn.execute('''CREATE TABLE IF NOT EXISTS measurement_definitions(id integer,entity_id text,metric text,source_id text,basis text,unit text);
                    CREATE TABLE IF NOT EXISTS readings(measurement_id integer,observed_at timestamptz,value double precision,quality text);
                    CREATE TABLE IF NOT EXISTS sensor_metadata(id text,is_hidden boolean,latitude double precision,longitude double precision);
                    CREATE TABLE IF NOT EXISTS nextbike_sources(sensor_id text,last_fetched_at timestamptz);
                    CREATE TABLE IF NOT EXISTS nextbike_observations(sensor_id text,observed_at timestamptz,metric text,value double precision,bike_numbers text[]);
                    TRUNCATE measurement_definitions,readings,sensor_metadata,nextbike_sources,nextbike_observations;''')
                await conn.execute("INSERT INTO measurement_definitions VALUES (1,'crossing:a','crossing_state','rail-barrier-model','model','state')")
                for offset, value in [(-61, 0), (-50, 1), (-40, 2), (-30, 2), (-20, 0), (-10, 0)]:
                    await conn.execute("INSERT INTO readings VALUES (1,%s,%s,'valid')", (end+timedelta(seconds=offset), value))
                for identity, latitude in [('local', 49.65), ('outside', 50.1)]:
                    await conn.execute('INSERT INTO sensor_metadata VALUES (%s,FALSE,%s,8.4)', (identity, latitude))
                    await conn.execute('INSERT INTO nextbike_sources VALUES (%s,%s)', (identity, end))
                    for offset, roster in [(-61, ['A','B']), (-20, ['B','C'])]:
                        await conn.execute("INSERT INTO nextbike_observations VALUES (%s,%s,'bike_available',2,%s)", (identity, end+timedelta(seconds=offset), roster))
            with patch('endpoints.pitch.mobility_snapshot', AsyncMock(return_value={'positions': []})), patch.dict(os.environ, {'MEASUREMENT_READ_MODE': 'legacy'}):
                body = json.loads((await activity(start, pool)).body)
            self.assertEqual((body['crossings']['opened'], body['crossings']['closed']), (1, 1))
            self.assertEqual((body['bikes']['removed'], body['bikes']['returned']), (1, 1))
            self.assertEqual(body['bikes']['stations'], 1)
