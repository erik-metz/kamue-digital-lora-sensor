"""Live cycles must keep scheduling optional providers after core response archiving."""

import unittest
from unittest.mock import AsyncMock, patch

from config import Settings
from main import poll_cycle

CORE = {
    'pegel': {'currentMeasurement': {'timestamp': '2026-10-08T00:00:00Z', 'value': 250}},
    'weather': {'current': {'time': '2026-10-08T00:00', 'temperature_2m': 15}},
}


class ScheduledAcquisitionTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_cycle_acquires_all_enabled_scheduled_providers(self):
        conn = AsyncMock()
        conn.__aenter__.return_value = conn
        settings = Settings(db={}, enable_soil=True, enable_pollen=True, enable_gbif=True,
                            enable_discharge=True, enable_entsoe=True)
        adapters = ('soil', 'pollen', 'gbif', 'discharge', 'entsoe')
        normalized = {'soil': [], 'pollen': [],
                      'gbif': {'matched': 1, 'scanned': 1, 'source_truncated': False, 'skipped': 0},
                      'discharge': {'rows': []}, 'entsoe': []}
        from contextlib import ExitStack
        with ExitStack() as stack:
            stack.enter_context(patch('main.psycopg.AsyncConnection.connect', AsyncMock(return_value=conn)))
            fetch = stack.enter_context(patch('main.fetch', AsyncMock(return_value=CORE)))
            writer = stack.enter_context(patch('main.persist_environment_data', AsyncMock(return_value={})))
            acquisitions = {}
            for adapter in adapters:
                acquisitions[adapter] = stack.enter_context(patch('main.'+adapter+'.acquire', AsyncMock(
                    return_value={'run': '2026-10-08T00:00:00+00:00'})))
                stack.enter_context(patch('main.'+adapter+'.normalize', return_value=normalized[adapter]))
                stack.enter_context(patch('main.'+adapter+'.persist', AsyncMock(return_value=1)))
            result = await poll_cycle(object(), settings)
        fetch.assert_awaited_once()
        writer.assert_awaited_once()
        for adapter in adapters:
            self.assertEqual(acquisitions[adapter].await_count, 3 if adapter == 'entsoe' else 1)
            self.assertEqual(result[adapter]['status'], 'success')
        self.assertTrue(result['complete'])

    async def test_input_replay_never_contacts_scheduled_providers(self):
        conn = AsyncMock()
        conn.__aenter__.return_value = conn
        conn.execute.return_value.fetchone.return_value = (None,)
        settings = Settings(db={}, enable_soil=True, enable_pollen=True, enable_gbif=True,
                            enable_discharge=True, enable_entsoe=True)
        from contextlib import ExitStack
        with ExitStack() as stack:
            stack.enter_context(patch('main.psycopg.AsyncConnection.connect', AsyncMock(return_value=conn)))
            stack.enter_context(patch('main.persist_environment_data', AsyncMock(return_value={})))
            fetch = stack.enter_context(patch('main.fetch', AsyncMock()))
            acquisitions = [stack.enter_context(patch('main.'+adapter+'.acquire', AsyncMock()))
                            for adapter in ('soil', 'pollen', 'gbif', 'discharge', 'entsoe')]
            await poll_cycle(None, settings, raw=CORE)
        fetch.assert_not_awaited()
        for acquire in acquisitions:
            acquire.assert_not_awaited()
