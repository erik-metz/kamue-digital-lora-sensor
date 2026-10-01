import asyncio
import unittest

from snapshot_cache import SnapshotCache


class SnapshotCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_requests_share_one_load(self):
        cache = SnapshotCache()
        calls = 0

        async def load():
            nonlocal calls
            calls += 1
            await asyncio.sleep(0)
            return b'snapshot'

        responses = await asyncio.gather(*(cache.get('map', load) for _ in range(200)))
        self.assertEqual(calls, 1)
        self.assertTrue(all(r[0] == b'snapshot' for r in responses))

    async def test_visibility_invalidation_cannot_be_undone_by_inflight_query(self):
        cache = SnapshotCache()
        started = asyncio.Event()
        finish = asyncio.Event()

        async def old_load():
            started.set()
            await finish.wait()
            return b'old'

        old = asyncio.create_task(cache.get('map', old_load))
        await started.wait()
        cache.invalidate()

        async def new_load():
            return b'hidden'

        self.assertEqual((await cache.get('map', new_load))[0], b'hidden')
        finish.set()
        await old
        self.assertEqual((await cache.get('map', old_load))[0], b'hidden')

    async def test_errors_are_retried_and_expired_snapshots_reloaded(self):
        cache = SnapshotCache(ttl=0)
        calls = 0

        async def load():
            nonlocal calls
            calls += 1
            if calls == 1:
                raise ValueError('database unavailable')
            return calls

        with self.assertRaises(ValueError):
            await cache.get('map', load)
        self.assertEqual((await cache.get('map', load))[0], 2)
        self.assertEqual((await cache.get('map', load))[0], 3)

    async def test_cancelled_client_does_not_cancel_shared_load(self):
        cache = SnapshotCache()
        started = asyncio.Event()
        finish = asyncio.Event()

        async def load():
            started.set()
            await finish.wait()
            return b'result'

        first = asyncio.create_task(cache.get('map', load))
        await started.wait()
        second = asyncio.create_task(cache.get('map', load))
        first.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await first
        finish.set()
        self.assertEqual((await second)[0], b'result')
