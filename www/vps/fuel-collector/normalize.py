"""Reject incomplete snapshots; preserve unavailable prices as null."""
import math
from decimal import Decimal
from uuid import UUID


def price(value):
    if value is False or value is None:
        return None
    if type(value) not in (float, int) or not math.isfinite(value) or not 0 < value < 10:
        raise ValueError("Invalid fuel price")
    amount = Decimal(str(value)) * 1000
    if amount != amount.to_integral_value():
        raise ValueError("Fuel price precision exceeds three decimals")
    return int(amount)


def normalize(payload):
    if not isinstance(payload, dict) or payload.get("ok") is not True or not isinstance(payload.get("stations"), list):
        raise ValueError("Incomplete fuel snapshot")
    if len(payload["stations"]) > 1000:
        raise ValueError("Fuel inventory exceeds limit")
    result, ids = [], set()
    for item in payload["stations"]:
        if not isinstance(item, dict):
            raise TypeError("Invalid station")
        sid = str(UUID(item["id"]))
        if sid in ids:
            raise ValueError("Duplicate fuel station")
        ids.add(sid)
        lat, lng = item["lat"], item["lng"]
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (lat, lng)) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError("Invalid station coordinates")
        if type(item.get("isOpen")) is not bool:
            raise ValueError("Missing station opening status")
        station = {"id": sid, "latitude": lat, "longitude": lng, "is_open": item["isOpen"]}
        for key in ("name", "brand", "street", "houseNumber", "postCode", "place"):
            value = item.get(key, "")
            if not isinstance(value, (str, int)) or isinstance(value, bool):
                raise TypeError("Invalid station metadata")
            station[key] = str(value)[:300]
        if not station["name"]:
            raise ValueError("Missing station name")
        for fuel in ("e5", "e10", "diesel"):
            station[fuel] = price(item.get(fuel))
        result.append(station)
    return result
