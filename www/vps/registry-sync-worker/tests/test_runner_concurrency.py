import asyncio
import unittest
from unittest.mock import patch

from runner import bounded_collect, source_loop


class ConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_budget_review_uses_daily_retry_but_partial_crawls_resume_quickly(self):
        for override, expected in [(86400, 86400), (300, 300)]:
            stop = asyncio.Event()
            delays = []

            async def sleep(event, seconds, delays=delays):
                delays.append(seconds)
                event.set()

            with patch('runner.bounded_collect', return_value={'status': 'partial'}), \
                 patch('runner.sleep_until_stop', side_effect=sleep), \
                 patch('runner.random.uniform', return_value=1):
                await source_loop({'interval_seconds': 86400, 'partial_retry_seconds': override},
                                  None, stop, asyncio.Semaphore(1), asyncio.Semaphore(1))
            self.assertEqual(delays, [expected])

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
