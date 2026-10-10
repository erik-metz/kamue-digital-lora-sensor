"""Consistent corridor summaries for API responses and GeoJSON publications."""

from datetime import UTC, datetime, timedelta


def summarize_corridor(incidents, checked_at=None, now=None):
    now = now or datetime.now(UTC)
    fresh = [i for i in incidents if not i.get("is_stale", False)]
    known = [i for i in fresh if i.get("delay_kind") in ("reported", "estimated")]
    unknown = len(known) != len(fresh)
    delay = max((i.get("delay_seconds") or 0 for i in known), default=0)
    delay_kind = (
        "unknown"
        if unknown or not fresh
        else "estimated"
        if any(i.get("delay_kind") == "estimated" for i in known)
        else "reported"
    )
    coverage = checked_at is not None and checked_at >= now - timedelta(minutes=10)
    if not coverage:
        status, description = "unknown", "Verkehrslage nicht aktuell bestätigt"
    elif any(i.get("closure_kind") == "full" for i in fresh):
        status, description = "closure", "Vollsperrung gemeldet"
    elif delay >= 900 or any(
        i.get("severity") == "standstill" and i.get("cause_type") != "closure"
        for i in fresh
    ):
        status, description = "congestion", "Stau gemeldet"
    elif any(i.get("cause_type") == "closure" for i in fresh):
        status, description = (
            "sluggish",
            "Sperrung gemeldet; Umfang unbekannt"
            if any(
                i.get("closure_kind") == "unknown"
                for i in fresh
                if i.get("cause_type") == "closure"
            )
            else "Anschlussstelle oder Fahrzeuggruppe eingeschränkt; Details beachten",
        )
    elif delay >= 300:
        status, description = "sluggish", "Zähflüssiger Verkehr gemeldet"
    elif fresh and unknown:
        status, description = "unknown", "Behinderung gemeldet; Zeitverlust unbekannt"
    elif fresh:
        status, description = "clear", "Meldungen mit geringem angegebenem Zeitverlust"
    else:
        status, description = (
            "clear",
            "Keine aktuellen Behinderungen gemeldet; keine Verkehrsmessung",
        )
    if delay_kind != "unknown":
        description += f", bis zu +{round(delay / 60)} Min." + (
            " (geschätzt)" if delay_kind == "estimated" else " (gemeldet)"
        )
    return {
        "status": status,
        "description": description,
        "delay_seconds": delay if delay_kind != "unknown" else None,
        "delay_minutes": round(delay / 60) if delay_kind != "unknown" else None,
        "delay_kind": delay_kind,
        "active_incidents_count": len(fresh),
        "last_success_at": checked_at,
        "is_stale": not coverage,
    }
