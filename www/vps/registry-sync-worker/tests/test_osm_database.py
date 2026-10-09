import sys
import tempfile
from pathlib import Path

import httpx
import osmium

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tests'))
from db_support import DatabaseCase
from osm_addresses import import_addresses


class AddressDatabaseTests(DatabaseCase):
    async def test_extract_is_published_and_bad_refresh_preserves_inventory(self):
        source = {'id':'osm-test', 'url':'https://example.org/region.osm.pbf',
                  'municipalities':['Biblis'], 'bbox':[49.55,8.3,49.8,8.65]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.osm.pbf'
            with osmium.SimpleWriter(str(path)) as writer:
                writer.add_node(osmium.osm.mutable.Node(id=1, location=(8.4,49.6), tags={
                    'addr:city':'Biblis','addr:street':'Teststraße','addr:housenumber':'8A'}))
            body = path.read_bytes()
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200,content=body))) as client:
            await import_addresses(self.conn, client, source)
        before = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/address-inventory'")
        crossings = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='map/layers/crossings'")
        self.assertEqual(crossings['type'], 'FeatureCollection')
        self.assertEqual(before['elements'][0]['tags']['addr:city'], 'Biblis')
        self.assertEqual(await self.scalar('SELECT count(*) FROM collected_payloads'), 1)
        self.assertEqual(await self.scalar('SELECT status FROM collection_attempts'), 'success')
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: self.fail('Fresh inventory must survive worker restart without another download'))) as client:
            await import_addresses(self.conn, client, source)
        # A fresh numeric-only inventory must be refreshed after the parser upgrade.
        await self.conn.execute("UPDATE collected_datasets SET data=data-'address_inventory_version' WHERE dataset='waste/address-inventory'")
        downloads = []
        def updated_extract(request):
            downloads.append(True)
            return httpx.Response(200, content=body)
        async with httpx.AsyncClient(transport=httpx.MockTransport(updated_extract)) as client:
            await import_addresses(self.conn, client, source)
        self.assertEqual(downloads, [True])
        before = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/address-inventory'")
        self.assertEqual(before['address_inventory_version'], 2)
        self.assertEqual(before['elements'][0]['tags']['addr:housenumber'], '8A')
        await self.conn.execute("UPDATE collected_datasets SET fetched_at=NOW()-INTERVAL '8 days'")
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200,content=b'broken'))) as client:
            with self.assertRaises(RuntimeError):
                await import_addresses(self.conn, client, source)
        self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='waste/address-inventory'"),before)
