"""Shared parsing of published dates, bounded discovery and per-source diagnostics."""

import hashlib
import re
from datetime import date
from urllib.parse import urljoin, urlsplit, urlunsplit

from municipal_events import Document

MONTHS = {
    name: i
    for i, name in enumerate(
        (
            "januar",
            "februar",
            "märz",
            "april",
            "mai",
            "juni",
            "juli",
            "august",
            "september",
            "oktober",
            "november",
            "dezember",
        ),
        1,
    )
}
WEEKDAYS = (
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
)


def explicit_periods(text):
    """Read explicit years only, including a year before a named date."""
    result = []
    for match in re.finditer(
        r"(?:(?P<year>20\d{2})\s+findet\s+(?:am|vom|von)\s+)?"
        r"(?P<first>\d{1,2})\s*\.\s*"
        r"(?:(?:bis|[-–/])\s*(?P<last>\d{1,2})\s*\.\s*)?"
        r"(?P<month>Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)"
        r"(?:\s+(?P<after>20\d{2}))?",
        text,
        re.IGNORECASE,
    ):
        year = match["after"] or match["year"]
        if not year:
            continue
        month = MONTHS[match["month"].casefold()]
        first = date(int(year), month, int(match["first"]))
        last = date(int(year), month, int(match["last"] or match["first"]))
        if last < first:
            raise ValueError("Published date range reversed")
        result.append((first.isoformat(), last.isoformat()))
    return list(dict.fromkeys(result))


def clock(value):
    match = re.fullmatch(r"(\d{1,2})(?:[:.](\d{2}))?", value.strip())
    if not match or int(match[1]) > 23 or int(match[2] or 0) > 59:
        raise ValueError("Invalid published clock time")
    return f"{int(match[1]):02}:{int(match[2] or 0):02}"


def identity(value):
    return hashlib.sha256(value.encode()).hexdigest()[:24]


def internal_links(html, url, *, section=None):
    root = Document(html).root
    if section:
        roots = [
            n
            for n in root.find(tag="li")
            if any(a.text().casefold() == section.casefold() for a in n.find(tag="a"))
        ]
        # Choose the smallest enclosing menu item, never the whole navigation.
        if not roots:
            raise ValueError("Calendar discovery menu missing")
        root = min(roots, key=lambda n: len(n.text()))
    result = []
    for node in root.find(tag="a"):
        if section and node.text().casefold() == section.casefold():
            continue
        link = urljoin(url, node.attrs.get("href", ""))
        parts = urlsplit(link)
        if parts.scheme != "https" or parts.netloc != urlsplit(url).netloc:
            continue
        link = urlunsplit(parts._replace(fragment=""))
        if link not in result and parts.path not in {"", "/"}:
            result.append(link)
    if len(result) > 100:
        raise ValueError("Calendar discovery exceeds bounded detail limit")
    return result


async def reconcile_future(conn, source, events, now):
    await conn.execute(
        """DELETE FROM cultural_events WHERE source=%s AND NOT (id=ANY(%s))
        AND COALESCE(end_time,start_time) >= %s""",
        (source["id"], [event["id"] for event in events], now),
    )
