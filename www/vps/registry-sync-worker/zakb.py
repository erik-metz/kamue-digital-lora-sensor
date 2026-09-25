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
from itertools import zip_longest
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


def address_key(source, address):
    # Version the parser contract; changing a source URL also invalidates checkpoints.
    identity = ["zakb-calendar-v1", source["url"], address["municipality"],
                address["street"], address["house_number"]]
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()


async def calendar_for_address(conn, client, source, address, now):
    key = address_key(source, address)
    cursor = await conn.execute(
        """SELECT p.body,c.payload_sha256,c.fetched_at FROM collection_checkpoints c
        JOIN collected_payloads p ON p.sha256=c.payload_sha256
        WHERE c.source_id=%s AND c.item_key=%s AND c.fetched_at>%s""",
        (source["id"], key, now-timedelta(seconds=source["interval_seconds"])),
    )
    cached = await cursor.fetchone()
    await conn.commit()
    if cached:
        body, digest, fetched = cached
        return parse_ical(bytes(body), address), digest, fetched, True

    async def request(fields=None):
        # Pace every provider request, not just the gap between address workflows.
        await asyncio.sleep(source.get("request_spacing_seconds", 1))
        return await acquire(conn, client, source, form=fields)

    response, _, _ = await request()
    fields = form(response.text)
    fields.update({"aos[Ort]": address["municipality"], "submitAction": "CITYCHANGED"})
    response, _, _ = await request(fields)
    fields = form(response.text)
    fields.update({"aos[Strasse]": address["street"], "aos[Hausnummer]": address["house_number"],
                   "submitAction": "nextPage"})
    response, _, _ = await request(fields)
    if "filedownload_ICAL" not in response.text:
        raise ValueError("Address not accepted by calendar")
    fields = form(response.text)
    fields["submitAction"] = "filedownload_ICAL"
    response, digest, _ = await request(fields)
    events = parse_ical(response.content, address)
    fetched = datetime.now(UTC)
    await conn.execute(
        """INSERT INTO collection_checkpoints(source_id,item_key,payload_sha256,fetched_at)
        VALUES (%s,%s,%s,%s) ON CONFLICT(source_id,item_key) DO UPDATE
        SET payload_sha256=EXCLUDED.payload_sha256,fetched_at=EXCLUDED.fetched_at""",
        (source["id"], key, digest, fetched),
    )
    await conn.execute("DELETE FROM collection_item_failures WHERE source_id=%s AND item_key=%s", (source["id"], key))
    await conn.commit()
    return events, digest, fetched, False


async def import_zakb(conn, client, source):
    now = datetime.now(UTC)
    loop = asyncio.get_running_loop()
    deadline = loop.time() + source.get("run_budget_seconds", 900)
    if source.get("address_dataset"):
        cursor = await conn.execute(
            "SELECT data,payload_sha256 FROM collected_datasets WHERE dataset=%s AND expires_at>NOW()",
            (source["address_dataset"],))
        stored = await cursor.fetchone()
        await conn.commit()
        if not stored:
            raise ValueError("Regional address collector has not published a fresh inventory")
        inventory, geo_digest = stored
    else:
        # OSM is collected on the VPS, with the exact query response in the archive.
        city_pattern = "|".join(source["municipalities"])
        south, west, north, east = source["bbox"]
        query = f'[out:json][timeout:90];nwr["addr:city"~"^({city_pattern})$"]["addr:street"]["addr:housenumber"]({south},{west},{north},{east});out center tags;'
        inventory_key = "address-inventory:" + hashlib.sha256((source["address_url"] + query).encode()).hexdigest()
        cursor = await conn.execute(
            """SELECT p.body,c.payload_sha256 FROM collection_checkpoints c
            JOIN collected_payloads p ON p.sha256=c.payload_sha256
            WHERE c.source_id=%s AND c.item_key=%s AND c.fetched_at>%s""",
            (source["id"], inventory_key, now-timedelta(seconds=source["interval_seconds"])),
        )
        cached_inventory = await cursor.fetchone()
        await conn.commit()
        if cached_inventory:
            raw_inventory, geo_digest = cached_inventory
            inventory = json.loads(bytes(raw_inventory))
        else:
            async with asyncio.timeout(max(1, deadline-loop.time())):
                response, geo_digest, _ = await acquire(
                    conn, client, source, source["address_url"] + "?" + urlencode({"data": query})
                )
            inventory = response.json()
            if not isinstance(inventory.get("elements"), list):
                raise ValueError("Invalid address inventory")
            await conn.execute(
                """INSERT INTO collection_checkpoints(source_id,item_key,payload_sha256,fetched_at)
                VALUES (%s,%s,%s,%s) ON CONFLICT(source_id,item_key) DO UPDATE
                SET payload_sha256=EXCLUDED.payload_sha256,fetched_at=EXCLUDED.fetched_at""",
                (source["id"], inventory_key, geo_digest, datetime.now(UTC)),
            )
            await conn.commit()
    addresses = {}
    for item in inventory["elements"]:
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
    sampled_at = []
    cursor = await conn.execute(
        "SELECT item_key FROM collection_item_failures WHERE source_id=%s AND retry_after>NOW()", (source["id"],)
    )
    deferred = {row[0] for row in await cursor.fetchall()}
    await conn.commit()
    coverage = {city: {"sampled_streets": sum(a["municipality"] == city for a in addresses.values()),
                       "attempted_calendars": 0, "successful_calendars": 0,
                       "failed_calendars": 0, "reused_calendars": 0, "deferred_calendars": 0} for city in source["municipalities"]}
    cursor = await conn.execute(
        "SELECT item_key FROM collection_checkpoints WHERE source_id=%s AND fetched_at>%s",
        (source["id"], now-timedelta(seconds=source["interval_seconds"])),
    )
    fresh_keys = {row[0] for row in await cursor.fetchall()}
    await conn.commit()
    # Include every valid saved calendar before spending the network budget.
    # Then alternate municipalities so a slow city cannot starve the others.
    groups = [sorted((a for a in addresses.values() if a["municipality"] == city),
                     key=lambda a: a["street"]) for city in source["municipalities"]]
    ordered = [a for batch in zip_longest(*groups) for a in batch if a is not None]
    ordered.sort(key=lambda a: address_key(source, a) not in fresh_keys)
    for address in ordered:
        if address_key(source, address) not in fresh_keys and loop.time() >= deadline:
            break
        counts = coverage[address["municipality"]]
        if address_key(source, address) in deferred:
            counts["deferred_calendars"] += 1
            continue
        counts["attempted_calendars"] += 1
        try:
            timeout = 10 if address_key(source, address) in fresh_keys else min(120, deadline-loop.time())
            async with asyncio.timeout(timeout):
                calendar_events, digest, fetched, reused = await calendar_for_address(conn, client, source, address, now)
            events.extend(calendar_events)
            inputs.append(digest)
            sampled_at.append(fetched)
            counts["successful_calendars"] += 1
            counts["reused_calendars"] += int(reused)
        except (httpx.HTTPError, ValueError, TypeError, KeyError, TimeoutError) as exc:
            await conn.rollback()
            await conn.execute(
                """INSERT INTO collection_item_failures(source_id,item_key,retry_after,error)
                VALUES (%s,%s,NOW()+INTERVAL '30 minutes',%s) ON CONFLICT(source_id,item_key)
                DO UPDATE SET retry_after=EXCLUDED.retry_after,error=EXCLUDED.error""",
                (source["id"],address_key(source,address),type(exc).__name__),
            )
            await conn.commit()
            counts["failed_calendars"] += 1
            failures.append({"municipality": address["municipality"], "street": address["street"]})
    remaining = sum(c["sampled_streets"]-c["attempted_calendars"] for c in coverage.values())
    incomplete = bool(failures) or remaining > 0 or any(c["sampled_streets"] == 0 for c in coverage.values())
    # Commit a reproducibility manifest linking every calendar and geometry input.
    manifest = json.dumps(
        {
            "inputs": inputs,
            "coverage": "representative_addresses_only",
            "failed_streets": failures,
            "municipalities": coverage,
            "complete_address_coverage": False,
            "remaining_streets": remaining,
            "run_budget_seconds": source.get("run_budget_seconds", 900),
            "status": "partial" if incomplete else "sample_complete",
            "checked_at": now.isoformat(),
        },
        sort_keys=True,
    ).encode()
    digest = hashlib.sha256(manifest).hexdigest()
    async with conn.transaction():
        await conn.execute(
            "INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json') ON CONFLICT DO NOTHING",
            (digest, manifest),
        )
        await publish(conn, source, "waste/coverage", json.loads(manifest), digest, now)
        # Keep the previous valid calendar/schedules if no address could be verified.
        if not sampled_at:
            await conn.execute(
                "INSERT INTO collection_attempts(source_id,payload_sha256,status,error) VALUES (%s,%s,'failed','No calendars verified')",
                (source["id"], digest),
            )
        else:
            await publish_calendar(conn, source, events, digest, min(sampled_at), now, incomplete, failures)
    await conn.commit()
    return "failed" if not sampled_at else "partial" if incomplete else "success"


async def publish_calendar(conn, source, events, digest, source_time, now, incomplete, failures):
    await publish(conn, source, "waste/calendar", events, digest, source_time)
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
            "partial" if incomplete else "success",
            f"{len(failures)} street samples rejected; address sample coverage only",
        ),
    )
