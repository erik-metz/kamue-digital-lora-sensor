"""Municipal calendar parsing and the agreed four-municipality event boundary."""

import hashlib
import logging
import re
from datetime import datetime, timedelta
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")
EVENT_HORIZON_YEARS = 5
PLACES = {
    "Bürstadt": ("bürstadt", "buerstadt", "bobstadt", "riedrode"),
    "Lampertheim": (
        "lampertheim",
        "hofheim",
        "hüttenfeld",
        "huettenfeld",
        "neuschloß",
        "neuschloss",
        "rosengarten",
    ),
    "Biblis": ("biblis", "nordheim", "wattenheim"),
    "Groß-Rohrheim": (
        "groß-rohrheim",
        "gross-rohrheim",
        "groß rohrheim",
        "gross rohrheim",
    ),
}
POSTCODES = {
    "68642": "Bürstadt",
    "68623": "Lampertheim",
    "68647": "Biblis",
    "68649": "Groß-Rohrheim",
}


def municipality_for_venue(text, *, city=None, postcode=None):
    """Explicit structured addresses override venue names; never use organizer names."""
    if city:
        normalized = city.casefold().strip()
        for municipality, names in PLACES.items():
            if any(
                re.fullmatch(
                    re.escape(name)
                    + r"(?:\s*[-/]\s*.*|\s+(?:riedrode|bobstadt|hofheim|hüttenfeld|huettenfeld|neuschloß|neuschloss|rosengarten|nordheim|wattenheim))?",
                    normalized,
                )
                for name in names
            ):
                if postcode and str(postcode) not in POSTCODES:
                    return None
                return municipality
        return None
    if postcode:
        return POSTCODES.get(str(postcode))
    matches = {
        municipality
        for municipality, names in PLACES.items()
        if any(
            re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", text.casefold())
            for name in names
        )
    }
    return next(iter(matches)) if len(matches) == 1 else None


def cross7_venue(venue, source):
    text = " ".join(
        filter(None, [venue.get("name"), venue.get("building"), venue.get("room")])
    )
    municipality = municipality_for_venue(
        text, city=venue.get("city"), postcode=venue.get("zipCode")
    )
    if not municipality and not venue.get("city") and not venue.get("zipCode"):
        # Only individually verified aliases of this source, never a blanket
        # fallback from the calendar's municipality or organizer address.
        aliases = {
            key.casefold(): value
            for key, value in source.get("venue_aliases", {}).items()
        }
        for field in (venue.get("building"), venue.get("name")):
            if field and aliases.get(field.casefold()) in PLACES:
                municipality = aliases[field.casefold()]
                break
    return text, municipality


def event_period(start_date, start_time=None, end_date=None, end_time=None):
    """Unknown times are represented as date bounds, never invented opening hours."""
    start = datetime.fromisoformat(
        start_date[:10] + "T" + (start_time or "00:00:00")
    ).replace(tzinfo=BERLIN)
    end = datetime.fromisoformat(
        (end_date or start_date)[:10] + "T" + (end_time or "23:59:59")
    ).replace(tzinfo=BERLIN)
    if end < start:
        if (end_date or start_date)[:10] != start_date[:10]:
            raise ValueError("Event ends before its start date")
        end += timedelta(days=1)
    return start, end


class Node:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return " ".join(
            " ".join(
                child.text() if isinstance(child, Node) else child
                for child in self.children
            ).split()
        )

    def find(self, *, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (
                    cls is None or cls in child.attrs.get("class", "").split()
                ):
                    yield child
                yield from child.find(tag=tag, cls=cls)


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr",
        }:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def first(node, cls):
    return next(node.find(cls=cls), Node())


def calendar_url(url, now):
    now = now.astimezone(BERLIN)
    parts = urlsplit(url)
    params = dict(parse_qsl(parts.query))
    params.update(dateFrom=f"01.01.{now.year}", dateTo=f"31.12.{now.year + EVENT_HORIZON_YEARS - 1}")
    return urlunsplit(parts._replace(query=urlencode(params), fragment=""))


def calendar_page(html, url, source_id, now, *, recover_details=False):
    root = Document(html).root
    events = []
    blocks = list(root.find(tag="li", cls="listEntryObject-eventMulti"))
    for block in blocks:
        title_node = first(block, "listEntryTitle")
        title = title_node.text()
        dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", first(block, "listEntryDate").text())
        if not title or not dates:
            raise ValueError("Municipal calendar event title/date missing")
        date_iso = [
            datetime.strptime(d, "%d.%m.%Y").replace(tzinfo=BERLIN).date().isoformat()
            for d in dates
        ]
        start_time = re.search(r"\d{1,2}:\d{2}", first(block, "timeFrom").text())
        end_time = re.search(r"\d{1,2}:\d{2}", first(block, "timeTo").text())
        date_conflict = False
        try:
            start, end = event_period(
                date_iso[0],
                start_time[0] if start_time else None,
                date_iso[-1],
                end_time[0] if end_time else None,
            )
        except ValueError:
            logger.warning(
                "Municipal event deferred: invalid source dates, title=%s dates=%s",
                title,
                dates,
            )
            if not recover_details:
                continue
            date_conflict = True
            start, end = event_period(date_iso[0])
        venue = first(block, "listEntryLocation").text()
        # The municipal dropdown labels Kernstadt as Lampertheim. The venue
        # portion is still checked for an explicit external postal address.
        location = re.sub(
            r"^Kernstadt(?:\s*\+\s*Stadtteile)?\s*-", "Lampertheim -", venue
        )
        postcode = re.search(r"\b\d{5}\b", location)
        municipality = municipality_for_venue(
            location, postcode=postcode[0] if postcode else None
        )
        if not municipality:
            continue
        link = next(title_node.find(tag="a"), None)
        if link is None or not link.attrs.get("href"):
            raise ValueError("Municipal calendar event link missing")
        detail = urljoin(url, link.attrs["href"])
        if urlsplit(detail).scheme != "https":
            raise ValueError("Unexpected municipal event detail URL")
        organizer = re.sub(
            r"^Veranstalter:\s*", "", first(block, "listEntryOrganizer").text()
        )
        image = next(block.find(tag="img"), None)
        # Preserve existing IDs for previously imported occurrences.
        identity = f"{title}_{dates[0]}_{venue}"
        events.append(
            {
                "id": "la-" + hashlib.md5(identity.encode()).hexdigest()[:10],
                "title": title,
                "organizer": organizer,
                "venue_name": venue,
                "municipality": municipality,
                "_date_conflict": date_conflict,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "event_url": detail,
                "ticket_url": detail,
                "image_url": urljoin(url, image.attrs["src"])
                if image and image.attrs.get("src")
                else None,
                "street_address": venue,
                "postal_code": postcode[0] if postcode else None,
                "is_free": False,
                "source": source_id,
                "status": "past" if end < now else "scheduled",
                "description": "Uhrzeit nicht angegeben; Tagesgrenzen dienen der Kalenderdarstellung."
                if not start_time
                else "",
            }
        )
    next_links = list(root.find(tag="a", cls="pageNaviNextLink"))
    next_url = urljoin(url, next_links[0].attrs["href"]) if next_links else None
    if next_url:
        target, origin = urlsplit(next_url), urlsplit(url)
        if target.netloc != origin.netloc or target.path != origin.path:
            raise ValueError("Unexpected municipal pagination URL")
        # Keep the requested range even if the provider omits it in navigation.
        params = dict(parse_qsl(target.query))
        params.update(
            {k: v for k, v in parse_qsl(origin.query) if k in {"dateFrom", "dateTo"}}
        )
        next_url = urlunsplit(target._replace(query=urlencode(params), fragment=""))
    if not blocks and not re.search(
        r"keine\s+(?:veranstaltungen|einträge|termine)", root.text(), re.IGNORECASE
    ):
        raise ValueError("Municipal calendar markup missing; empty import rejected")
    return events, next_url


def detail_fields(html):
    root = Document(html).root
    data = first(root, "eventData")
    if not data.text():
        raise ValueError("Municipal event detail markup missing")
    fields = {}
    for p in data.find(tag="p"):
        label = next(p.find(tag="strong"), Node()).text()
        if label:
            fields[label] = p.text()[len(label) :].strip()
    description = first(root, "subline").text()
    price = fields.get("Preis", "")
    free = bool(
        re.fullmatch(
            r"(?:kostenlos|eintritt\s+frei|frei|0(?:[,.]0+)?\s*€)[.!]?",
            price,
            re.IGNORECASE,
        )
    )
    return fields, description, free



def confirmed_detail_period(fields):
    text = fields.get("Termine", "")
    dates = re.findall(r"\b\d{2}\.\d{2}\.\d{4}\b", text)
    times = re.findall(r"\b\d{1,2}:\d{2}\b", text)
    if not 1 <= len(dates) <= 2 or len(times) > 2:
        raise ValueError("Detail schedule missing or ambiguous")
    days = [datetime.strptime(day, "%d.%m.%Y").replace(tzinfo=BERLIN).date().isoformat() for day in dates]
    return event_period(days[0], times[0] if times else None, days[-1], times[1] if len(times) == 2 else None)
