import asyncio
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from buffer import Spool
from main import run_station
from test_metrics import config


class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, directory, permanent_failure):
        stop = asyncio.Event()
        calls = []
        station = config(
            state_dir=directory,
            queue_batches=1,
            shutdown_seconds=0.05,
            RECONNECT_DELAY_SEC=0.001,
            MAX_RECONNECT_DELAY_SEC=0.001,
        )

        async def stream(*args):
            # Partial historical records must form a single full source-time window.
            yield [(1000, -3)]
            yield [(1001, 3)]
            yield [(1010, 1)]
            await asyncio.Event().wait()

        async def persist(batch):
            calls.append(copy.deepcopy(batch))
            if permanent_failure or len(calls) == 1:
                if permanent_failure:
                    stop.set()
                raise OSError("destination unavailable")
            stop.set()
            return {"inserted": len(batch["readings"])}

        writer = AsyncMock()
        writer.persist.side_effect = persist
        with (
            patch("main.discover_station", AsyncMock()),
            patch("main.stream_samples", stream),
            patch("main.Writer", return_value=writer),
            patch("main.random.uniform", return_value=0),
        ):
            await asyncio.wait_for(run_station(station, stop), timeout=2)
        writer.close.assert_awaited_once()
        spool = Spool(Path(directory) / station.SENSOR_ID / "spool.json", 1)
        return calls, spool

    async def test_failed_write_retries_exact_batch_and_shutdown_drains(self):
        with tempfile.TemporaryDirectory() as directory:
            calls, spool = await self.exercise(directory, False)
            self.assertEqual(calls[0], calls[1])
            self.assertEqual(calls[0]["sample_count"], 2)
            self.assertEqual(calls[0]["readings"][0]["value"], 3)
            self.assertEqual(spool.state["pending"], [])
            # Shutdown must not seal an incomplete historical window at 1010.
            self.assertEqual(spool.state["watermark"], 1005)

    async def test_shutdown_deadline_retains_unacknowledged_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            calls, spool = await self.exercise(directory, True)
            self.assertEqual(len(spool.state["pending"]), 1)
            self.assertEqual(spool.state["pending"][0], calls[0])
