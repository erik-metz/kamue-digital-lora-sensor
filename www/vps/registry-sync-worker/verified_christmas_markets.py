"""Published market sections and daily opening hours, across calendar years."""

import re
from datetime import UTC, date, datetime

from adapters import sync_cultural_events_to_db_and_publish
from dynamic_calendar import clock, identity, reconcile_future
from event_replacements import REPLACED_SOURCE, REPLACED_URLS
from municipal_events import BERLIN, Document, event_period, municipality_for_venue
from publications import acquire

SOURCE_ID = "lampertheim-district-christmas-markets"
URL = "https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php"
MARKETS = {
    "Lampertheimer Weihnachtsmarkt": (
        "Lampertheimer Weihnachtsmarkt",
        "Schillerplatz und Kaiserstraße ab Hausnummer 21, Lampertheim",
        "Stadt Lampertheim",
    ),
    "Hofheimer Weihnachtsmarkt": (
        "Howwemer Weihnachtsmarkt",
        "Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim",
        "Arbeitskreis Hofheimer Vereine und Stadtmarketing Lampertheim",
    ),
    "Hüttenfelder Weihnachtsmarkt": (
        "Hüttenfelder Weihnachtsmarkt",
        "Rund ums Bürgerhaus Hüttenfeld, Lampertheim-Hüttenfeld",
        "Pro Hüttenfeld",
    ),
    "Neuschlosser Weihnachtsmarkt": (
        "Schlosshofzauber / Neuschlosser Weihnachtsmarkt",
        "Schloßhof Neuschloß, Lampertheim-Neuschloß",
        "Ortsbeirat Neuschloß / Die Meute e.V.",
    ),
}


def market_sections(html):
    result = {}
    for heading, body in re.findall(
        r"<h2\b[^>]*>(.*?)</h2>(.*?)(?=<h2\b|$)", html, re.DOTALL | re.IGNORECASE
    ):
        heading = Document(heading).root.text()
        if "Weihnachtsmarkt" in heading and (
            heading in MARKETS
            or municipality_for_venue(re.sub(r"er\b", "", heading)) == "Lampertheim"
        ):
            if heading in result:
                raise ValueError("Ambiguous district market section")
            result[heading] = " ".join(
                n.text()
                for n in Document(body.split("<!--CONTENT:STOP-->", 1)[0]).root.find(
                    tag="p"
                )
                if n.text()
            )
    if not result:
        raise ValueError("Expected district market sections missing")
    return result


def christmas_markets(html, source, now):
    if source["id"] != SOURCE_ID or source["url"] != URL:
        raise ValueError("Unexpected district market source")
    sections = market_sections(html)
    events = []
    for heading, section in sections.items():
        title, venue, organizer = MARKETS.get(
            heading,
            (
                heading,
                "Lampertheim – genauer Marktbereich siehe Quelle",
                "Veranstalter siehe Quelle",
            ),
        )
        schedules = re.split(r"Öffnungszeiten\s+(20\d{2})\s*:", section)
        if len(schedules) < 3:
            raise ValueError("Christmas market explicit schedule year missing")
        # Preserve known geography only while its place is still in the source.
        prefix = schedules[0]
        if "Hofheim" in heading or "Hüttenfeld" in heading:
            district = "Hofheim" if "Hofheim" in heading else "Hüttenfeld"
            venue = (
                "Rund ums Bürgerhaus " + district + ", Lampertheim-" + district
                if "Bürgerhaus" in prefix
                else "Lampertheim-" + district + " – Ort siehe Quelle"
            )
        elif "Neuschloss" in heading:
            venue = (
                "Schloßhof Neuschloß, Lampertheim-Neuschloß"
                if "Schloßhof" in prefix
                else "Lampertheim-Neuschloß – Ort siehe Quelle"
            )
        elif not all(word in prefix for word in ("Schillerplatz", "Kaiserstraße")):
            venue = "Lampertheim – genauer Marktbereich siehe Quelle"
        days = []
        for year, schedule in zip(schedules[1::2], schedules[2::2], strict=True):
            matches = list(
                re.finditer(
                    r"(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*"
                    r"(\d{1,2})\.(\d{1,2})\.(?:\s*20\d{2})?,?\s*"
                    r"(\d{1,2}(?:[:.]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[:.]\d{2})?)\s*Uhr",
                    schedule,
                )
            )
            if not matches:
                raise ValueError("Christmas market opening days missing")
            for match in matches:
                day = date(int(year), int(match[2]), int(match[1])).isoformat()
                days.append((day, clock(match[3]), clock(match[4])))
        if len(days) != len({day for day, _, _ in days}):
            raise ValueError("Christmas market duplicate opening day")
        for day, opening, closing in days:
            if closing <= opening:
                raise ValueError("Christmas market daily opening range reversed")
            start, end = event_period(day, opening, end_time=closing)
            events.append(
                {
                    "id": SOURCE_ID
                    + "-"
                    + (
                        "kernstadt-"
                        if title == "Lampertheimer Weihnachtsmarkt"
                        else "neuschloss-"
                        if title.startswith("Schlosshofzauber")
                        else ""
                        if heading in MARKETS
                        else identity(heading) + "-"
                    )
                    + day,
                    "title": title,
                    "municipality": "Lampertheim",
                    "venue_name": venue,
                    "organizer": organizer,
                    "start_time": start.isoformat(),
                    "end_time": end.isoformat(),
                    "category": "market",
                    "is_free": False,
                    "status": "past" if end < now else "scheduled",
                    "source": SOURCE_ID,
                    "event_url": URL,
                    "description": "Öffentlicher Weihnachtsmarkt. Bestätigte tägliche Öffnungszeiten laut Stadtmarketing Lampertheim. "
                    "Dieser Eintrag zeigt ausschließlich den jeweiligen Öffnungstag. Eintrittspreise sind nicht angegeben.",
                }
            )
    return events


async def import_christmas_markets(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    now = datetime.now(UTC)
    events = christmas_markets(response.text, source, now)
    async with conn.transaction():
        # Remove only the three reviewed 2026 originals, atomically with their
        # validated replacements. Other sources and years remain untouched.
        await conn.execute(
            """DELETE FROM cultural_events WHERE source=%s AND event_url = ANY(%s)
               AND start_time >= %s AND start_time < %s""",
            (
                REPLACED_SOURCE,
                list(REPLACED_URLS),
                datetime(2026, 1, 1, tzinfo=BERLIN),
                datetime(2027, 1, 1, tzinfo=BERLIN),
            ),
        )
        await reconcile_future(conn, source, events, now)
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
