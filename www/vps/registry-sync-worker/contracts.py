"""Versioned publication validation; unknown measurements remain null."""
import math
from datetime import UTC, datetime, timedelta

ENERGY_CONTRACT_VERSION = 1


def measurement(value, field):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{field} must be a number or null")
    if not math.isfinite(value) or value < 0:
        raise ValueError(f"{field} must be finite and nonnegative")
    return value


def energy_publication(data, source_time):
    """Do not require CO2 estimates or capacity to accept an actual meter reading."""
    if not isinstance(data, dict) or data.get("contract_version") != ENERGY_CONTRACT_VERSION:
        raise ValueError("Unsupported energy contract version")
    timestamp = datetime.fromisoformat(data["timestamp"])
    if timestamp.tzinfo is None or timestamp != source_time or timestamp > datetime.now(UTC) + timedelta(minutes=5):
        raise ValueError("Energy timestamp must match publication observation time")
    result = dict(data)
    for key in ("totalInstalledCapacityKw", "currentTotalPowerKw", "currentTotalPowerMw",
                "todayTotalEnergyKwh", "todayCo2AvoidedKg"):
        result[key] = measurement(data.get(key), key)
    kw, mw = result["currentTotalPowerKw"], result["currentTotalPowerMw"]
    if kw is not None and mw is not None and not math.isclose(kw / 1000, mw, rel_tol=1e-6, abs_tol=1e-6):
        raise ValueError("Energy kW and MW totals disagree")
    if kw is not None and mw is None:
        result["currentTotalPowerMw"] = kw / 1000
    if mw is not None and kw is None:
        result["currentTotalPowerKw"] = mw * 1000
    method = data.get("co2Method")
    if method is not None and (not isinstance(method, str) or not method.strip()):
        raise ValueError("Invalid CO2 method")
    if result["todayCo2AvoidedKg"] is not None and not method:
        raise ValueError("Derived CO2 requires a documented method")
    by_type = data.get("byTypeKw", {})
    if not isinstance(by_type, dict):
        raise TypeError("Energy type readings must be an object")
    result["byTypeKw"] = {key: measurement(value, key) for key, value in by_type.items()}
    facilities = data.get("facilities", [])
    if not isinstance(facilities, list):
        raise TypeError("Energy facilities must be an array")
    result["facilities"] = []
    seen = set()
    for facility in facilities:
        if not isinstance(facility, dict):
            raise TypeError("Invalid facility")
        for key in ("id", "name", "operator", "municipality", "facilityType"):
            if not isinstance(facility.get(key), str) or not facility[key].strip():
                raise ValueError(f"Missing facility {key}")
        if facility["id"] in seen:
            raise ValueError("Duplicate facility")
        seen.add(facility["id"])
        if facility["facilityType"] not in {"solar_pv", "biogas", "landfill_gas", "biomass"}:
            raise ValueError("Unsupported energy facility type")
        normalized = dict(facility)
        if "lat" in facility or "lng" in facility:
            for key, limit in (("lat", 90), ("lng", 180)):
                coordinate = facility.get(key)
                if (isinstance(coordinate, bool) or not isinstance(coordinate, (int, float))
                        or not math.isfinite(coordinate) or not -limit <= coordinate <= limit):
                    raise ValueError("Facility coordinates must be a valid pair")
        for key in ("installedCapacityKw", "currentPowerKw", "todayYieldKwh"):
            normalized[key] = measurement(facility.get(key), key)
        # Capacity is optional just like current output; coordinates are not needed by this widget.
        result["facilities"].append(normalized)
    if (result["currentTotalPowerKw"] is None and result["todayTotalEnergyKwh"] is None
            and not any(value is not None for value in result["byTypeKw"].values())
            and not any(f["currentPowerKw"] is not None or f["todayYieldKwh"] is not None for f in result["facilities"])):
        raise ValueError("No measured energy values")
    return result
