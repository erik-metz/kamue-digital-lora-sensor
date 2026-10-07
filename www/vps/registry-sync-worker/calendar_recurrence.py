"""Expand explicit, finite RFC 5545 series without inventing another edition."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta

from dateutil.rrule import rrulestr
from municipal_events import BERLIN

MAX_OCCURRENCES = 1000


def as_datetime(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=BERLIN) if value.tzinfo is None else value
    return datetime.combine(value, datetime.min.time(), tzinfo=BERLIN)


def date_list(record, key):
    properties = record.get(key, [])
    if not isinstance(properties, list):
        properties = [properties]
    values = []
    for prop in properties:
        for item in prop.dts:
            if isinstance(item.dt, tuple):
                raise TypeError("Calendar PERIOD recurrence dates unsupported")
            values.append(item.dt)
    return values


def expand_calendar(calendar):
    records = calendar.walk("VEVENT")
    if not records or len(records) > MAX_OCCURRENCES:
        raise ValueError("Calendar occurrences missing or unbounded")
    masters, overrides = {}, {}
    for record in records:
        uid = str(record.get("UID", ""))
        if not uid or record.errors:
            raise ValueError("Calendar occurrence identity invalid")
        if "RECURRENCE-ID" in record:
            prop = record["RECURRENCE-ID"]
            if prop.params.get("RANGE"):
                raise ValueError("Calendar THISANDFUTURE overrides unsupported")
            anchor = as_datetime(prop.dt)
            key = (uid, anchor)
            if key in overrides:
                raise ValueError("Repeated calendar recurrence override")
            overrides[key] = record
        else:
            if uid in masters:
                raise ValueError("Repeated calendar master UID")
            masters[uid] = record
    result, used = [], set()
    for uid, master in masters.items():
        start = master.decoded("DTSTART")
        if "EXRULE" in master:
            raise ValueError("Calendar EXRULE unsupported")
        recurring = any(key in master for key in ("RRULE", "RDATE", "EXDATE"))
        if not recurring:
            if any(key[0] == uid for key in overrides):
                raise ValueError("Calendar override without recurring master")
            result.append((master, uid))
            continue
        end = master.decoded("DTEND") if "DTEND" in master else None
        if end is None or isinstance(end, datetime) != isinstance(start, datetime):
            raise ValueError("Calendar recurring end missing or type mismatch")
        duration = end - start
        if duration <= timedelta(0):
            raise ValueError("Calendar recurring duration invalid")
        base = as_datetime(start)
        dates = {base}
        rule = master.get("RRULE")
        if rule:
            if isinstance(rule, list):
                raise ValueError("Multiple calendar recurrence rules unsupported")
            if str(rule.get("FREQ", [""])[0]) not in {
                "DAILY",
                "WEEKLY",
                "MONTHLY",
                "YEARLY",
            }:
                raise ValueError("Calendar subdaily recurrence unsupported")
            interval = rule.get("INTERVAL", [1])
            if len(interval) != 1 or int(interval[0]) < 1:
                raise ValueError("Calendar recurrence interval invalid")
            count, until = rule.get("COUNT"), rule.get("UNTIL")
            if bool(count) == bool(until):
                raise ValueError("Calendar recurrence needs exactly one finite bound")
            if count and not 1 <= int(count[0]) <= MAX_OCCURRENCES:
                raise ValueError("Calendar recurrence count unbounded")
            if until and not base <= as_datetime(until[0]) <= base + timedelta(
                days=1096
            ):
                raise ValueError("Calendar recurrence period unbounded")
            if any(
                len(rule.get(key, [])) > 1 for key in ("BYHOUR", "BYMINUTE", "BYSECOND")
            ):
                raise ValueError("Calendar multiple daily times unsupported")
            text = rule.to_ical().decode()
            # DATE UNTIL is interpreted in the master's local timezone.
            if until and not isinstance(until[0], datetime):
                text = text.replace(
                    until[0].strftime("%Y%m%d"),
                    as_datetime(until[0]).astimezone(UTC).strftime("%Y%m%dT%H%M%SZ"),
                )
            for occurrence in rrulestr(text, dtstart=base):
                if (
                    occurrence.astimezone(UTC).astimezone(occurrence.tzinfo)
                    != occurrence
                ):
                    raise ValueError(
                        "Calendar occurrence falls in nonexistent local time"
                    )
                dates.add(occurrence)
                if len(dates) > MAX_OCCURRENCES:
                    raise ValueError("Calendar occurrence limit exceeded")
        for value in date_list(master, "RDATE"):
            if isinstance(value, datetime) != isinstance(start, datetime):
                raise ValueError("Calendar recurrence date type mismatch")
            dates.add(as_datetime(value))
        exclusions = date_list(master, "EXDATE")
        if any(
            isinstance(value, datetime) != isinstance(start, datetime)
            for value in exclusions
        ):
            raise ValueError("Calendar exclusion date type mismatch")
        excluded = {as_datetime(value) for value in exclusions}
        # Overrides supersede the original slot, including moved or cancelled ones.
        for anchor in sorted(dates):
            key = (uid, anchor)
            override = overrides.get(key)
            if anchor in excluded and override is None:
                continue
            record = deepcopy(master)
            for field in ("RRULE", "RDATE", "EXDATE", "RECURRENCE-ID"):
                record.pop(field, None)
            record["DTSTART"].dt = (
                anchor if isinstance(start, datetime) else anchor.date()
            )
            record["DTEND"].dt = record["DTSTART"].dt + duration
            if override is not None:
                if any(field in override for field in ("RRULE", "RDATE", "EXDATE")):
                    raise ValueError("Recurring calendar override unsupported")
                for field in override:
                    record[field] = deepcopy(override[field])
                used.add(key)
            result.append((record, uid + "-" + anchor.strftime("%Y%m%dT%H%M%S%z")))
            if len(result) > MAX_OCCURRENCES:
                raise ValueError("Calendar occurrence limit exceeded")
    if set(overrides) != used:
        raise ValueError("Orphan calendar recurrence override")
    if len(result) > MAX_OCCURRENCES:
        raise ValueError("Calendar occurrence limit exceeded")
    return result
