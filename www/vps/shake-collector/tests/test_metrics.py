"""Collector regression tests; run with unittest discovery."""
import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class MetricTests(unittest.IsolatedAsyncioTestCase):
    async def test_window_uses_one_station_and_distinct_metrics(self):
        collector = main.ShakeCollector()
        collector.sample_buffer = [(1000.0, -3), (1001.0, 0), (1002.0, 3)]
        collector.last_flush_time = asyncio.get_running_loop().time() - 100
        collector.push_telemetry = AsyncMock()
        with patch.object(main, 'HAS_NUMPY', False), patch.object(
            main.settings, 'STORE_RAW_WAVEFORM', True
        ), patch.object(main.settings, 'RAW_DECIMATION_FACTOR', 1):
            await collector.flush_window_if_due()
        readings = collector.push_telemetry.call_args.args[0]
        self.assertEqual({r['sensor_id'] for r in readings}, {main.settings.SENSOR_ID})
        self.assertEqual([r['metric'] for r in readings],
                         ['pgv', 'rms', 'waveform', 'waveform', 'waveform'])
        self.assertEqual(readings[0]['value'], 3)
        self.assertEqual(readings[1]['value'], 2.45)
        self.assertEqual(readings[0]['timestamp'], readings[1]['timestamp'])
        self.assertEqual(collector.sample_buffer, [])

    async def test_registers_only_one_station(self):
        collector = main.ShakeCollector()
        collector.http_client = AsyncMock()
        collector.http_client.post.return_value.status_code = 201
        await collector._register_metadata_api()
        collector.http_client.post.assert_awaited_once()
        self.assertEqual(collector.http_client.post.call_args.kwargs['json']['sensor_id'],
                         main.settings.SENSOR_ID)


if __name__ == '__main__':
    unittest.main()
