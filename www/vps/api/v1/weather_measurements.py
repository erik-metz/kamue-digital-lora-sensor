"""Replay archived weather responses without inventing a model issue time.

The provider's current.time is the valid time. A later receipt can correct that
same time; write_measurement retains the previous row in reading_revisions.
This replay does not resolve or delete ambiguous legacy sensor_data rows.
"""

import hashlib
import json
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb


def decode_weather(body, digest):
    body = bytes(body)
    if hashlib.sha256(body).hexdigest() != digest:
        raise ValueError("Weather payload checksum mismatch")
    data = json.loads(body, parse_float=Decimal, parse_int=Decimal)
    current = data['current']
    stamp = datetime.fromisoformat(current['time'])
    if stamp.tzinfo is None:
        # Do not silently assume UTC for a source without a timezone.
        stamp = stamp.replace(tzinfo=ZoneInfo(data['timezone']))
    units = data['current_units']
    metrics = []
    for field, metric, unit in (
        ('temperature_2m', 'temperature', '°C'),
        ('relative_humidity_2m', 'relative_humidity', '%'),
        ('precipitation', 'precipitation', 'mm'),
    ):
        if units.get(field) != unit:
            raise ValueError(f"Unexpected weather unit for {field}")
        value = current[field]
        if value is not None and (not isinstance(value, Decimal) or not value.is_finite()):
            raise ValueError(f"Invalid weather value for {field}")
        if value is not None and metric == 'relative_humidity' and not 0 <= value <= 100:
            raise ValueError('Humidity outside 0–100 percent')
        if value is not None and metric == 'precipitation' and value < 0:
            raise ValueError('Negative precipitation')
        metrics.append((metric, unit, value))
    return stamp, metrics


async def replay_weather_receipt(conn, attempt_id, received_at, digest, body):
    stamp, metrics = decode_weather(body, digest)
    await conn.execute("""INSERT INTO entities(id,name,entity_type,metadata)
        VALUES ('sensor:weather-dwd-ried','Weather model Ried','weather_model',
            '{"provider":"Open-Meteo","basis":"model"}') ON CONFLICT(id) DO NOTHING""")
    provenance = Jsonb({'payload_sha256': digest, 'collection_attempt_id': attempt_id,
                       'time_basis': 'provider_valid_time', 'model_issue_time': None})
    for metric, unit, value in metrics:
        await conn.execute("""SELECT write_measurement(
            'sensor:weather-dwd-ried',%s,%s,'environment-weather','model','{}',
            %s,%s,%s,%s,%s,NULL,NULL,%s)""",
            (metric, unit, stamp, value, received_at, provenance,
             'missing' if value is None else 'valid',
             'unknown' if metric == 'precipitation' else 'instantaneous'))
