"""Strict decoders for the authorized public map's current binary format."""
import json
import re
import struct
from datetime import UTC, datetime

from collector import BBOX, decode, number, text

SOURCE = 'rhein-map'


def map_vessels(body, zoom=10):
    """Discovery only: map marker ages are coarse, never observation timestamps."""
    if len(body) < 16 or body[0] != 67 or zoom > 13:
        raise ValueError('Unsupported map frame')
    header = struct.unpack_from('>H', body, 1)[0]
    if header != 12:
        raise ValueError('Unsupported map header')
    selected = struct.unpack_from('>i', body, header)[0]
    offset = header + 4
    rows = []
    while offset < len(body):
        if len(rows) >= 10000 or len(body)-offset < 16:
            raise ValueError('Truncated or oversized map')
        flags, mmsi, lat, lon = struct.unpack_from('>hiii', body, offset)
        offset += 14
        if mmsi == selected:
            offset += 6  # Selected marker carries extra speed/course fields.
        if offset+2 > len(body):
            raise ValueError('Truncated marker')
        age, length = struct.unpack_from('>bB', body, offset)
        offset += 2
        if offset+length > len(body):
            raise ValueError('Truncated name')
        name = body[offset:offset+length].decode('latin1')
        offset += length
        if mmsi == selected:
            offset += 4
        if flags & 2:
            offset += 2  # SAR altitude; SAR is not a ship.
        if offset > len(body):
            raise ValueError('Truncated marker fields')
        lat, lon = lat/600000, lon/600000
        south, west, north, east = BBOX
        if not flags & 2 and re.fullmatch(r'[1-9]\d{8}', str(mmsi)) and south <= lat <= north and west <= lon <= east:
            rows.append({'mmsi': str(mmsi), 'name': text(name), 'latitude': lat, 'longitude': lon, 'age_code': age})
    return list({r['mmsi']: r for r in rows}.values())


def position(location_body, detail_body, mmsi, now=None):
    """Pair location with matching provider UTC time; never use fetch time as AIS time."""
    if len(location_body) < 24 or location_body[0] & 2:
        raise ValueError('Unsupported location')
    length = location_body[11]
    if len(location_body) != 24+length:
        raise ValueError('Unsupported location length')
    _, lon, lat = struct.unpack_from('>hii', location_body, 1)
    stamp = struct.unpack_from('>I', location_body, len(location_body)-4)[0]
    details = json.loads(detail_body)
    if not isinstance(details, dict) or details.get('ts') != stamp:
        raise ValueError('Location and details timestamps differ')
    speed = number(details.get('ss'), 0, 102.2)
    course = number(details.get('cu'), 0, 359.9)
    event = {'MessageType': 'PositionReport', 'MetaData': {'MMSI': mmsi,
        'ShipName': text(details.get('name')), 'time_utc': datetime.fromtimestamp(stamp, UTC).isoformat()},
        'Message': {'PositionReport': {'Latitude': lat/600000, 'Longitude': lon/600000,
            'Sog': speed, 'Cog': course}}}
    sample = decode(event, now)
    if sample:
        for key, value in [('length_m', number(details.get('al'), 1, 500)),
                           ('beam_m', number(details.get('aw'), 1, 126)),
                           ('destination', text(details.get('dest')))]:
            if value is not None and value != '':
                sample['details'][key] = value
    return sample
