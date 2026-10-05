import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

from collector import decode, persist, timestamp
from db_support import DatabaseCase

NOW = datetime(2026, 10, 5, 10, tzinfo=UTC)


def event(stamp=NOW, lat=49.75521, lon=8.472255):
    return {'MessageType': 'PositionReport', 'MetaData': {'MMSI': 211276280,
            'ShipName': 'HELENE', 'time_utc': stamp.isoformat()},
            'Message': {'PositionReport': {'Valid': True, 'Latitude': lat,
            'Longitude': lon, 'Sog': 0.7, 'Cog': 105.4, 'TrueHeading': 511}}}


class DecodeTests(unittest.TestCase):
    def test_real_envelope_and_sentinels(self):
        self.assertEqual(timestamp('2026-10-05 09:47:28.245795613 +0000 UTC'),
                         datetime(2026, 10, 5, 9, 47, 28, 245795, tzinfo=UTC))
        sample = decode(event(), NOW)
        self.assertEqual(sample['motion']['speed_kmh'], 1.3)
        self.assertNotIn('heading_deg', sample['motion'])
        unavailable = event()
        unavailable['Message']['PositionReport'].update(Sog=102.3, Cog=360)
        self.assertNotIn('speed_kmh', decode(unavailable, NOW)['motion'])
        self.assertNotIn('course_deg', decode(unavailable, NOW)['motion'])

    def test_bad_geography_timestamp_and_identity(self):
        for value in [event(lat=91), event(lat=50), event(lon=float('nan')),
                      event(NOW-timedelta(minutes=11)), event(NOW+timedelta(minutes=1))]:
            self.assertIsNone(decode(value, NOW))
        value = event()
        value['MetaData']['MMSI'] = 123
        self.assertIsNone(decode(value, NOW))
        value = event()
        value['Message']['PositionReport']['Valid'] = False
        self.assertIsNone(decode(value, NOW))
        self.assertIsNone(decode({'MessageType': 'SubscriptionConfirmation'}, NOW))

    def test_static_is_not_a_new_position(self):
        value = event()
        value['MessageType'] = 'ShipStaticData'
        value['MetaData'].update(latitude=49.75, longitude=8.47)
        value['Message'] = {'ShipStaticData': {'Name': 'HELENE@@', 'Type': 60,
            'Dimension': {'A': 31, 'B': 31, 'C': 7, 'D': 7}}}
        sample = decode(value, NOW)
        self.assertFalse(sample['position'])
        self.assertEqual(sample['details']['length_m'], 62)
        self.assertEqual(sample['details']['name'], 'HELENE')


class PersistenceTests(DatabaseCase):
    async def test_observed_history_latest_core_and_api(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'api/v1'))
        from measurement_migration import install
        await install(self.conn)
        await install(self.conn)
        now = datetime.now(UTC)
        first = event(now-timedelta(seconds=10))
        newest = event(now, lat=49.754)
        await persist(self.conn, first, now)
        await persist(self.conn, newest, now)
        await persist(self.conn, newest, now)
        await persist(self.conn, first, now)
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM movement_positions WHERE kind='ship'"), 2)
        self.assertEqual(await self.scalar("SELECT data->>'latitude' FROM movement_latest WHERE entity_id='ais:211276280'"), '49.754')
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM core_movement_latest WHERE entity_id='ais:211276280'"), 1)
        self.assertEqual(await self.scalar("SELECT COUNT(*) FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id WHERE d.entity_id='movement:ais:211276280' AND d.metric='latitude'"), 2)
        # An invalid or expired report cannot revive a vessel or enter history.
        self.assertFalse(await persist(self.conn, event(now-timedelta(minutes=11)), now))
        self.assertEqual(await self.scalar('SELECT COUNT(*) FROM collected_payloads'), 2)
        from contextlib import asynccontextmanager
        from unittest.mock import patch

        from endpoints.collected import mobility_snapshot
        from psycopg.rows import dict_row
        self.conn.row_factory = dict_row
        class Pool:
            @asynccontextmanager
            async def connection(inner):
                yield self.conn
        for mode in ['legacy', 'core']:
            with patch.dict('os.environ', {'MEASUREMENT_READ_MODE': mode}):
                body = await mobility_snapshot(Pool())
                ship = next(p for p in body['positions'] if p['kind'] == 'ship')
                self.assertEqual(ship['name'], 'HELENE')
                self.assertEqual(ship['basis'], 'observed')
        await self.conn.execute("UPDATE movement_latest SET valid_until=NOW()-INTERVAL '1 second'")
        self.assertEqual((await mobility_snapshot(Pool()))['positions'], [])
        from psycopg.rows import tuple_row
        self.conn.row_factory = tuple_row
