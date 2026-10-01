"""Read cutover does not rewrite ingestion or silently accept invalid modes."""

import unittest
from unittest.mock import patch

from measurement_reads import read_sql


class MeasurementReadTests(unittest.TestCase):
    def test_read_mode_selects_only_explicit_compatibility_relations(self):
        query = 'SELECT * FROM sensor_data d JOIN sensor_metadata m ON m.id=d.sensor_id'
        with patch.dict('os.environ', {'MEASUREMENT_READ_MODE': 'legacy'}):
            self.assertEqual(read_sql(query), query)
        with patch.dict('os.environ', {'MEASUREMENT_READ_MODE': 'core'}):
            self.assertEqual(read_sql(query), 'SELECT * FROM core_sensor_data d JOIN core_sensor_metadata m ON m.id=d.sensor_id')
            with self.assertRaises(ValueError):
                read_sql('DELETE FROM sensor_data')
        with patch.dict('os.environ', {'MEASUREMENT_READ_MODE': 'typo'}), self.assertRaises(RuntimeError):
            read_sql(query)
