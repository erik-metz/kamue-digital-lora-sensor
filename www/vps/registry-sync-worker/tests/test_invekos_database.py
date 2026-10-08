"""INVEKOS float persistence, unknown attributes and atomic snapshot publication."""

import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'api/v1'))
from db_support import DatabaseCase
from invekos import import_invekos
from measurement_migration import install


def response():
    return {'type': 'FeatureCollection', 'numberMatched': 2, 'numberReturned': 2,
            'features': [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [8.45, 49.64]},
                          'properties': {'id': 'TEST.1', 'declaredArea': 1.2345, 'declaredArea_uom': 'ha',
                                         'validFrom': '01.01.2025', 'validTo': '31.12.2025', 'organicFarming': None}},
                         {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [8.46, 49.65]},
                          'properties': {'id': 'TEST.2', 'declaredArea': None, 'organicFarming': False,
                                         'validFrom': '01.01.2025'}}]}


class InvekosDatabaseTests(DatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await install(self.conn)
        self.source = {'id': 'invekos-test', 'url': 'https://example.org/wfs', 'bbox': [49.54,8.33,49.75,8.58]}

    async def test_float_values_and_unknowns_publish_with_completed_evidence(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=response()))) as client:
            await import_invekos(self.conn, client, self.source)
        row = await (await self.conn.execute("SELECT status,item_count,item_count_unit,processed_at FROM collection_attempts")).fetchone()
        self.assertEqual(row[:3], ('success', 2, 'parcels'))
        self.assertIsNotNone(row[3])
        readings = await (await self.conn.execute("SELECT d.entity_id,d.metric,r.value,r.quality FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id ORDER BY 1,2")).fetchall()
        self.assertEqual(len(readings), 6)
        areas = [r for r in readings if r[1]=='area']
        self.assertAlmostEqual(float(areas[0][2]), 1.2345)
        self.assertEqual(areas[1][2:], (None, 'missing'))
        data = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/agriculture/parcels'")
        self.assertIsNone(data['parcels'][0]['organicFarming'])
        self.assertIsNone(data['parcels'][0]['sourceUpdatedAt'])
        self.assertEqual(data['summary']['reference_years'], [2025])
        self.assertEqual(data['summary']['organic_unknown_count'], 1)
        self.assertEqual(await self.scalar("SELECT count(*) FROM collected_datasets"), 2)

    async def test_truncated_or_invalid_refresh_preserves_published_snapshot(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=response()))) as client:
            await import_invekos(self.conn, client, self.source)
        before = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/agriculture/parcels'")
        broken = response(); broken['numberMatched'] = 3
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=broken))) as client:
            with self.assertRaises(ValueError):
                await import_invekos(self.conn, client, self.source)
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='environment/agriculture/parcels'"), before)
        self.assertEqual(await self.scalar('SELECT count(*) FROM readings'), 6)
