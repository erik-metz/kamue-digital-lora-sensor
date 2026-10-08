"""Explicit municipal festival date announcements, with unknown programme details."""

import re
from datetime import UTC, date, datetime

from adapters import sync_cultural_events_to_db_and_publish
from municipal_events import Document, event_period
from publications import acquire

MONTHS = {"Mai": 5, "August": 8}
INTRO = "Für Ihre langfristige Terminplanung geben wir Ihnen hier die Termine von Maimarkt, Konfirmation, Pfingsten und Kirchweih bekannt"


def long_term_events(html, source, now):
    root = Document(html).root
    headings = [node.text() for node in root.find(tag="h2")]
    paragraphs = [node.text() for node in root.find(tag="p")]
    # This adapter is restricted to the municipality's two local festival series.
    # No organizer-address fallback is used for other events or other pages.
    if (
        source["id"] != "gross-rohrheim-long-term-events"
        or "Langfristige Termine" not in headings
        or paragraphs.count(INTRO) != 1
    ):
        raise ValueError("Expected municipal festival date announcement missing")
    events = []
    for label, title, month in [
        ("Maimarkt", "Maimarkt", "Mai"),
        ("Kirchweih", "Rohremer Kerb / Kirchweih", "August"),
    ]:
        lines = [p for p in paragraphs if p.startswith(label + " ")]
        if len(lines) != 1:
            raise ValueError("Festival date announcement missing or ambiguous")
        remaining = lines[0][len(label) :].strip()
        matches = list(
            re.finditer(
                r"(\d{1,2})\.(?:/(\d{1,2})\.)?\s*(Mai|August)\s+(\d{4})", remaining
            )
        )
        if (
            not matches
            or re.sub(
                r"(\d{1,2})\.(?:/(\d{1,2})\.)?\s*(Mai|August)\s+(\d{4})", "", remaining
            ).strip()
        ):
            raise ValueError("Festival date format changed")
        years = set()
        for match in matches:
            first, last, published_month, year = match.groups()
            if (
                published_month != month
                or year in years
                or bool(last) != (label == "Maimarkt")
            ):
                raise ValueError("Festival dates require verification")
            years.add(year)
            start_date = date(int(year), MONTHS[month], int(first))
            end_date = date(int(year), MONTHS[month], int(last or first))
            if end_date < start_date or (
                label == "Maimarkt" and (end_date - start_date).days != 1
            ):
                raise ValueError("Unexpected festival date range")
            if int(year) not in source["years"]:
                continue
            start, end = event_period(
                start_date.isoformat(), end_date=end_date.isoformat()
            )
            events.append(
                {
                    "id": f"{source['id']}-{label.lower()}-{year}",
                    "title": title,
                    "organizer": "Gemeinde Groß-Rohrheim",
                    "venue_name": "Groß-Rohrheim – genauer Veranstaltungsort noch nicht veröffentlicht",
                    "municipality": "Groß-Rohrheim",
                    "start_time": start.isoformat(),
                    "end_time": end.isoformat(),
                    "category": "festival",
                    "event_url": source["url"],
                    "source": source["id"],
                    "is_free": False,
                    "status": "past" if end < now else "scheduled",
                    "description": "Offizieller Datumshinweis der Gemeinde Groß-Rohrheim. "
                    "Uhrzeiten, genaue Veranstaltungsplätze, Programm und Eintrittspreise sind noch nicht veröffentlicht. "
                    "Tagesgrenzen dienen ausschließlich der Kalenderdarstellung. "
                    + (
                        "Nur der veröffentlichte Kirchweihtag ist bestätigt; weitere Kerbtage sind nicht angegeben."
                        if label == "Kirchweih"
                        else "Bestätigt sind die beiden veröffentlichten Markttage."
                    ),
                }
            )
        if not all(str(year) in years for year in source["years"]):
            raise ValueError("Configured festival year missing")
    if not events:
        raise ValueError("No configured festival dates")
    return events


async def import_long_term_events(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    events = long_term_events(response.text, source, now)
    async with conn.transaction():
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
