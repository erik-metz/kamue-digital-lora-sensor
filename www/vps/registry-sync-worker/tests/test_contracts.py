from datetime import UTC, datetime

import pytest
from contracts import energy_publication

NOW = datetime(2026, 1, 1, tzinfo=UTC)
BASE = {"contract_version": 1, "timestamp": NOW.isoformat(), "currentTotalPowerKw": 0}


def test_zero_is_measured_but_missing_fields_remain_unknown():
    data = energy_publication(BASE, NOW)
    assert data["currentTotalPowerMw"] == 0
    assert data["todayTotalEnergyKwh"] is None
    assert data["todayCo2AvoidedKg"] is None
    assert data["byTypeKw"] == {}
    assert data["facilities"] == []


@pytest.mark.parametrize("patch", [
    {"currentTotalPowerKw": True}, {"currentTotalPowerKw": "12"},
    {"currentTotalPowerKw": float("nan")}, {"currentTotalPowerKw": -1},
    {"currentTotalPowerMw": 2}, {"todayCo2AvoidedKg": 3},
    {"contract_version": 2}, {"currentTotalPowerKw": None},
    {"timestamp": "2026-01-01T00:00:00"},
])
def test_invalid_or_unproven_values_are_rejected(patch):
    with pytest.raises((ValueError, TypeError)):
        energy_publication({**BASE, **patch}, NOW)


def test_partial_facility_measurements_do_not_require_estimates():
    data = energy_publication({**BASE, "currentTotalPowerKw": None, "facilities": [
        {"id": "meter-1", "name": "Meter", "operator": "Operator", "municipality": "Biblis",
         "facilityType": "solar_pv", "currentPowerKw": 2.5}
    ]}, NOW)
    assert data["facilities"][0]["installedCapacityKw"] is None
    assert data["currentTotalPowerMw"] is None
