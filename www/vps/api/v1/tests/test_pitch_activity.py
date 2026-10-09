import unittest
from datetime import UTC, datetime, timedelta

from pitch_activity import bike_changes, crossing_changes, moving_counts


class ActivityTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime(2026, 10, 9, 12, tzinfo=UTC)
        self.end = self.start + timedelta(minutes=2)

    def crossing(self, seconds, value, quality='valid', entity='gate-a'):
        return {'entity_id': entity, 'timestamp': self.start+timedelta(seconds=seconds),
                'value': value, 'quality': quality}

    def test_crossings_count_completed_changes_not_polling_or_warning(self):
        rows = [self.crossing(t, v) for t, v in [(-5, 0), (5, 1), (15, 0),
            (25, 1), (35, 2), (45, 2), (55, 0)]]
        rows += [self.crossing(45, 2), self.crossing(65, None, 'missing'), self.crossing(75, 2)]
        result = crossing_changes(rows, self.start, self.end)
        self.assertEqual((result['opened'], result['closed']), (1, 1))
        self.assertTrue(result['partial'])

    def test_no_baseline_gaps_or_pre_talk_changes_are_not_events(self):
        rows = [self.crossing(-10, 2), self.crossing(-5, 0), self.crossing(40, 2),
                self.crossing(80, 0), self.crossing(130, 2)]
        result = crossing_changes(rows, self.start, self.end)
        self.assertEqual((result['opened'], result['closed']), (0, 0))
        self.assertTrue(result['partial'])
        self.assertFalse(crossing_changes([], self.start, self.end)['available'])

    def bike(self, seconds, value, roster=None, station='station-a'):
        return {'sensor_id': station, 'timestamp': self.start+timedelta(seconds=seconds),
                'value': value, 'bike_numbers': roster}

    def test_rosters_reveal_departure_and_return_with_unchanged_stock(self):
        rows = [self.bike(-10, 2, ['A', 'B']), self.bike(10, 2, ['B', 'C']),
                self.bike(20, 2, ['B', 'C']), self.bike(30, 0, [])]
        result = bike_changes(rows, [{'sensor_id': 'station-a', 'timestamp': self.end}], self.start, self.end)
        self.assertEqual((result['removed'], result['returned']), (3, 1))
        self.assertFalse(result['partial'])

    def test_inventory_fallback_uses_only_available_bikes_not_capacity(self):
        rows = [self.bike(-10, 5), self.bike(10, 2), self.bike(20, 4)]
        result = bike_changes(rows, [{'sensor_id': 'station-a', 'timestamp': self.end}], self.start, self.end)
        self.assertEqual((result['removed'], result['returned']), (3, 2))

    def test_missing_baseline_is_not_a_return_and_stale_source_is_partial(self):
        result = bike_changes([self.bike(10, 7)], [{'sensor_id': 'station-a', 'timestamp': self.start-timedelta(minutes=10)}], self.start, self.end)
        self.assertEqual((result['removed'], result['returned']), (0, 0))
        self.assertTrue(result['partial'])
        self.assertFalse(bike_changes([], [], self.start, self.end)['available'])

    def test_moving_fleet_is_fresh_unique_in_region_and_actually_moving(self):
        def vehicle(identity, kind, **kw):
            return {'id': identity, 'kind': kind, 'valid_until': (self.end+timedelta(seconds=30)).isoformat(),
                    'latitude': 49.65, 'longitude': 8.4, 'speed_kmh': 10, 'basis': 'observed', **kw}
        snapshot = {'ship_source': {'status': 'connected'}, 'positions': [
            vehicle('bus1', 'bus', basis='schedule_prediction'), vehicle('bus1', 'bus', basis='schedule_prediction'),
            vehicle('bus2', 'bus', speed_kmh=0), vehicle('ship1', 'ship'), vehicle('moored', 'ship', speed_kmh=0),
            vehicle('outside', 'ship', latitude=50), vehicle('expired', 'ship', valid_until=self.start.isoformat()),
            vehicle('predicted', 'ship', basis='schedule_prediction'), vehicle('train1', 'train')]}
        result = moving_counts(snapshot, self.end)
        self.assertEqual(result['bus']['count'], 1)
        self.assertEqual(result['bus']['estimated'], 1)
        self.assertEqual(result['train']['count'], 1)
        self.assertEqual(result['ship']['count'], 1)
        self.assertEqual(moving_counts({'ship_source': {'status': 'connected'}}, self.end)['ship']['count'], 0)
        self.assertIsNone(moving_counts({}, self.end)['ship']['count'])
