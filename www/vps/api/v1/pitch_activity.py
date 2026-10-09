"""Presentation activity: transitions rather than repeated status samples."""

import math
from datetime import datetime, timedelta


def crossing_changes(rows, start, end):
    opened = closed = 0
    previous = {}
    partial = False
    for row in sorted(rows, key=lambda r: (r['entity_id'], r['timestamp'])):
        identity, timestamp = row['entity_id'], row['timestamp']
        if timestamp > end:
            continue
        value = row['value'] if row.get('quality') == 'valid' else None
        old = previous.get(identity)
        if old and timestamp == old[0]:
            continue
        continuous = old and timestamp - old[0] <= timedelta(seconds=30)
        stable = old[1] if continuous else None
        if timestamp > start:
            partial |= not bool(continuous) or value not in (0, 1, 2)
            opened += int(stable == 2 and value == 0)
            closed += int(stable == 0 and value == 2)
        # "Closing soon" is still open. It must not count as a closure,
        # nor as an opening when a prediction is subsequently withdrawn.
        if value in (0, 2):
            stable = value
        elif value != 1:
            stable = None
        previous[identity] = (timestamp, stable)
    monitored = sum(t >= end - timedelta(seconds=30) for t, _ in previous.values())
    return {'opened': opened, 'closed': closed, 'monitored': monitored,
            'available': bool(rows), 'partial': partial or not monitored}


def bike_changes(rows, sources, start, end):
    removed = returned = 0
    previous = {}
    partial = False
    for row in sorted(rows, key=lambda r: (r['sensor_id'], r['timestamp'])):
        identity, timestamp = row['sensor_id'], row['timestamp']
        value = row['value']
        if timestamp > end or value < 0 or not float(value).is_integer():
            continue
        old = previous.get(identity)
        if old and timestamp == old['timestamp']:
            continue
        if timestamp > start:
            if old and timestamp - old['timestamp'] <= timedelta(minutes=20):
                old_roster, new_roster = set(old.get('bike_numbers') or []), set(row.get('bike_numbers') or [])
                # Complete rosters also reveal a departure and return between
                # polls when the station's total bike count stays unchanged.
                if len(old_roster) == old['value'] and len(new_roster) == value:
                    removed += len(old_roster - new_roster)
                    returned += len(new_roster - old_roster)
                else:
                    removed += int(max(0, old['value'] - value))
                    returned += int(max(0, value - old['value']))
            else:
                partial = True
        previous[identity] = row
    fresh = [s for s in sources if s['timestamp'] >= end - timedelta(minutes=5)]
    partial |= any(s['sensor_id'] not in previous for s in sources) or len(fresh) < len(sources)
    return {'removed': removed, 'returned': returned, 'stations': len(sources),
            'available': bool(rows and sources), 'partial': partial}


def moving_counts(snapshot, end):
    """Count unique fresh vehicles in motion; schedules remain explicitly estimated."""
    result = {}
    for kind in ('bus', 'train', 'ship'):
        vehicles = {}
        covered = False
        for position in snapshot.get('positions', []):
            if position.get('kind') != kind:
                continue
            try:
                valid_until = datetime.fromisoformat(position['valid_until'])
                speed = float(position.get('speed_kmh') or 0)
                latitude, longitude = float(position['latitude']), float(position['longitude'])
            except (ValueError, TypeError, KeyError):
                continue
            # Same Ried corridor used for the presentation. Ships include the
            # Rhine near Worms, Lampertheim, Biblis and Gernsheim.
            if valid_until <= end or not math.isfinite(speed) or not (49.5 <= latitude <= 49.85 and 8.25 <= longitude <= 8.65):
                continue
            if kind == 'ship' and position.get('basis') != 'observed':
                continue
            if position.get('basis') not in ('observed', 'schedule_prediction'):
                continue
            covered = True
            if speed <= 1:
                continue
            if position.get('id'):
                vehicles[position['id']] = position
        estimated = sum(p.get('basis') != 'observed' for p in vehicles.values())
        available = snapshot.get('ship_source', {}).get('status') == 'connected' if kind == 'ship' else covered
        result[kind] = {'count': len(vehicles) if available else None, 'estimated': estimated,
                        'available': available}
    return result
