"""Small per-process cache that coalesces concurrent public snapshot reads."""

import asyncio
from collections import OrderedDict
from time import monotonic


class SnapshotCache:
    def __init__(self, ttl=5, capacity=16):
        self.ttl = ttl
        self.capacity = capacity
        self.generation = 0
        self.entries = OrderedDict()
        self.pending = {}

    def invalidate(self):
        # An older query may finish, but cannot refill the invalidated cache.
        self.generation += 1
        self.entries.clear()

    async def get(self, key, loader):
        generation = self.generation
        versioned_key = (generation, key)
        cached = self.entries.get(versioned_key)
        if cached is not None and cached[0] > monotonic():
            self.entries.move_to_end(versioned_key)
            return cached[1], cached[0]
        self.entries.pop(versioned_key, None)
        task = self.pending.get(versioned_key)
        if task is None:
            async def load():
                try:
                    value = await loader()
                    expires = monotonic() + self.ttl
                    if self.generation == generation:
                        self.entries[versioned_key] = (expires, value)
                        while len(self.entries) > self.capacity:
                            self.entries.popitem(last=False)
                    return value, expires
                finally:
                    self.pending.pop(versioned_key, None)

            task = asyncio.create_task(load())
            self.pending[versioned_key] = task
        # A disconnected client must not cancel work shared by other clients.
        return await asyncio.shield(task)


sensor_map_cache = SnapshotCache()
