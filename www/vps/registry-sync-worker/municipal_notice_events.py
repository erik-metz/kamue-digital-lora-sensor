"""Bounded, source-specific municipal notices with explicit dates and venues."""

import hashlib
import re
from datetime import UTC, datetime

from adapters import sync_cultural_events_to_db_and_publish
from municipal_events import BERLIN, Document, municipality_for_venue
from publications import acquire


def notice_events(html, source, now):
    document = Document(html).root
    headings = [
        node.text().removesuffix(" | Aktuelle Nachrichten und Informationen")
        for node in document.find(tag="h1")
    ]
    bodies = [
        node for node in document.find() if node.attrs.get("itemprop") == "articleBody"
    ]
    if source["headline"] not in headings or len(bodies) != 1:
        raise ValueError("Expected municipal notice missing or ambiguous")
    lines = [node.text() for node in bodies[0].find(tag="p")]
    invitations = [line for line in lines if "Weitere interessierte Bürger" in line]
    if len(invitations) != 1 or not source["event_titles"]:
        raise ValueError("Expected invitation or event selection missing")
    events = []
    for label, title in source["event_titles"].items():
        matching = [line for line in lines if line.startswith(label + ":")]
        if len(matching) != 1:
            raise ValueError("Municipal event missing or repeated")
        match = re.fullmatch(
            re.escape(label)
            + r":\s*(\d{2}\.\d{2}\.\d{4}),\s*um\s+(\d{1,2}(?::\d{2})?)\s*Uhr\s+(?:im|in der)\s+(.+)",
            matching[0],
        )
        if not match:
            raise ValueError("Municipal event date/time/venue changed")
        day, clock, venue = match.groups()
        start = datetime.strptime(
            day + " " + clock, "%d.%m.%Y %H:%M" if ":" in clock else "%d.%m.%Y %H"
        ).replace(tzinfo=BERLIN)
        verified = source["verified_venues"].get(venue)
        if (
            not verified
            or municipality_for_venue(verified["venue_name"])
            != verified["municipality"]
        ):
            raise ValueError("Municipal event venue requires verification")
        identity = hashlib.sha256(
            (label + "|" + start.isoformat()).encode()
        ).hexdigest()[:20]
        events.append(
            {
                "id": source["id"] + "-" + identity,
                "title": title,
                "organizer": "Gemeinde Groß-Rohrheim",
                "venue_name": verified["venue_name"],
                "municipality": verified["municipality"],
                "start_time": start.isoformat(),
                "end_time": None,
                "category": "civic",
                "description": matching[0]
                + " "
                + invitations[0]
                + " Endzeit und Eintrittspreis nicht angegeben; siehe Gemeindemitteilung.",
                "event_url": source["url"],
                "source": source["id"],
                "is_free": False,
                "status": "past" if start < now else "scheduled",
            }
        )
    return events


async def import_municipal_notice_events(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    events = notice_events(response.text, source, now)
    async with conn.transaction():
        await conn.execute(
            """DELETE FROM cultural_events WHERE source=%s AND NOT (id = ANY(%s))
            AND COALESCE(end_time,start_time) >= %s""",
            (source["id"], [event["id"] for event in events], now),
        )
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
