"""Individually verified municipal festival announcements, without invented hours."""

import hashlib
from datetime import UTC, date, datetime

from adapters import sync_cultural_events_to_db_and_publish
from municipal_events import Document, event_period
from publications import acquire

SOURCES = {
    "lampertheim-wanderung-festival-notice",
    "lampertheim-spargelfest-festival-notice",
    "lampertheim-howwemer-festival-notice",
    "lampertheim-kerwe-festival-notice",
}


def municipal_festival_notice(html, source, now):
    root = Document(html).root
    if source["id"] not in SOURCES or [n.text() for n in root.find(tag="h1")] != [
        source["verified_heading"]
    ]:
        raise ValueError("Expected municipal festival page missing or ambiguous")
    hashes = [hashlib.sha256(n.text().encode()).hexdigest() for n in root.find(tag="p")]
    if not source["verified_paragraph_sha256"] or any(
        hashes.count(digest) != 1 for digest in source["verified_paragraph_sha256"]
    ):
        raise ValueError(
            "Festival dates, venue or programme changed; verification required"
        )
    verified = source["verified_event"]
    first = date.fromisoformat(verified["start_date"])
    last = date.fromisoformat(verified["end_date"])
    if (
        verified["municipality"] != "Lampertheim"
        or first.year != 2027
        or last.year != 2027
        or not 0 <= (last - first).days <= 4
    ):
        raise ValueError("Festival outside individually verified place or date range")
    start, end = event_period(first.isoformat(), end_date=last.isoformat())
    return {
        "id": source["id"] + "-2027",
        "title": verified["title"],
        "organizer": verified["organizer"],
        "venue_name": verified["venue_name"],
        "municipality": verified["municipality"],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "category": verified["category"],
        "event_url": source["url"],
        "source": source["id"],
        "is_free": False,
        "status": "past" if end < now else "scheduled",
        "description": "Offizieller Datumshinweis für 2027 auf der Website der Stadt Lampertheim. "
        "Bestätigt sind die veröffentlichten Veranstaltungstage und der genannte Veranstaltungsbereich. "
        "Uhrzeiten, konkretes Programm und Eintrittspreise sind noch nicht für 2027 veröffentlicht. "
        "Tagesgrenzen dienen ausschließlich der Kalenderdarstellung. "
        "Allgemeine Angaben zu traditionellen Eröffnungen sind kein bestätigtes Tagesprogramm für 2027.",
    }


async def import_municipal_festival_notice(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    event = municipal_festival_notice(response.text, source, now)
    async with conn.transaction():
        await sync_cultural_events_to_db_and_publish(conn, source, [event], digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
