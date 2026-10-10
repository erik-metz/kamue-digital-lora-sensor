"""Published municipal festival dates, across years, without invented programmes."""

from datetime import UTC, datetime

from adapters import sync_cultural_events_to_db_and_publish
from dynamic_calendar import explicit_periods, reconcile_future
from municipal_events import Document, event_period
from publications import acquire


def municipal_festival_events(html, source, now):
    root = Document(html).root
    if [n.text() for n in root.find(tag="h1")] != [source["verified_heading"]]:
        raise ValueError("Expected municipal festival page missing or ambiguous")
    paragraphs = [n.text() for n in root.find(tag="p")]
    periods = list(
        dict.fromkeys(
            period
            for text in paragraphs
            if "findet" in text
            for period in explicit_periods(text)
        )
    )
    if not periods or len(periods) > 20:
        raise ValueError("Festival announcement dates missing or unbounded")
    metadata = source["event_metadata"]
    if metadata["municipality"] != "Lampertheim":
        raise ValueError("Festival outside source municipality")
    venue = "Lampertheim – genauer Veranstaltungsort siehe Veranstaltungsseite"
    text = " ".join(paragraphs)
    for marker in ("Gemarkung", "Innenstadtfest", "Gartenstraße", "Römerstraße"):
        if marker in text and marker in metadata["venue_name"]:
            venue = metadata["venue_name"]
    result = []
    for first, last in periods:
        start, end = event_period(first, end_date=last)
        if (end - start).days > 4:
            raise ValueError("Festival date range unbounded")
        result.append(
            {
                "id": source["id"] + "-" + first[:4],
                "title": metadata["title"],
                "organizer": metadata["organizer"],
                "venue_name": venue,
                "municipality": metadata["municipality"],
                "category": metadata["category"],
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "event_url": source["url"],
                "source": source["id"],
                "is_free": False,
                "status": "past" if end < now else "scheduled",
                "description": "Offizieller aktueller Datumshinweis der Stadt Lampertheim. "
                "Bestätigt sind die veröffentlichten Veranstaltungstage. "
                "Uhrzeiten, konkretes Programm und Eintrittspreise sind nicht vollständig veröffentlicht. "
                "Tagesgrenzen dienen ausschließlich der Kalenderdarstellung. "
                "Traditionelle Eröffnungen sind kein bestätigtes aktuelles Tagesprogramm.",
            }
        )
    if len({e["id"] for e in result}) != len(result):
        raise ValueError("Conflicting festival dates in same calendar year")
    return result


def municipal_festival_notice(html, source, now):
    events = municipal_festival_events(html, source, now)
    if len(events) != 1:
        raise ValueError("Use complete municipal festival event list")
    return events[0]


async def import_municipal_festival_notice(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    events = municipal_festival_events(response.text, source, now)
    async with conn.transaction():
        await reconcile_future(conn, source, events, now)
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
