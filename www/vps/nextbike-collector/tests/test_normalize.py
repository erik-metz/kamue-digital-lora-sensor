"""Unit tests for Nextbike collector normalization and distance calculations."""

import math
from datetime import UTC, datetime

from normalize import haversine_meters, parse_nextbike_response

SAMPLE_PAYLOAD = {
    "countries": [
        {
            "name": "VRNnextbike",
            "domain": "vn",
            "cities": [
                {
                    "uid": 559,
                    "name": "Lampertheim",
                    "places": [
                        {
                            "uid": 10047180,
                            "lat": 49.598859,
                            "lng": 8.477685,
                            "name": "Bahnhof Lampertheim",
                            "number": 25590,
                            "spot": True,
                            "bikes": 4,
                            "bike_racks": 10,
                            "free_racks": 6,
                            "bike_numbers": ["430802", "430996", "430608", "431252"],
                            "bike_list": [
                                {
                                    "number": "430802",
                                    "bike_type": 196,
                                    "electric_lock": True,
                                    "pedelec_battery": 85,
                                    "state": "ok",
                                },
                                {
                                    "number": "430996",
                                    "bike_type": 196,
                                    "electric_lock": True,
                                    "pedelec_battery": None,
                                    "state": "ok",
                                },
                            ],
                        },
                        {
                            "uid": 74133907,
                            "lat": 49.601289,
                            "lng": 8.518047,
                            "name": "Neuschloß",
                            "number": 25595,
                            "spot": True,
                            "bikes": 3,
                            "bike_racks": 0,
                            "free_racks": 0,
                            "bike_numbers": ["431111", "432222", "433333"],
                            "bike_list": [],
                        },
                    ],
                },
                {
                    "uid": 195,
                    "name": "Mannheim",
                    "places": [
                        {
                            "uid": 999999,
                            "lat": 49.48,
                            "lng": 8.46,
                            "name": "Mannheim Hbf",
                            "bikes": 12,
                            "bike_racks": 20,
                            "free_racks": 8,
                        }
                    ],
                },
            ],
        }
    ]
}


def test_parse_nextbike_response_all_and_filtered():
    now = datetime(2026, 9, 15, 12, 0, 0, tzinfo=UTC)

    # Filtered to Lampertheim (559)
    stations = parse_nextbike_response(SAMPLE_PAYLOAD, allowed_city_ids={559}, now=now)
    assert len(stations) == 2

    st1 = stations[0]
    assert st1.station_uid == 10047180
    assert st1.sensor_id == "nextbike-10047180"
    assert st1.name == "VRNnextbike Bahnhof Lampertheim"
    assert st1.station_number == 25590
    assert st1.city_id == 559
    assert st1.city_name == "Lampertheim"
    assert math.isclose(st1.lat, 49.598859)
    assert math.isclose(st1.lng, 8.477685)
    assert st1.bikes == 4
    assert st1.bike_racks == 10
    assert st1.free_racks == 6
    assert st1.bike_numbers == ("430802", "430996", "430608", "431252")
    assert len(st1.bikes_detail) == 2
    assert st1.bikes_detail[0].bike_number == "430802"
    assert st1.bikes_detail[0].pedelec_battery == 85
    assert st1.ebikes_count == 1

    # Virtual station with 0 racks
    st2 = stations[1]
    assert st2.station_uid == 74133907
    assert st2.name == "VRNnextbike Neuschloß"
    assert st2.bikes == 3
    assert st2.bike_racks == 0
    assert st2.free_racks == 0

    # Without filter: includes Mannheim
    all_stations = parse_nextbike_response(SAMPLE_PAYLOAD, allowed_city_ids=None, now=now)
    assert len(all_stations) == 3


def test_haversine_distance():
    # Distance between Bahnhof Lampertheim (49.598859, 8.477685) and Neuschloß (49.601289, 8.518047)
    dist = haversine_meters(49.598859, 8.477685, 49.601289, 8.518047)
    # Approx 2.9 km
    assert 2800 < dist < 3100

    # Same point distance is 0
    assert haversine_meters(49.5, 8.5, 49.5, 8.5) == 0.0
