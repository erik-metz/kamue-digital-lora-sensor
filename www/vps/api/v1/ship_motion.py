"""Bounded display estimates; received AIS coordinates remain unchanged."""
import math
from datetime import datetime, timedelta


def display_position(position, now):
    if position.get('kind') != 'ship' or position.get('basis') != 'observed':
        return position
    try:
        speed = float(position['speed_kmh'])
        course = float(position['course_deg'])
        lat = float(position['latitude'])
        lon = float(position['longitude'])
        observed = datetime.fromisoformat(position['timestamp'])
        expiry = datetime.fromisoformat(position['valid_until'])
        age = (now-observed).total_seconds()
        if not all(math.isfinite(v) for v in (speed, course, lat, lon)) or not (
                .5 <= speed <= 40 and 0 <= course < 360 and -90 <= lat <= 90
                and -180 <= lon <= 180 and 0 <= age and now < expiry):
            return position
    except (KeyError, TypeError, ValueError, OverflowError):
        return position
    seconds = min(age, 300, 1000/(speed/3.6))
    distance = speed/3.6*seconds/6_371_000
    bearing = math.radians(course)
    latitude = math.radians(lat)
    projected_lat = math.asin(math.sin(latitude)*math.cos(distance)
                             + math.cos(latitude)*math.sin(distance)*math.cos(bearing))
    projected_lon = math.radians(lon)+math.atan2(
        math.sin(bearing)*math.sin(distance)*math.cos(latitude),
        math.cos(distance)-math.sin(latitude)*math.sin(projected_lat))
    return {**position, 'display_latitude': math.degrees(projected_lat),
            'display_longitude': math.degrees(projected_lon),
            'display_timestamp': (observed+timedelta(seconds=seconds)).isoformat(),
            'display_basis': 'course_speed_estimate'}
