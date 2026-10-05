from rail_geometry import RailGeometry
from crossings import estimate


def test_curved_track_drives_passage_instead_of_stop_chord():
    graph = RailGeometry([[1, 2, [8.4, 49.6], [8.405, 49.602]],
                          [2, 3, [8.405, 49.602], [8.41, 49.6]]])
    points, segments = graph.trajectory([[100, 49.6, 8.4], [300, 49.6, 8.41]])
    assert points[1][1:] == [49.602, 8.405]
    route = {'kind': 'train', 'trajectory': points, 'rail_segments': segments,
             'metadata': {'geometry_basis': 'stop_to_stop'}, 'delay': 0}
    site = {'latitude': 49.602, 'longitude': 8.405}
    assert estimate(site, [route], 200) == 2
    assert estimate(site, [route], 400) == 0


def test_disconnected_and_distant_stops_do_not_create_track():
    graph = RailGeometry([[1, 2, [8.4, 49.6], [8.401, 49.6]],
                          [3, 4, [8.41, 49.6], [8.411, 49.6]]])
    assert graph.route((49.6, 8.4), (49.6, 8.41)) is None
    assert graph.route((50, 9), (49.6, 8.401)) is None
    points = [[100, 49.6, 8.4], [200, 49.6, 8.41]]
    assert graph.trajectory(points) == (points, [])
