"""Verified weekly club offers, without fabricated calendar occurrences."""

from datetime import UTC, datetime

from municipal_events import Document
from publications import acquire, publish


def tv_lauftreff(html, source):
    root = Document(html).root
    if "Lauftreff" not in [node.text() for node in root.find(tag="h1")]:
        raise ValueError("TV Lauftreff page missing")
    paragraphs = [node.text() for node in root.find(tag="p")]
    expected = (
        "Wann? Immer mittwochs 19.00 Uhr Wo? Eingang Bürgerhalle "
        "Wer? Läufer/innenund alle die es werden wollen Kontakt: "
        "Simone Schäfer, Matthias Kratzke, Simone Lutzi"
    )
    safety = "Wichtig! Bitte kleidet euch so, dass ihr gut gesehen werdet und wer hat bringt gerne seine Stirnlampe mit."
    if paragraphs.count(expected) != 1 or safety not in paragraphs:
        raise ValueError("Lauftreff schedule changed; verification required")
    return [
        {
            "id": "tv-gross-rohrheim-lauftreff",
            "title": "TV-Lauftreff",
            "organizer": "TV Groß-Rohrheim",
            "municipality": "Groß-Rohrheim",
            "weekday": "Mittwoch",
            "start_local": "19:00",
            "timezone": "Europe/Berlin",
            "venue_name": "Eingang Bürgerhalle, Groß-Rohrheim",
            "description": "Für Läuferinnen und Läufer und alle, die es werden wollen. "
            "Der Verein bittet um gut sichtbare Kleidung und, falls vorhanden, eine Stirnlampe. "
            "Endzeit, Kosten und einzelne Ausfalltermine sind nicht veröffentlicht. "
            "Bitte aktuelle Angaben beim Verein prüfen.",
            "source": source["id"],
            "source_url": source["url"],
        }
    ]


async def import_tv_lauftreff(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    offers = tv_lauftreff(response.text, source)
    now = datetime.now(UTC)
    async with conn.transaction():
        await publish(conn, source, "social/regular-offers", offers, digest, now)
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()
