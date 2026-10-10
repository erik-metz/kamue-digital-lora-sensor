"""Read all published club schedules; no fixed course or clock-time allowlists."""

import logging
import re

from dynamic_calendar import WEEKDAYS, clock, identity
from municipal_events import Document, municipality_for_venue

LOG = logging.getLogger(__name__)
TIMES = r"(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})"


def weekday(text):
    return next(
        (day for day in WEEKDAYS if re.search(day + r"s?\b", text, re.IGNORECASE)), None
    )


def offer(source, title, day, start, venue, description, end=None, key=None):
    municipality = municipality_for_venue(venue)
    if not municipality or not day:
        LOG.info("Offer deferred: missing local venue or weekday, title=%s", title)
        return None
    result = {
        "id": source["id"] + "-" + identity(key or title + day + start + venue),
        "title": title,
        "weekday": day,
        "start_local": clock(start),
        "venue_name": venue,
        "municipality": municipality,
        "organizer": source.get("organizer", "Veranstalter siehe Quelle"),
        "timezone": "Europe/Berlin",
        "source": source["id"],
        "source_url": source["url"],
        "description": description
        + " Kosten, Anmeldung, Mitgliedschaft, freie Plätze und Ausfälle bitte beim Verein prüfen.",
    }
    if end:
        result["end_local"] = clock(end)
        if result["end_local"] <= result["start_local"]:
            raise ValueError("Offer clock range reversed")
    return result


def checked(offers):
    if not offers or len(offers) > 200 or len({o["id"] for o in offers}) != len(offers):
        raise ValueError("Offer schedule missing, duplicated or unbounded")
    return offers


def dance(html, source):
    root = Document(html).root
    if [n.text() for n in root.find(tag="h1")].count("Unser Kursangebot") != 1:
        raise ValueError("Dance course overview missing or ambiguous")
    offers = []
    for card in root.find(cls="listText"):
        titles = list(card.find(cls="itemName"))
        text = card.text()
        if len(titles) != 1:
            raise ValueError("Dance title missing")
        title = titles[0].text()
        times = re.findall(TIMES, text)
        places = [n.text() for n in card.find(tag="strong")]
        if len(times) != 1 or len(places) != 1:
            LOG.info("Dance card deferred: incomplete schedule, title=%s", title)
            continue
        place = places[0]
        parsed = offer(
            source,
            "Line Dance – " + title,
            weekday(title),
            *times[0][:1],
            place,
            text,
            end=times[0][1],
            key=card.attrs.get("id") or title,
        )
        if parsed:
            offers.append(parsed)
    return checked(offers)


def gymnastics(html, venue_html, source):
    root = Document(html).root
    if [n.text() for n in root.find(tag="h1")] != ["Gymnastikgruppen"]:
        raise ValueError("Gymnastics page missing or ambiguous")
    proof = Document(venue_html).root.text()
    street = re.search(
        r"(?:Hallenanbau|Bürgerhalle).*?in der ([\wäöüß -]+straße)", proof
    )
    if not street:
        raise ValueError("Gymnastics local venue proof missing")
    sections, current, day = [], None, None
    for n in root.find():
        if n.tag == "h3":
            title = n.text()
            if title in WEEKDAYS:
                day, current = title, None
            elif day:
                current = {"title": title, "day": day, "text": []}
                sections.append(current)
        elif n.tag == "p" and current is not None:
            current["text"].append(n.text())
    offers = []
    for section in sections:
        # The first paragraph is the published group schedule; exclude footers.
        text = " ".join(section["text"][:3])
        schedule = section["text"][0] if section["text"] else ""
        times = re.findall(TIMES, schedule)
        room = re.search(r"\b(Hallenanbau|kleiner Hallenteil|Bürgerhalle)\b", schedule)
        if not room or not times:
            LOG.info(
                "Gymnastics group deferred: missing room/time, title=%s",
                section["title"],
            )
            continue
        venue = room[1] + ", " + street[1] + ", Groß-Rohrheim"
        for start, end in times:
            parsed = offer(
                source,
                section["title"],
                section["day"],
                start,
                venue,
                "Bitte vor der ersten Teilnahme Kontakt aufnehmen. " + text,
                end=end,
            )
            if parsed:
                offers.append(parsed)
    return checked(offers)


def running(html, source, *, buerstadt=False):
    root = Document(html).root
    expected = "Trainingszeiten Lauftreff" if buerstadt else "Lauftreff"
    if [n.text() for n in root.find(tag="h1")] != [expected]:
        raise ValueError("Running schedule page missing or ambiguous")
    paragraphs = [n.text() for n in root.find(tag="p")]
    offers = []
    if not buerstadt:
        schedule = next((p for p in paragraphs if "Wann?" in p and "Wo?" in p), "")
        match = re.search(
            r"(\d{1,2}(?:[:.]\d{2})?)\s*Uhr.*?Wo\?\s*(.*?)\s*Wer\?", schedule
        )
        if match:
            venue = match[2]
            # Resolve this venue name only, never any arbitrary outside address.
            if venue == "Eingang Bürgerhalle":
                venue += ", Groß-Rohrheim"
            parsed = offer(
                source,
                "TV-Lauftreff",
                weekday(schedule),
                match[1],
                venue,
                " ".join(paragraphs),
            )
            if parsed:
                offers.append(parsed)
    else:
        for text in paragraphs:
            # Each sentence must itself give weekday, time and actual meeting point.
            for sentence in re.split(r"(?<=[.!])\s+", text):
                day = weekday(sentence)
                hour = re.search(r"\b(\d{1,2}(?:[:.]\d{2})?)\s*Uhr\b", sentence)
                if not day or not hour:
                    continue
                venue = re.search(r"(?:am|ab)\s+(TV Heim\s*\([^)]*\))", sentence)
                if not venue:
                    LOG.info(
                        "Running offer deferred: unnamed meeting place, weekday=%s", day
                    )
                    continue
                parsed = offer(
                    source,
                    "TV Bürstadt – " + day + "-Lauftreff",
                    day,
                    hour[1],
                    venue[1] + ", Bürstadt",
                    sentence
                    + " "
                    + " ".join(
                        p for p in paragraphs if "ersten Mal" in p or "Anmeldung" in p
                    ),
                )
                if parsed:
                    offers.append(parsed)
    return checked(offers)


def triathlon(html, source):
    root = Document(html).root
    paragraphs = [n.text() for n in root.find(tag="p")]
    if sum("Trainingszeiten" in p and "Triathlon" in p for p in paragraphs) != 1:
        raise ValueError("Triathlon schedule page missing")
    offers, seen = [], set()
    for i, text in enumerate(paragraphs):
        match = re.fullmatch(
            r"(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+"
            r"(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2})|\s*Uhr)?"
            r"(?:\s*\([^)]*\))?\s*/\s*(.+)",
            text,
        )
        if not match:
            continue
        day, start, end, venue = match.groups()
        key = day + start + venue
        if key in seen:
            continue
        seen.add(key)
        following = []
        for paragraph in paragraphs[i + 1 :]:
            if re.match(r"(?:" + "|".join(WEEKDAYS) + r")\s+\d", paragraph):
                break
            following.append(paragraph)
        description = " ".join([text] + following[:3])
        # Alternative swim hours are not assigned to a season in this text.
        # Keep their ambiguity explicit rather than asserting simultaneous slots.
        if "Hallenbad der" in venue and day == "Montag":
            LOG.info(
                "Triathlon offer deferred: ambiguous seasonal swim variant, schedule=%s",
                text,
            )
            continue
        title = "TVL Triathlon – " + day + " Training"
        for label in ("Laufschule", "Rumpf", "Zirkel", "Radausfahrten"):
            if label.casefold() in description.casefold():
                title = "TVL Triathlon – " + label
                break
        parsed = offer(source, title, day, start, venue, description, end=end)
        if parsed:
            offers.append(parsed)
    return checked(offers)
