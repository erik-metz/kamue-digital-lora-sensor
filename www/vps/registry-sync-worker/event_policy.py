"""Conservative publication policy; original source rows remain independently stored."""

import re
import unicodedata
from datetime import datetime

from municipal_events import BERLIN

CANCELLED_PREFIX = re.compile(
    r"^\s*(?:\[\s*)?(?:abgesagt|entfällt|entfaellt|cancelled|canceled)"
    r"(?:\s*\])?(?:\s*[:!–—-]\s*|\s+)",
    re.IGNORECASE,
)


def event_status(event):
    if str(event.get("status", "")).casefold() in {"cancelled", "canceled"}:
        return "cancelled"
    if CANCELLED_PREFIX.match(event.get("title", "")):
        return "cancelled"
    return event.get("status", "scheduled")


def normalized(value):
    text = unicodedata.normalize("NFKC", value or "").casefold()
    return " ".join(re.findall(r"\w+", text))


def local_time(value):
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("Event publication requires timezone-aware dates")
    return parsed.astimezone(BERLIN)


def duplicate_key(event):
    # No fuzzy matching, venue inference, or merging separate course sessions.
    venue = normalized(event.get("venue_name"))
    title = normalized(CANCELLED_PREFIX.sub("", event.get("title", "")))
    if not venue or not title:
        return None
    start = local_time(event["start_time"])
    end = local_time(event.get("end_time") or event["start_time"])
    return (normalized(event["municipality"]), title, venue, start, end)


def aggregate_events(events):
    groups = {}
    for original in events:
        event = dict(original, status=event_status(original))
        key = duplicate_key(event) or ("id", event["id"])
        groups.setdefault(key, []).append(event)
    result = []
    for group in groups.values():
        # Keep a stable ID independent of collector execution order.
        ordered = sorted(group, key=lambda item: item["id"])
        primary = dict(ordered[0])
        if any(item["status"] == "cancelled" for item in group):
            primary["status"] = "cancelled"
        # Conflicting price claims must never advertise unconditional free admission.
        primary["is_free"] = all(item.get("is_free", False) for item in group)
        primary["source_events"] = [
            {k: item.get(k) for k in ("id", "source", "event_url", "status")}
            for item in ordered
        ]
        for field in (
            "description",
            "organizer",
            "image_url",
            "street_address",
            "postal_code",
        ):
            if not primary.get(field):
                primary[field] = next(
                    (item[field] for item in ordered if item.get(field)), None
                )
        result.append(primary)
    return sorted(result, key=lambda item: (local_time(item["start_time"]), item["id"]))
