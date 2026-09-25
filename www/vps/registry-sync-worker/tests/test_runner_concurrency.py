import asyncio
import unittest
from unittest.mock import patch

from runner import bounded_collect


class ConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_jobs_respect_connection_budget_and_gtfs_memory_gate(self):
        active = gtfs_active = peak = gtfs_peak = 0

        async def fake_collect(source, settings):
            nonlocal active, gtfs_active, peak, gtfs_peak
            active += 1
            gtfs_active += source['adapter'] == 'gtfs'
            peak = max(peak, active)
            gtfs_peak = max(gtfs_peak, gtfs_active)
            await asyncio.sleep(0.001)
            active -= 1
            gtfs_active -= source['adapter'] == 'gtfs'
            return {'status': 'success'}

        slots, gtfs_slot = asyncio.Semaphore(2), asyncio.Semaphore(1)
        with patch('runner.collect', side_effect=fake_collect):
            results = await asyncio.gather(*(
                bounded_collect({'adapter': adapter}, None, slots, gtfs_slot)
                for adapter in ['gtfs', 'gtfs'] + ['json'] * 20
            ))
        self.assertEqual(peak, 2)
        self.assertEqual(gtfs_peak, 1)
        self.assertEqual(len(results), 22)

    async def test_failure_releases_slots(self):
        slots, gtfs_slot = asyncio.Semaphore(1), asyncio.Semaphore(1)
        with patch('runner.collect', side_effect=RuntimeError), self.assertRaises(RuntimeError):
            await bounded_collect({'adapter': 'gtfs'}, None, slots, gtfs_slot)
        with patch('runner.collect', return_value={'status': 'success'}):
            result = await asyncio.wait_for(
                bounded_collect({'adapter': 'gtfs'}, None, slots, gtfs_slot), 1
            )
        self.assertEqual(result['status'], 'success')
