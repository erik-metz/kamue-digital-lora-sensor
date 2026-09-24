"""ZAKB public calendar collector and explicitly modelled collection tours.

Calendar lookups are address-specific. An OSM-derived representative address per
street is a coverage sample, never evidence that every house shares its schedule.
No vehicle identity, license plate, load or actual completion is invented.
"""

import asyncio
import hashlib
import json
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from html.parser import HTMLParser
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx
from icalendar import Calendar
from psycopg.types.json import Jsonb
from publications import acquire, publish


class CalendarForm(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fields = {}
        self.options = {}
        self.select = None
        self.enabled = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form":
            self.enabled = attrs.get("id") == "athos-os-form"
        if not self.enabled:
            return
        if (
            tag == "input"
            and attrs.get("name")
            and attrs.get("type") != "submit"
            and (attrs.get("type") not in ("checkbox", "radio") or "checked" in attrs)
        ):
            self.fields[attrs["name"]] = attrs.get(
                "value", "on" if attrs.get("type") == "checkbox" else ""
            )
        if tag == "select":
            self.select = attrs["name"]
            self.options[self.select] = []
        if tag == "option" and self.select:
            value = attrs.get("value", "")
            self.options[self.select].append(value)
            if "selected" in attrs:
                self.fields[self.select] = value

    def handle_endtag(self, tag):
        if tag == "select":
            self.select = None
        if tag == "form":
            self.enabled = False


def form(html):
    result = CalendarForm()
    result.feed(html)
    if not result.fields:
        raise ValueError("ZAKB public calendar form changed")
    return result.fields


def parse_ical(body, address):
    calendar = Calendar.from_ical(body)
    events = []
    for event in calendar.walk("VEVENT"):
        if any(k in event for k in ["RRULE", "RDATE", "EXDATE", "RECURRENCE-ID"]):
            raise ValueError(
                "Recurring calendar rules require an explicit expansion adapter"
            )
        day = event.decoded("DTSTART")
        if isinstance(day, datetime):
            day = day.date()
        if not isinstance(day, date):
            raise TypeError("Missing collection date")
        events.append(
            {
                "date": day.isoformat(),
                "fraction": str(event.get("SUMMARY", "")),
                **address,
                "coverage": "representative_address_only",
            }
        )
    return events


def forecast_tours(events, now, start_hour=7, end_hour=17):
    """An explicit model: sampled addresses, nearest-neighbour order, 07–17 local.

    Spatial interpolation is a straight-line approximation, NOT a measured road
    route. Uniform time allocation and ordering are recorded as assumptions.
    """
    grouped = defaultdict(list)
    for event in events:
        day = date.fromisoformat(event["date"])
        if day not in (
            now.astimezone(ZoneInfo("Europe/Berlin")).date(),
            (now + timedelta(days=1)).astimezone(ZoneInfo("Europe/Berlin")).date(),
        ):
            continue
        grouped[(day, event["municipality"], event["fraction"])].append(event)
    tours = []
    for (day, city, fraction), stops in grouped.items():
        unique = {(s["street"], s["house_number"]): s for s in stops}
        remaining = sorted(
            unique.values(), key=lambda s: (s["street"], s["house_number"])
        )
        if len(remaining) < 2:
            continue
        ordered = [remaining.pop(0)]
        while remaining:
            last = ordered[-1]
            index = min(
                range(len(remaining)),
                key=lambda i: (
                    (remaining[i]["latitude"] - last["latitude"]) ** 2
                    + (remaining[i]["longitude"] - last["longitude"]) ** 2
                ),
            )
            ordered.append(remaining.pop(index))
        start = datetime.combine(
            day, time(start_hour), ZoneInfo("Europe/Berlin")
        ).timestamp()
        end = datetime.combine(
            day, time(end_hour), ZoneInfo("Europe/Berlin")
        ).timestamp()
        points = [
            [
                start + (end - start) * i / (len(ordered) - 1),
                s["latitude"],
                s["longitude"],
            ]
            for i, s in enumerate(ordered)
        ]
        trip = (
            "collection-forecast-"
            + hashlib.sha256(f"{city}:{fraction}".encode()).hexdigest()[:16]
        )
        tours.append(
            {
                "trip_id": trip,
                "service_date": day,
                "trajectory": points,
                "metadata": {
                    "line": fraction,
                    "destination": city,
                    "geometry_basis": "stop_to_stop",
                    "coverage": "representative_addresses_only",
                    "route_model": "nearest_neighbour",
                    "time_model": f"uniform_{start_hour:02d}_{end_hour:02d}_Europe/Berlin",
                    "sampled_streets": len(ordered),
                    "entity_type": "collection_forecast_not_identified_truck",
                },
            }
        )
    return tours


async def import_zakb(conn, client, source):
    now = datetime.now(UTC)
    # OSM is collected on the VPS, with the exact query response in the archive.
    city_pattern = "|".join(source["municipalities"])
    south, west, north, east = source["bbox"]
    query = f'[out:json][timeout:90];nwr["addr:city"~"^({city_pattern})$"]["addr:street"]["addr:housenumber"]({south},{west},{north},{east});out center tags;'
    response, geo_digest, _ = await acquire(
        conn, client, source, source["address_url"] + "?" + urlencode({"data": query})
    )
    addresses = {}
    for item in response.json()["elements"]:
        tags = item["tags"]
        city = tags.get("addr:city")
        street = tags.get("addr:street")
        number = tags.get("addr:housenumber")
        center = item.get("center", item)
        if (
            city not in source["municipalities"]
            or not street
            or not number
            or not number.isdigit()
            or not center.get("lat")
        ):
            continue
        key = (city, street)
        candidate = {
            "municipality": city,
            "street": street,
            "house_number": number,
            "latitude": center["lat"],
            "longitude": center["lon"],
        }
        if key not in addresses or int(number) < int(addresses[key]["house_number"]):
            addresses[key] = candidate
    if not addresses:
        raise ValueError("No representative addresses available")
    events = []
    failures = []
    inputs = [geo_digest]
    for address in sorted(
        addresses.values(), key=lambda r: (r["municipality"], r["street"])
    ):
        try:
            response, digest, _ = await acquire(conn, client, source)
            fields = form(response.text)
            fields.update(
                {"aos[Ort]": address["municipality"], "submitAction": "CITYCHANGED"}
            )
            response, digest, _ = await acquire(conn, client, source, form=fields)
            fields = form(response.text)
            fields.update(
                {
                    "aos[Strasse]": address["street"],
                    "aos[Hausnummer]": address["house_number"],
                    "submitAction": "nextPage",
                }
            )
            response, digest, _ = await acquire(conn, client, source, form=fields)
            if "filedownload_ICAL" not in response.text:
                raise ValueError("Address not accepted by calendar")
            fields = form(response.text)
            fields["submitAction"] = "filedownload_ICAL"
            response, digest, _ = await acquire(conn, client, source, form=fields)
            events.extend(parse_ical(response.content, address))
            inputs.append(digest)
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            failures.append(
                {"municipality": address["municipality"], "street": address["street"]}
            )
        await asyncio.sleep(source.get("request_spacing_seconds", 1))
    if not events:
        raise ValueError("No ZAKB calendars collected")
    # Commit a reproducibility manifest linking every calendar and geometry input.
    manifest = json.dumps(
        {
            "inputs": inputs,
            "coverage": "representative_addresses_only",
            "failed_streets": failures,
        },
        sort_keys=True,
    ).encode()
    digest = hashlib.sha256(manifest).hexdigest()
    async with conn.transaction():
        await conn.execute(
            "INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json') ON CONFLICT DO NOTHING",
            (digest, manifest),
        )
        await publish(conn, source, "waste/calendar", events, digest, now)
        await conn.execute(
            "DELETE FROM movement_schedules WHERE source_id=%s", (source["id"],)
        )
        await conn.execute(
            "DELETE FROM movement_latest WHERE basis='schedule_prediction' AND data->>'source_id'=%s",
            (source["id"],),
        )
        for tour in forecast_tours(events, now):
            points = tour["trajectory"]
            await conn.execute(
                """INSERT INTO movement_schedules(source_id,trip_id,service_date,kind,starts_at,ends_at,
                payload_sha256,fetched_at,trajectory,metadata) VALUES (%s,%s,%s,'waste',%s,%s,%s,%s,%s,%s)""",
                (
                    source["id"],
                    tour["trip_id"],
                    tour["service_date"],
                    datetime.fromtimestamp(points[0][0], UTC),
                    datetime.fromtimestamp(points[-1][0], UTC),
                    digest,
                    now,
                    Jsonb(points),
                    Jsonb(tour["metadata"]),
                ),
            )
        await conn.execute(
            "INSERT INTO collection_attempts(source_id,payload_sha256,status,error) VALUES (%s,%s,%s,%s)",
            (
                source["id"],
                digest,
                "partial" if failures else "success",
                f"{len(failures)} street samples rejected; address sample coverage only",
            ),
        )
    await conn.commit()
    return "partial" if failures else "success"
