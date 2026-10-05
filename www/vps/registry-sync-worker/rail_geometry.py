"""Route missing GTFS shapes on connected regional OSM passenger tracks."""
import heapq
import math
from collections import OrderedDict
from itertools import pairwise


def distance(a, b):
    return math.hypot((a[0]-b[0])*111320, (a[1]-b[1])*111320*math.cos(math.radians(a[0])))


class RailGeometry:
    def __init__(self, edges):
        self.nodes = {}
        self.graph = {}
        self.cache = OrderedDict()
        for left, right, a, b in edges:
            self.nodes[left] = (a[1], a[0])
            self.nodes[right] = (b[1], b[0])
            length = distance(self.nodes[left], self.nodes[right])
            self.graph.setdefault(left, {})[right] = length
            self.graph.setdefault(right, {})[left] = length

    def route(self, a, b):
        key = (tuple(a), tuple(b))
        if key in self.cache:
            return self.cache[key]
        result = self._route(a, b)
        self.cache[key] = result
        if len(self.cache) > 4096:
            self.cache.popitem(last=False)
        return result

    def _route(self, a, b):
        if not self.nodes:
            return None
        start = min(self.nodes, key=lambda n: distance(a, self.nodes[n]))
        end = min(self.nodes, key=lambda n: distance(b, self.nodes[n]))
        if max(distance(a, self.nodes[start]), distance(b, self.nodes[end])) > 250:
            return None
        if start == end:
            return None
        limit = distance(a, b)*1.8+500
        queue = [(0, start)]
        costs = {start: 0}
        previous = {}
        while queue:
            cost, node = heapq.heappop(queue)
            if cost != costs[node] or cost > limit:
                continue
            if node == end:
                path = [end]
                while path[-1] != start:
                    path.append(previous[path[-1]])
                return [self.nodes[n] for n in reversed(path)]
            for neighbour, length in self.graph[node].items():
                candidate = cost+length
                if candidate < costs.get(neighbour, float('inf')) and candidate <= limit:
                    costs[neighbour] = candidate
                    previous[neighbour] = node
                    heapq.heappush(queue, (candidate, neighbour))
        return None

    def trajectory(self, points):
        output = []
        supported = []
        for left, right in pairwise(points):
            output.append(left)
            if right[0] <= left[0] or distance(left[1:], right[1:]) < 20:
                continue
            path = self.route(left[1:], right[1:])
            if not path:
                continue
            lengths = [0]
            for a, b in pairwise(path):
                lengths.append(lengths[-1]+distance(a, b))
            if not lengths[-1]:
                continue
            segment = [[left[0]+(right[0]-left[0])*length/lengths[-1], *point]
                       for length, point in zip(lengths, path)]
            supported.append(segment)
            output.extend(segment[1:-1])
        if points:
            output.append(points[-1])
        return output, supported


_geometry_key = None
_geometry = None


async def load_geometry(conn, now):
    global _geometry_key, _geometry
    row = await (await conn.execute("""SELECT payload_sha256,data FROM collected_datasets
        WHERE dataset='map/layers/crossings' AND expires_at>%s ORDER BY fetched_at DESC LIMIT 1""", (now,))).fetchone()
    if not row:
        return None
    if row[0] != _geometry_key:
        _geometry_key = row[0]
        _geometry = RailGeometry(row[1].get('rail_edges', []))
    return _geometry
