"""Read the six reviewed HCV dates without executing the site's JavaScript."""

import hashlib
import json
import re
from datetime import UTC, date, datetime, time
from urllib.parse import urljoin, urlsplit

from adapters import sync_cultural_events_to_db_and_publish
from municipal_events import BERLIN, Document, event_period
from publications import acquire

FRAGMENT = r'La="Bürgerhaus Bürstadt, Rathausstraße 2",dr=\[[^\n]{1,10000}?\],ec='
TITLES = {
    "HCV Schlachtfest", "1. Prunksitzung", "2. Prunksitzung",
    "3. Prunksitzung", "4. Prunksitzung", "HCV Frauensitzung",
}


def campaign_asset(html, page_url):
    if page_url != "https://hcv-buerstadt.de/":
        raise ValueError("Unexpected HCV source")
    assets = [
        urljoin(page_url, n.attrs.get("src", ""))
        for n in Document(html).root.find(tag="script")
        if n.attrs.get("type") == "module"
    ]
    if len(assets) != 1 or not re.fullmatch(
        r"https://hcv-buerstadt\.de/assets/index-[A-Za-z0-9_-]+\.js", assets[0]
    ):
        raise ValueError("Expected same-origin HCV module missing or ambiguous")
    return assets[0]


def campaign_events(javascript, source, now):
    fragments = re.findall(FRAGMENT, javascript)
    if (
        source["id"] != "hcv-buerstadt-campaign"
        or len(fragments) != 1
        or hashlib.sha256(fragments[0].encode()).hexdigest()
        != source["verified_fragment_sha256"]
    ):
        raise ValueError("HCV campaign dates or venues changed; verification required")
    # Only JSON-compatible literal data is read; no provider code is evaluated.
    literal = fragments[0].split("dr=", 1)[1][:-4]
    literal = re.sub(r'(datum|event|ort|uhrzeit):', r'"\1":', literal)
    rows = json.loads(literal.replace(':La', ':"Bürgerhaus Bürstadt, Rathausstraße 2"'))
    selected = [r for r in rows if r["event"] in TITLES]
    if selected != source["verified_events"] or {r["event"] for r in selected} != TITLES:
        raise ValueError("Reviewed HCV event set changed")
    result = []
    for row in selected:
        day = date(*reversed([int(v) for v in row["datum"].split(".")]))
        if day.year not in (2026, 2027) or row["ort"] not in {
            "Die Lächner 9", "Bürgerhaus Bürstadt, Rathausstraße 2"
        }:
            raise ValueError("HCV event outside reviewed campaign or venues")
        clock = row.get("uhrzeit", "").removesuffix(" Uhr") or None
        if clock:
            start = datetime.combine(day, time.fromisoformat(clock), BERLIN)
            end = None
        else:
            start, end = event_period(day.isoformat())
        description = (
            "Veröffentlichter Termin der HCV-Kampagne 2026/2027. "
            "Endzeit und Eintrittspreise sind nicht angegeben. "
            "Teilnahmebedingungen, Anmeldung und verfügbare Karten bitte beim HCV prüfen."
        )
        if not clock:
            description += " Beginn unbekannt; Tagesgrenzen dienen ausschließlich der Kalenderdarstellung."
        result.append({
            "id": source["id"] + "-" + day.isoformat(),
            "title": row["event"], "municipality": "Bürstadt",
            "organizer": "Heimat- und Carneval-Verein Bürstadt 1959 e.V.",
            "venue_name": row["ort"] + (", Bürstadt" if row["ort"] == "Die Lächner 9" else ""),
            "start_time": start.isoformat(), "end_time": end.isoformat() if end else None,
            "category": "festival", "is_free": False,
            "status": "past" if (end or start) < now else "scheduled",
            "source": source["id"], "event_url": source["url"],
            "description": description,
        })
    return result


async def import_hcv_campaign(conn, client, source):
    page, page_digest, page_attempt = await acquire(conn, client, source)
    asset_url = campaign_asset(page.text, source["url"])
    script, script_digest, script_attempt = await acquire(conn, client, source, asset_url)
    if urlsplit(str(script.url)).hostname != "hcv-buerstadt.de":
        raise ValueError("Unexpected HCV asset redirect")
    now = datetime.now(UTC)
    events = campaign_events(script.text, source, now)
    bundle = json.dumps({"payload_sha256": [page_digest, script_digest], "events": events},
                        sort_keys=True, separators=(",", ":")).encode()
    digest = hashlib.sha256(bundle).hexdigest()
    async with conn.transaction():
        await conn.execute(
            "INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'application/json') ON CONFLICT DO NOTHING",
            (digest, bundle),
        )
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        for attempt in (page_attempt, script_attempt):
            await conn.execute("UPDATE collection_attempts SET status='success' WHERE id=%s", (attempt,))
    await conn.commit()
