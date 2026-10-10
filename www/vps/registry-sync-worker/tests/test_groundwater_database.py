"""Exercise the actual PostgreSQL measurement function with floating coordinates."""
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'api/v1'))
from db_support import DatabaseCase
from groundwater import import_groundwater
from measurement_migration import install


class GroundwaterDatabaseTests(DatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await install(self.conn)

    async def test_float_coordinates_publish_and_persist_atomically(self):
        payload = {'features': [
            {'attributes': {'ID': 17754, 'MESSTELLENNAME': 'HOFHEIM',
                            'GEMEINDE_NAME': 'Lampertheim'},
             'geometry': {'x': 8.3881, 'y': 49.6534}},
            {'attributes': {'ID': 12890, 'MESSTELLENNAME': 'BIBLIS',
                            'GEMEINDE_NAME': 'Biblis'},
             'geometry': {'x': 8.4289, 'y': 49.7028}},
        ]}
        source = {'id': 'groundwater-test', 'url': 'https://example.org/groundwater',
                  'municipalities': ['Lampertheim', 'Biblis'],
                  'bbox': [49.54, 8.33, 49.75, 8.58]}
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))) as client:
            await import_groundwater(self.conn, client, source)
        rows = await (await self.conn.execute('''SELECT d.entity_id,d.metric,r.value
            FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id
            ORDER BY d.entity_id,d.metric''')).fetchall()
        self.assertEqual([(r[0], r[1], float(r[2])) for r in rows], [
            ('groundwater:hlnug-gw-12890', 'latitude', 49.7028),
            ('groundwater:hlnug-gw-12890', 'longitude', 8.4289),
            ('groundwater:hlnug-gw-17754', 'latitude', 49.6534),
            ('groundwater:hlnug-gw-17754', 'longitude', 8.3881),
        ])
        self.assertEqual(await self.scalar('SELECT count(*) FROM groundwater_stations'), 2)
        self.assertEqual(await self.scalar("SELECT municipality FROM groundwater_stations WHERE id='hlnug-gw-17754'"), 'Lampertheim')
        self.assertEqual(await self.scalar("SELECT hlnug_station_no FROM groundwater_stations WHERE id='hlnug-gw-17754'"), '17754')
        data = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/groundwater'")
        self.assertEqual(data['count'], 2)
        self.assertEqual(data['stations'][0]['lat'], 49.6534)
        geojson = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='map/layers/groundwater'")
        self.assertEqual(geojson['features'][0]['geometry']['coordinates'], [8.3881, 49.6534])
        row = await (await self.conn.execute('SELECT status,processed_at FROM collection_attempts')).fetchone()
        self.assertEqual(row[0], 'success')
        self.assertIsNotNone(row[1])

    async def test_truncated_refresh_preserves_previous_publication(self):
        payload = {'features': [{'attributes': {'ID': 1, 'GEMEINDE_NAME': 'Biblis'},
                                'geometry': {'x': 8.43, 'y': 49.7}}]}
        source = {'id': 'groundwater-test', 'url': 'https://example.org/groundwater'}
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))) as client:
            await import_groundwater(self.conn, client, source)
            previous = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/groundwater'")
            payload['exceededTransferLimit'] = True
            with self.assertRaisesRegex(ValueError, 'truncated'):
                await import_groundwater(self.conn, client, source)
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/groundwater'"), previous)
        self.assertEqual(await self.scalar('SELECT count(*) FROM readings'), 2)
