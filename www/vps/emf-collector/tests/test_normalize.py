import pytest
from normalize import normalize_site
from client import EmfSiteDetails, AntennaDetail


def test_normalize_site_without_details():
    raw_pos = {
        "fID": 9999,
        "Titel": "123456",
        "Lat": 49.654,
        "Lng": 8.543,
        "sonderseite": False,
    }
    site = normalize_site(raw_pos, None)
    assert site.entity_id == "bnetza:emf:9999"
    assert site.fid == 9999
    assert site.latitude == 49.654
    assert site.longitude == 8.543
    assert site.stob_nr == "123456"
    assert site.name == "Funkanlage STOB 123456"
    assert site.antenna_count == 0
    assert site.max_height_m is None


def test_normalize_site_with_details():
    raw_pos = {
        "fID": 8812,
        "Titel": "200528",
        "Lat": 49.594,
        "Lng": 8.468,
    }
    details = EmfSiteDetails(
        fid=8812,
        stob_nr="200528",
        stob_date="1.12.2025",
        method_stob="feldtheoretisch",
        providers=["Telekom", "Vodafone"],
        antennas=[
            AntennaDetail(
                type_name="Mobilfunk",
                height_m=24.5,
                direction_deg=90.0,
                safety_distance_h_m=5.2,
                safety_distance_v_m=1.2,
            ),
            AntennaDetail(
                type_name="Mobilfunk",
                height_m=28.0,
                direction_deg=180.0,
                safety_distance_h_m=6.5,
                safety_distance_v_m=1.8,
            ),
        ],
    )
    site = normalize_site(raw_pos, details)
    assert site.entity_id == "bnetza:emf:8812"
    assert site.method_stob == "feldtheoretisch"
    assert "Telekom" in site.providers
    assert site.antenna_count == 2
    assert site.max_height_m == 28.0
    assert site.max_safety_distance_h_m == 6.5
    assert site.max_safety_distance_v_m == 1.8
    assert site.stob_date.year == 2025
    assert site.stob_date.month == 12
    assert site.stob_date.day == 1
