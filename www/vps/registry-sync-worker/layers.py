"""Project imported records into map geometry, once at collection time."""

LAYER_DATASETS = {
    "environment/protected-areas": ("nature", None),
    "environment/crop-zones": ("crops", None),
    "environment/flood/gauges": ("floods", None),
    "realestate/boris": ("boris", None),
    "realestate/development-plans": ("devplans", None),
    "economy/companies": ("companies", None),
    "infrastructure/ev-charging": ("charging", "stations"),
    "infrastructure/energy": ("energy", "facilities"),
    "infrastructure/wifi": ("wifi", "hotspots"),
    "infrastructure/broadband": ("broadband", "areas"),
    "infrastructure/road-conditions": ("road", "segments"),
    "traffic/street-closures": ("closures", "closures"),
}


def map_collection(data, container=None):
    records = data.get(container, []) if container else data
    if not isinstance(records, list):
        raise TypeError("Map dataset must contain records")
    features = []
    for row in records:
        geometry = row.get("geojson") or row.get("geometry")
        if geometry and geometry.get("type") == "FeatureCollection":
            features.extend(geometry["features"])
            continue
        if geometry and geometry.get("type") == "Feature":
            geometry = geometry["geometry"]
        if not geometry:
            lat, lon = (
                row.get("latitude", row.get("lat")),
                row.get("longitude", row.get("lng")),
            )
            if lat is not None and lon is not None:
                geometry = {"type": "Point", "coordinates": [lon, lat]}
        if geometry:
            properties = {
                k: v
                for k, v in row.items()
                if isinstance(v, (str, int, float)) and not k.endswith("_url")
            }
            features.append(
                {"type": "Feature", "geometry": geometry, "properties": properties}
            )
    return {"type": "FeatureCollection", "features": features}
