import asyncio
import copy
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class StationTests(unittest.IsolatedAsyncioTestCase):
    def test_independent_station_configuration(self):
        configs = main.station_settings_list(main.settings)
        self.assertEqual(len(configs), 10)
        self.assertEqual(len({c.SENSOR_ID for c in configs}), 10)
        self.assertEqual(configs[0].SENSOR_ID, main.settings.SENSOR_ID)
        self.assertIsNone(configs[1].LATITUDE)
        self.assertEqual(configs[-1].SENSOR_ID, 'shake-sc342')
        self.assertEqual(main.settings.SHAKE_STATION, 'R498E')

    async def test_windows_do_not_mix_stations(self):
        configs = main.station_settings_list(main.settings)
        collectors = [main.ShakeCollector(config) for config in configs[:2]]
        for index, collector in enumerate(collectors):
            collector.sample_buffer = [(1000, -(index + 1)), (1001, index + 1)]
            collector.last_flush_time = asyncio.get_running_loop().time() - 100
            collector.push_telemetry = AsyncMock()
        await asyncio.gather(*(collector.flush_window_if_due() for collector in collectors))
        for index, collector in enumerate(collectors):
            readings = collector.push_telemetry.call_args.args[0]
            self.assertEqual({r['sensor_id'] for r in readings}, {configs[index].SENSOR_ID})
            self.assertEqual({r['metric'] for r in readings}, {'pgv', 'rms'})
            self.assertEqual(readings[0]['value'], index + 1)

    async def test_discovers_shz_and_actual_coordinates(self):
        config = copy.copy(main.settings)
        config.SHAKE_STATION = 'R5DFB'
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get.return_value = SimpleNamespace(
            text='#Network|Station\nAM|R5DFB|00|SHZ|50.09|8.29|190',
            raise_for_status=lambda: None,
        )
        httpx = SimpleNamespace(AsyncClient=lambda **kwargs: client)
        with patch.object(main, 'httpx', httpx):
            await main.discover_station(config)
        self.assertEqual(config.channel_identifier, 'AM.R5DFB.00.SHZ')
        self.assertEqual((config.LATITUDE, config.LONGITUDE), (50.09, 8.29))

    async def test_missing_channel_is_not_fabricated(self):
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get.return_value = SimpleNamespace(text='', raise_for_status=lambda: None)
        with patch.object(main, 'httpx', SimpleNamespace(AsyncClient=lambda **kwargs: client)):
            with self.assertRaises(ValueError):
                await main.discover_station(copy.copy(main.settings))

    def test_duplicate_station_codes_are_collected_once(self):
        config = copy.copy(main.settings)
        config.SHAKE_STATIONS = 'R498E,R498E,SC342'
        self.assertEqual(len(main.station_settings_list(config)), 2)

    async def test_rejects_other_station_trace(self):
        collector = main.ShakeCollector()
        with patch.object(main, 'HAS_OBSPY', True), patch.object(
            main, 'obspy_read', return_value=[SimpleNamespace(id='AM.R82E7.00.EHZ')], create=True
        ):
            collector.process_mseed_payload(b'packet')
        self.assertEqual(collector.sample_buffer, [])
        with patch.object(main, 'HAS_OBSPY', False):
            with self.assertRaises(RuntimeError):
                collector.process_mseed_payload(b'packet')
