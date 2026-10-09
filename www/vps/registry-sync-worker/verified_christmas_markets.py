"""Two reviewed 2026 district markets, with separate daily opening windows."""

import hashlib
import re
from datetime import UTC, datetime

from adapters import sync_cultural_events_to_db_and_publish
from municipal_events import Document, event_period
from publications import acquire

SOURCE_ID = "lampertheim-district-christmas-markets"
URL = "https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php"
MARKETS = {
    "Hofheimer Weihnachtsmarkt": (
        "Howwemer Weihnachtsmarkt", "Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim",
        "Arbeitskreis Hofheimer Vereine und Stadtmarketing Lampertheim",
        [("2026-12-05", "16:00", "21:00"), ("2026-12-06", "15:00", "19:00")],
    ),
    "Hüttenfelder Weihnachtsmarkt": (
        "Hüttenfelder Weihnachtsmarkt", "Rund ums Bürgerhaus Hüttenfeld, Lampertheim-Hüttenfeld",
        "Pro Hüttenfeld", [("2026-12-12", "15:00", "21:00")],
    ),
}


def market_sections(html):
    result = {}
    for heading, body in re.findall(r"<h2\b[^>]*>(.*?)</h2>(.*?)(?=<h2\b|$)", html, re.DOTALL | re.IGNORECASE):
        heading = Document(heading).root.text()
        if heading in MARKETS:
            if heading in result:
                raise ValueError("Ambiguous district market section")
            result[heading] = " ".join(n.text() for n in Document(body).root.find(tag="p") if n.text())
    if result.keys() != MARKETS.keys():
        raise ValueError("Expected district market sections missing")
    return result


def christmas_markets(html, source, now):
    if source["id"] != SOURCE_ID or source["url"] != URL:
        raise ValueError("Unexpected district market source")
    sections = market_sections(html)
    hashes = {key: hashlib.sha256(value.encode()).hexdigest() for key, value in sections.items()}
    if hashes != source["verified_section_sha256"]:
        raise ValueError("Christmas market dates or venues changed; verification required")
    events = []
    for title, venue, organizer, days in MARKETS.values():
        for day, opening, closing in days:
            start, end = event_period(day, opening, end_time=closing)
            events.append({
                "id": SOURCE_ID + "-" + day,
                "title": title, "municipality": "Lampertheim",
                "venue_name": venue, "organizer": organizer,
                "start_time": start.isoformat(), "end_time": end.isoformat(),
                "category": "market", "is_free": False,
                "status": "past" if end < now else "scheduled",
                "source": SOURCE_ID, "event_url": URL,
                "description": "Öffentlicher Weihnachtsmarkt. Bestätigte tägliche Öffnungszeiten 2026 laut Stadtmarketing Lampertheim. "
                "Dieser Eintrag zeigt ausschließlich den jeweiligen Öffnungstag. Eintrittspreise sind nicht angegeben.",
            })
    return events


async def import_christmas_markets(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    events = christmas_markets(response.text, source, now)
    async with conn.transaction():
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        await conn.execute("UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,))
    await conn.commit()
