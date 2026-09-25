"""Collect regional address geometry from a disk-backed OSM extract, without Overpass."""
import asyncio
import hashlib
import json
import tempfile
from datetime import UTC, datetime

from publications import publish


def extract_addresses(path, source):
    import osmium
    cities = set(source['municipalities'])
    south, west, north, east = source['bbox']
    ways = {}
    needed = set()
    coordinates = {}
    elements = []

    def tags_for(obj):
        tags = dict(obj.tags)
        if tags.get('addr:city') in cities and tags.get('addr:street') and tags.get('addr:housenumber', '').isdigit():
            return {k: tags[k] for k in ('addr:city', 'addr:street', 'addr:housenumber')}
        return None

    def inside(lat, lon):
        return south <= lat <= north and west <= lon <= east

    class Ways(osmium.SimpleHandler):
        def way(self, obj):
            tags = tags_for(obj)
            if tags:
                refs = [node.ref for node in obj.nodes]
                ways[obj.id] = (tags, refs)
                needed.update(refs)

    class Nodes(osmium.SimpleHandler):
        def node(self, obj):
            if not obj.location.valid():
                return
            lat, lon = obj.location.lat, obj.location.lon
            if obj.id in needed:
                coordinates[obj.id] = (lat, lon)
            if inside(lat, lon):
                tags = tags_for(obj)
                if tags:
                    elements.append({'type': 'node', 'id': obj.id, 'lat': lat, 'lon': lon, 'tags': tags})

    # Two streaming passes retain only nodes used by address-tagged local ways.
    # No all-Hessen node-location index is needed.
    Ways().apply_file(str(path))
    Nodes().apply_file(str(path))
    for identity, (tags, refs) in ways.items():
        if not refs or any(ref not in coordinates for ref in refs):
            continue
        points = [coordinates[ref] for ref in refs]
        lat = (min(p[0] for p in points) + max(p[0] for p in points)) / 2
        lon = (min(p[1] for p in points) + max(p[1] for p in points)) / 2
        if inside(lat, lon):
            elements.append({'type': 'way', 'id': identity, 'center': {'lat': lat, 'lon': lon}, 'tags': tags})
    if not elements:
        raise ValueError('OSM extract contains no matching regional addresses')
    return {'elements': elements, 'coverage': 'OSM address nodes and ways; not a complete address register'}


async def import_addresses(conn, client, source):
    cursor = await conn.execute(
        """SELECT 1 FROM collected_datasets WHERE dataset='waste/address-inventory'
        AND source_id=%s AND source_url=%s AND expires_at>NOW()
        AND fetched_at>NOW()-make_interval(secs => %s)""",
        (source['id'], source['url'], source.get('interval_seconds', 604800)))
    fresh = await cursor.fetchone()
    await conn.commit()
    if fresh:
        return 'success'
    checksum = hashlib.sha256()
    size = 0
    with tempfile.NamedTemporaryFile(suffix='.osm.pbf') as file:
        async with client.stream('GET', source['url']) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(256 * 1024):
                size += len(chunk)
                if size > 512 * 1024 * 1024:
                    raise ValueError('OSM extract exceeds 512 MiB download limit')
                checksum.update(chunk)
                file.write(chunk)
        file.flush()
        inventory = await asyncio.to_thread(extract_addresses, file.name, source)
    now = datetime.now(UTC)
    inventory.update(source_url=source['url'], extract_sha256=checksum.hexdigest(), fetched_at=now.isoformat())
    # Persist the exact regional extraction and parent-file checksum, not a
    # second permanent copy of the hundreds-of-MB statewide download.
    body = json.dumps(inventory, sort_keys=True).encode()
    digest = hashlib.sha256(body).hexdigest()
    async with conn.transaction():
        await conn.execute('INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING',
                           (digest, body, 'application/vnd.openriedsens.osm-address-extract+json'))
        await publish(conn, source, 'waste/address-inventory', inventory, digest, now)
        await conn.execute("INSERT INTO collection_attempts(source_id,payload_sha256,status) VALUES (%s,%s,'success')", (source['id'], digest))
    await conn.commit()
