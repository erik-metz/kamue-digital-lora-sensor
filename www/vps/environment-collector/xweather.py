"""Validate Xweather lightning pulses; zero is valid only for a confirmed full window."""

import math
from datetime import datetime

from normalize import parse_blitzortung


def validate_response(data):
    if not isinstance(data, dict) or data.get('success') is not True:
        raise ValueError('Xweather application error')
    error = data.get('error')
    if error and (not isinstance(error, dict) or error.get('code') != 'warn_no_data'):
        raise ValueError('Unexpected Xweather warning')
    rows = data.get('response')
    if rows is None and error and error.get('code') == 'warn_no_data':
        rows = []
    if not isinstance(rows, list) or len(rows) >= 1000:
        raise ValueError('Invalid or truncated Xweather response')
    return rows


def normalize_lightning(data, window_end, lat, lon, radius):
    end = datetime.fromisoformat(window_end)
    if end.tzinfo is None:
        raise ValueError('Xweather window needs timezone')
    strikes = []
    seen = set()
    for row in validate_response(data):
        identifier = row['id']
        if identifier in seen:
            continue
        seen.add(identifier)
        location, observation = row['loc'], row['ob']
        stamp = observation['timestamp']
        values = (location['lat'], location['long'], stamp)
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
            raise ValueError('Invalid Xweather pulse coordinates or timestamp')
        if not -90 <= values[0] <= 90 or not -180 <= values[1] <= 180:
            raise ValueError('Xweather coordinates out of bounds')
        if not end.timestamp()-300 <= stamp <= end.timestamp():
            raise ValueError('Xweather pulse outside requested window')
        current = observation['pulse'].get('peakamp')
        if current is not None and (type(current) not in (int, float) or not math.isfinite(current)):
            raise ValueError('Invalid Xweather peak current')
        strikes.append({'lat': values[0], 'lon': values[1], 'time': stamp,
                        'current': current/1000 if current is not None else None})
    item = parse_blitzortung(strikes, lat, lon, radius, now=end, max_age_seconds=300)
    item.timestamp = end
    item.source = 'xweather'
    item.period_seconds = 300
    return item
