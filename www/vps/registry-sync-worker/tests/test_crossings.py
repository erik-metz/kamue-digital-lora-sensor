from crossings import barrier_sites, estimate, passage_times

SITE = {
    "id": "gate",
    "name": "Gate",
    "barrier": "half",
    "latitude": 49.64,
    "longitude": 8.45,
}


def route(pass_at=1000, **changes):
    return {
        "kind": "train",
        "trajectory": [[pass_at - 200, 49.63, 8.45], [pass_at + 200, 49.65, 8.45]],
        "metadata": {"geometry_basis": "provider_shape"},
        "delay": 0,
        **changes,
    }


def test_barrier_window_opens_closes_and_clears_with_warning():
    assert passage_times(route()["trajectory"], SITE) == [1000]
    for timestamp, state in [
        (879, 0),
        (880, 1),
        (939, 1),
        (940, 2),
        (1000, 2),
        (1030, 2),
        (1031, 0),
    ]:
        assert estimate(SITE, [route()], timestamp) == state


def test_delay_direction_and_multiple_trains_keep_barrier_closed():
    assert estimate(SITE, [route(delay=120)], 1000) == 1
    assert estimate(SITE, [route(delay=120)], 1060) == 2
    reverse = route(
        trajectory=list(reversed([[1200, 49.63, 8.45], [800, 49.65, 8.45]]))
    )
    assert estimate(SITE, [reverse], 1000) == 2
    assert estimate(SITE, [route(), route(pass_at=1080)], 1031) == 2


def test_no_suitable_train_is_unknown_not_open():
    for routes in [
        [],
        [route(kind="bus")],
        [route(kind="waste")],
        [route(metadata={"geometry_basis": "stop_to_stop"})],
        [route(trajectory=[[800, 49.63, 8.46], [1200, 49.65, 8.46]])],
        [route(trajectory=[[800, 49.64, 8.46], [1200, 49.64, 8.46]])],
    ]:
        assert estimate(SITE, routes, 1000) is None


def test_only_confirmed_barriers_and_nearby_track_nodes_are_sites():
    def feature(id, lon, barrier="half", name="Gate"):
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, 49.64]},
            "properties": {"id": id, "name": name, "barrier": barrier},
        }

    sites = barrier_sites(
        [
            feature("a", 8.45),
            feature("b", 8.4501),
            feature("c", 8.451),
            feature("d", 8.45, "no"),
            feature("e", 8.45, "nicht erfasst"),
            feature("f", 8.45, name="Other street"),
        ]
    )
    assert [s["members"] for s in sites] == [["a", "b"], ["c"], ["f"]]


def test_train_dwelling_on_the_barrier_keeps_it_closed():
    stopped = route(trajectory=[[800, 49.64, 8.45], [1200, 49.64, 8.45]])
    assert estimate(SITE, [stopped], 1000) == 2
    assert estimate(SITE, [stopped], 1230) == 2
    assert estimate(SITE, [stopped], 1231) == 0
