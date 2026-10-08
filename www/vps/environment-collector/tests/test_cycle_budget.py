"""The complete environment cycle has its own bounded, configurable time budget."""

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from config import Settings
from health import read_status
from runtime import run


class CycleBudgetTests(unittest.IsolatedAsyncioTestCase):
    async def test_configured_budget_interrupts_slow_cycle_without_false_success(self):
        async def slow_cycle(*args, **kwargs):
            await asyncio.sleep(.1)
            return {'complete': True}

        with tempfile.TemporaryDirectory() as directory:
            settings = Settings(db={}, state_dir=Path(directory), cycle_timeout_seconds=.01)
            with self.assertRaises(TimeoutError):
                await run(settings, slow_cycle, 'test', once=True)
            self.assertNotEqual(read_status(Path(directory)/'status.json').get('status'), 'healthy')

    async def test_default_budget_allows_cycle_to_finish(self):
        async def successful_cycle(*args, **kwargs):
            await asyncio.sleep(.02)
            return {'complete': True}

        with tempfile.TemporaryDirectory() as directory:
            settings = Settings(db={}, state_dir=Path(directory))
            await run(settings, successful_cycle, 'test', once=True)
            self.assertEqual(read_status(Path(directory)/'status.json')['status'], 'healthy')

    def test_invalid_budget_is_rejected(self):
        for value in ('0', '-1', 'nan', 'inf', '3601'):
            with self.subTest(value=value), patch.dict('os.environ', {'ENVIRONMENT_CYCLE_TIMEOUT_SECONDS': value}), self.assertRaises(ValueError):
                Settings.from_env()
