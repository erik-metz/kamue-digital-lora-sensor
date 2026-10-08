"""Verified weekly club offers, without fabricated calendar occurrences."""

import hashlib
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


def buerstadt_lauftreff(html, source):
    root = Document(html).root
    if "Trainingszeiten Lauftreff" not in [n.text() for n in root.find(tag="h1")]:
        raise ValueError("Bürstadt training page missing")
    paragraphs = [n.text() for n in root.find(tag="p")]
    for digest in source["verified_paragraph_sha256"]:
        if (
            sum(hashlib.sha256(p.encode()).hexdigest() == digest for p in paragraphs)
            != 1
        ):
            raise ValueError(
                "Bürstadt schedule or participation changed; verification required"
            )
    return [
        {
            "id": "tv-buerstadt-lauftreff-dienstag",
            "title": "TV Bürstadt – Dienstags-Lauftreff",
            "organizer": "TV 1891 Bürstadt",
            "municipality": "Bürstadt",
            "weekday": "Dienstag",
            "start_local": "18:00",
            "timezone": "Europe/Berlin",
            "venue_name": "TV-Heim, Wasserwerkstraße, Bürstadt",
            "description": "Auch für Einsteiger. Der Verein bittet darum, die erste Teilnahme "
            "vorher beim Lauftreff anzukündigen (lauftreff-buerstadt@gmx.de). "
            "Endzeit, Kosten und konkrete Ausfalltermine sind nicht veröffentlicht. "
            "Bitte aktuelle Angaben beim Verein prüfen.",
            "source": source["id"],
            "source_url": source["url"],
        }
    ]


async def import_regular_offers(conn, client, source, parser):
    response, digest, attempt = await acquire(conn, client, source)
    offers = parser(response.text, source)
    now = datetime.now(UTC)
    async with conn.transaction():
        await publish(
            conn, source, "social/regular-offers/" + source["id"], offers, digest, now
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,)
        )
    await conn.commit()


async def import_tv_lauftreff(conn, client, source):
    await import_regular_offers(conn, client, source, tv_lauftreff)


async def import_buerstadt_lauftreff(conn, client, source):
    await import_regular_offers(conn, client, source, buerstadt_lauftreff)


def rompin_stompin(html, source):
    root = Document(html).root
    if "Unser Kursangebot" not in [n.text() for n in root.find(tag="h1")]:
        raise ValueError("Line dance course overview missing")
    for proof in [
        "Darmstädter Straße 4-6 68647 Biblis",
        "Mainstraße 44 68642 Bürstadt",
    ]:
        if proof not in root.text():
            raise ValueError("Verified dance venue address changed")
    hashes = [
        hashlib.sha256(n.text().encode()).hexdigest() for n in root.find(cls="listText")
    ]
    offers = []
    for verified in source["verified_courses"]:
        if hashes.count(verified["card_sha256"]) != 1:
            raise ValueError("Dance course changed or ambiguous; verification required")
        if verified["municipality"] not in {"Biblis", "Bürstadt"}:
            raise ValueError("Dance venue outside agreed Ried area")
        offer = {k: v for k, v in verified.items() if k != "card_sha256"}
        offer.update(
            organizer="Rompin Stompin Line Dancer Biblis e.V.",
            timezone="Europe/Berlin",
            source=source["id"],
            source_url=source["url"],
            description="Tanzangebot des Vereins. "
            "Kosten, Anmeldung und freie Plätze bitte beim Verein erfragen. "
            "Feiertage und Ausfälle sind nicht als einzelne Termine veröffentlicht.",
        )
        offers.append(offer)
    return offers


async def import_rompin_stompin(conn, client, source):
    await import_regular_offers(conn, client, source, rompin_stompin)
