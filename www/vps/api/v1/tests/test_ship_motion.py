import unittest
from datetime import UTC, datetime, timedelta

from ship_motion import display_position


class ShipMotionTests(unittest.TestCase):
    def setUp(self):
        self.stamp = datetime(2026, 10, 6, tzinfo=UTC)
        self.ship = {'kind': 'ship', 'basis': 'observed', 'latitude': 49.6, 'longitude': 8.4,
                     'speed_kmh': 18, 'course_deg': 0, 'timestamp': self.stamp.isoformat(),
                     'valid_until': (self.stamp+timedelta(minutes=10)).isoformat()}

    def test_moves_north_and_preserves_observation(self):
        result = display_position(self.ship, self.stamp+timedelta(seconds=10))
        self.assertAlmostEqual(result['display_latitude']-49.6, 50/111195, places=7)
        self.assertEqual(result['latitude'], 49.6)
        self.assertEqual(result['timestamp'], self.ship['timestamp'])
        self.assertNotIn('display_basis', self.ship)

    def test_course_east_and_south(self):
        east = display_position({**self.ship, 'course_deg': 90}, self.stamp+timedelta(seconds=10))
        self.assertGreater(east['display_longitude'], 8.4)
        south = display_position({**self.ship, 'course_deg': 180}, self.stamp+timedelta(seconds=10))
        self.assertLess(south['display_latitude'], 49.6)

    def test_caps_distance_and_time_without_restarting_on_cached_reports(self):
        early = display_position(self.ship, self.stamp+timedelta(seconds=200))
        late = display_position(self.ship, self.stamp+timedelta(seconds=500))
        self.assertEqual(early, late)
        slow = {**self.ship, 'speed_kmh': 3.6}
        self.assertEqual(display_position(slow, self.stamp+timedelta(seconds=300)),
                         display_position(slow, self.stamp+timedelta(seconds=500)))

    def test_invalid_stationary_expired_and_other_vehicles_stay_observed(self):
        for changes in ({'speed_kmh': 0}, {'speed_kmh': float('nan')}, {'course_deg': 360},
                        {'course_deg': None}, {'kind': 'aircraft'}, {'speed_kmh': 100},
                        {'timestamp': 'invalid'}):
            ship = {**self.ship, **changes}
            self.assertIs(display_position(ship, self.stamp+timedelta(seconds=10)), ship)
        self.assertIs(display_position(self.ship, self.stamp-timedelta(seconds=1)), self.ship)
        self.assertIs(display_position(self.ship, self.stamp+timedelta(minutes=10)), self.ship)
