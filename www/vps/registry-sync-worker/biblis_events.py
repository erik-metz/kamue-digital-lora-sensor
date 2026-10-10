"""Public Events Calendar REST feeds with complete pagination and venue checks."""

import logging
import math
import re
from datetime import UTC, datetime
from html import unescape
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from adapters import classify_category, sync_cultural_events_to_db_and_publish
from municipal_events import (
    BERLIN,
    EVENT_HORIZON_YEARS,
    PLACES,
    Document,
    event_period,
    municipality_for_venue,
)
from publications import acquire

LOG = logging.getLogger(__name__)
PAGE_SIZE = 50
MAX_PAGES = 100


def plain(value):
    if not isinstance(value, str):
        raise TypeError("Event text must be a string")
    value = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1>", "", value, flags=re.DOTALL | re.IGNORECASE
    )
    return unescape(Document(value).root.text())


def window(now):
    year = now.astimezone(BERLIN).year
    return datetime(year, 1, 1, tzinfo=BERLIN), datetime(year + EVENT_HORIZON_YEARS, 1, 1, tzinfo=BERLIN)


def page_url(source, now, page):
    start, until = window(now)
    parts = urlsplit(source["url"])
    if (
        parts.scheme != "https"
        or parts.path.rstrip("/") != "/wp-json/tribe/events/v1/events"
    ):
        raise ValueError("Unexpected Tribe event API URL")
    query = dict(parse_qsl(parts.query))
    query.update(
        start_date=start.date().isoformat(),
        end_date=f"{until.year - 1}-12-31",
        per_page=str(PAGE_SIZE),
        page=str(page),
        status="publish",
    )
    return urlunsplit(parts._replace(query=urlencode(query), fragment=""))


def pagination(body):
    if not isinstance(body, dict) or not isinstance(body.get("events"), list):
        raise TypeError("Tribe event list missing")
    total, pages = body.get("total"), body.get("total_pages")
    if (
        type(total) is not int
        or type(pages) is not int
        or total < 0
        or not 0 <= pages <= MAX_PAGES
    ):
        raise ValueError("Invalid or unbounded Tribe pagination")
    if pages not in {
        max(1, math.ceil(total / PAGE_SIZE)),
        math.ceil(total / PAGE_SIZE),
    }:
        raise ValueError("Inconsistent Tribe pagination")
    return total, max(1, pages)


def venue_location(venue, source):
    if isinstance(venue, list) and not venue:
        return "", None, None, None
    if not isinstance(venue, dict):
        raise TypeError("Unexpected Tribe venue structure")
    name = plain(venue.get("venue", ""))
    city, postcode = venue.get("city"), venue.get("zip")
    municipality = municipality_for_venue(name, city=city, postcode=postcode)
    if (
        city
        and postcode
        and municipality
        and municipality_for_venue("", postcode=postcode) != municipality
    ):
        municipality = None
    if not city and not postcode and not municipality:
        verified = source.get("verified_venues", {}).get(str(venue.get("id")))
        if (
            verified
            and name == verified["source_name"]
            and verified["municipality"] in PLACES
        ):
            municipality = verified["municipality"]
            name = verified["venue_name"]
    address = plain(venue.get("address", "")) or None
    return name, municipality, postcode or None, address


def period(item):
    if not isinstance(item.get("all_day"), bool):
        raise TypeError("Tribe all-day flag missing")
    if item["all_day"]:
        return event_period(item["start_date"], end_date=item["end_date"])
    if item.get("utc_start_date") and item.get("utc_end_date"):
        start = (
            datetime.fromisoformat(item["utc_start_date"])
            .replace(tzinfo=UTC)
            .astimezone(BERLIN)
        )
        end = (
            datetime.fromisoformat(item["utc_end_date"])
            .replace(tzinfo=UTC)
            .astimezone(BERLIN)
        )
    else:
        zone = ZoneInfo(item.get("timezone") or "Europe/Berlin")
        start = (
            datetime.fromisoformat(item["start_date"])
            .replace(tzinfo=zone)
            .astimezone(BERLIN)
        )
        end = (
            datetime.fromisoformat(item["end_date"])
            .replace(tzinfo=zone)
            .astimezone(BERLIN)
        )
    if end < start:
        raise ValueError("Tribe event ends before it starts")
    return start, end


def admission(cost, description):
    """Unknown prices and conditional free admission are not advertised as free."""
    if cost:
        return bool(
            re.fullmatch(
                r"(?:kostenlos|eintritt\s+frei|frei|€?\s*0(?:[,.]0+)?\s*€?)",
                cost,
                re.IGNORECASE,
            )
        )
    # A fee in prose (e.g. for non-members) takes precedence over a free claim.
    amounts = re.findall(
        r"(?:€\s*(\d+(?:[,.]\d+)?)|(\d+(?:[,.]\d+)?)(?:[.,]-)?\s*(?:€|Euro))",
        description,
        re.IGNORECASE,
    )
    if any(float((a or b).replace(",", ".")) > 0 for a, b in amounts):
        return False
    for sentence in re.split(r"[.!?\n]", description):
        if re.search(
            r"\beintritt\s+(?:ist\s+)?frei\b|\bkostenloser\s+eintritt\b",
            sentence,
            re.IGNORECASE,
        ) and not re.search(
            r"\bnicht\b|\bnur\b|\bkinder\b|\bmitglieder\b", sentence, re.IGNORECASE
        ):
            return True
    return False


def parse_event(item, source, now):
    if (
        not isinstance(item, dict)
        or type(item.get("id")) is not int
        or not item.get("title")
    ):
        raise ValueError("Tribe event identity missing")
    if item.get("status") != "publish" or item.get("hide_from_listings") is True:
        return None
    title = plain(item["title"])
    venue, municipality, postcode, address = venue_location(
        item.get("venue", []), source
    )
    if not municipality:
        LOG.info("Tribe event deferred: unknown or external venue, id=%s", item["id"])
        return None
    try:
        start, end = period(item)
    except (KeyError, ValueError):
        LOG.warning("Tribe event deferred: invalid dates, id=%s", item["id"])
        return None
    url = item.get("url")
    if (
        not isinstance(url, str)
        or urlsplit(url).scheme != "https"
        or urlsplit(url).netloc != urlsplit(source["url"]).netloc
    ):
        raise ValueError("Unexpected Tribe event URL")
    description = plain(item.get("description", ""))
    cost = plain(item.get("cost", ""))
    free = admission(cost, description)
    notes = [description]
    if item["all_day"]:
        notes.append(
            "Ganztägig bzw. ohne Uhrzeitangabe; Tagesgrenzen dienen der Kalenderdarstellung."
        )
    notes.append(
        "Preis: " + cost
        if cost
        else "Keine separate Preisangabe; Teilnahmebedingungen siehe Veranstaltungsseite."
    )
    organizer = item.get("organizer", [])
    if not isinstance(organizer, list) or not all(
        isinstance(org, dict) for org in organizer
    ):
        raise ValueError("Unexpected Tribe organizers")
    image = item.get("image")
    image_url = image.get("url") if isinstance(image, dict) else None
    if image_url and urlsplit(image_url).scheme != "https":
        image_url = None
    return {
        "id": f"{source.get('event_id_prefix', 'bsb')}-{item['id']}",
        "title": title,
        "organizer": "; ".join(plain(org.get("organizer", "")) for org in organizer),
        "venue_name": venue,
        "municipality": municipality,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "category": source.get("category_overrides", {}).get(title, classify_category(title)),
        "description": " ".join(filter(None, notes)),
        "event_url": url,
        "ticket_url": url,
        "image_url": image_url,
        "postal_code": postcode,
        "street_address": address,
        "is_free": free,
        "source": source["id"],
        "status": "past" if end < now else "scheduled",
    }


async def import_biblis_events(conn, client, source):
    now = datetime.now(UTC)
    receipts, events, identities, digests = [], [], set(), set()
    expected = None
    count = 0
    for page in range(1, MAX_PAGES + 1):
        response, digest, attempt = await acquire(
            conn, client, source, page_url(source, now, page)
        )
        body = response.json()
        total, pages = pagination(body)
        if expected is None:
            expected = total, pages
        if expected != (total, pages) or digest in digests:
            raise ValueError(
                "Tribe calendar changed/repeated during pagination; incomplete import rejected"
            )
        digests.add(digest)
        receipts.append(attempt)
        wanted = min(PAGE_SIZE, max(0, total - (page - 1) * PAGE_SIZE))
        if len(body["events"]) != wanted:
            raise ValueError("Tribe event page truncated")
        for item in body["events"]:
            event = parse_event(item, source, now)
            identity = item["id"]
            if identity in identities:
                raise ValueError("Tribe event repeated across pages")
            identities.add(identity)
            count += 1
            if event:
                events.append(event)
        if page == pages:
            break
    else:
        raise ValueError("Tribe page limit reached; incomplete import rejected")
    if count != expected[0]:
        raise ValueError("Tribe import count mismatch")
    start, until = window(now)
    async with conn.transaction():
        # Only this source and the fully requested window may be reconciled.
        await conn.execute(
            """DELETE FROM cultural_events WHERE source=%s AND NOT (id = ANY(%s))
               AND COALESCE(end_time, start_time) >= %s AND start_time < %s""",
            (source["id"], [event["id"] for event in events], start, until),
        )
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        for attempt in receipts:
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
    await conn.commit()
    LOG.info(
        "Tribe events: %s acquired, %s local, %s deferred",
        count,
        len(events),
        count - len(events),
    )
