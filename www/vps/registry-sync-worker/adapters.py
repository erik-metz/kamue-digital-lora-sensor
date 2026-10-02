import hashlib
import logging
import re
from datetime import UTC, datetime
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from publications import acquire, publish

logger = logging.getLogger(__name__)


def classify_category(text: str) -> str:
    """Classifies an event into standard UI categories based on title/category text."""
    t = text.lower()
    if any(k in t for k in ["sport", "lauf", "turn", "fußball", "fussball", "rad", "schieß", "schuetzen", "reit", "wasser"]):
        return "sports"
    if any(k in t for k in ["konzert", "musik", "chor", "gesang", "rock", "band", "live", "akustik", "acoustic"]):
        return "concert"
    if any(k in t for k in ["fest", "kerwe", "kerb", "feiern", "fasching", "fastnacht", "karneval", "sommerfest", "glühen", "frühschoppen"]):
        return "festival"
    if any(k in t for k in ["markt", "basar", "flohmarkt", "börse", "advent", "weihnacht"]):
        return "market"
    if any(k in t for k in ["theater", "kabarett", "comedy", "lesung", "bühne", "kino", "film", "musical"]):
        return "theater"
    if any(k in t for k in ["repair", "reparier", "nachhaltig", "umweltmobil", "müll", "abfall"]):
        return "civic"
    if any(k in t for k in ["workshop", "kurs", "seminar", "schulung", "hackathon", "sprechstunde"]):
        return "workshop"
    if any(k in t for k in ["ausstellung", "museum", "galerie", "kunst"]):
        return "exhibition"
    return "civic"


async def sync_cultural_events_to_db_and_publish(conn, source, new_events, digest, now):
    """Upserts extracted events into cultural_events table and publishes aggregate to social/events."""
    for ev in new_events:
        try:
            await conn.execute(
                """INSERT INTO cultural_events (
                    id, title, organizer, venue_name, municipality,
                    start_time, end_time, category, description,
                    ticket_url, event_url, image_url, street_address,
                    postal_code, status, is_free, is_archived, source, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, FALSE, %s, NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    organizer = EXCLUDED.organizer,
                    venue_name = EXCLUDED.venue_name,
                    municipality = EXCLUDED.municipality,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    category = EXCLUDED.category,
                    description = EXCLUDED.description,
                    ticket_url = EXCLUDED.ticket_url,
                    event_url = EXCLUDED.event_url,
                    image_url = EXCLUDED.image_url,
                    street_address = EXCLUDED.street_address,
                    postal_code = EXCLUDED.postal_code,
                    status = EXCLUDED.status,
                    updated_at = NOW()""",
                (
                    ev["id"],
                    ev["title"],
                    ev.get("organizer", ""),
                    ev.get("venue_name", ""),
                    ev["municipality"],
                    ev["start_time"],
                    ev.get("end_time"),
                    ev["category"],
                    ev.get("description"),
                    ev.get("ticket_url"),
                    ev.get("event_url"),
                    ev.get("image_url"),
                    ev.get("street_address"),
                    ev.get("postal_code"),
                    ev.get("status", "scheduled"),
                    ev.get("is_free", True),
                    ev.get("source", source["id"]),
                ),
            )
        except Exception as err:  # noqa: BLE001
            # Tolerant if cultural_events table is in transaction lock or schema variant
            logger.debug("Tolerant skip inserting cultural_event %s: %s", ev.get("id"), err)

    # Read all aggregated events from cultural_events table if possible
    all_events = []
    try:
        cur = await conn.execute(
            """SELECT to_jsonb(t) FROM (
                SELECT id, title, organizer, venue_name, municipality,
                       start_time, end_time, category, description,
                       ticket_url, event_url, image_url, street_address,
                       postal_code, status, is_free, is_archived, source
                FROM cultural_events
                ORDER BY start_time ASC
            ) t;"""
        )
        rows = await cur.fetchall()
        for r in rows:
            if r and r[0]:
                item = r[0]
                all_events.append(item)
    except Exception as err:  # noqa: BLE001
        logger.debug("Could not read aggregated cultural_events: %s", err)

    if not all_events:
        all_events = new_events

    await publish(conn, source, "social/events", all_events, digest, now)


async def import_cross7(conn, client, source):
    """Imports Cross-7 events for Bürstadt or Groß-Rohrheim, supporting past and scheduled events."""
    events = []
    receipts = []
    now = datetime.now(UTC)
    muni = source.get("municipality", "Bürstadt")
    slug_domain = "https://www.gross-rohrheim.de/freizeit-kultur/veranstaltungen/veranstaltungskalender?c7-item=" if "gross-rohrheim" in source["url"] or muni == "Groß-Rohrheim" else "https://www.buerstadt.de/de/kultur-freizeit/veranstaltungen/veranstaltungskalender?c7-item="

    for page in range(1, 101):
        url = (
            source["url"]
            + "?"
            + urlencode(
                {"pageNumber": page, "pageSize": 50, "sortType": 0, "sortDirection": 1}
            )
        )
        response, digest, attempt = await acquire(conn, client, source, url)
        receipts.append(attempt)
        body = response.json()
        if not isinstance(body.get("items"), list):
            raise TypeError("Cross7 items missing")
        for item in body["items"]:
            target = item.get("link", {}).get("targetId")
            if not target or not item.get("fromDate") or not item.get("name"):
                raise ValueError("Incomplete Cross7 event")
            from_time = item.get("fromTime") or "00:00:00"
            until_time = item.get("untilTime") or from_time
            until_date = item.get("untilDate") or item["fromDate"]

            start = datetime.fromisoformat(
                item["fromDate"].split("T")[0]
                + "T"
                + from_time
            ).replace(tzinfo=ZoneInfo("Europe/Berlin"))

            end = datetime.fromisoformat(
                until_date.split("T")[0]
                + "T"
                + until_time
            ).replace(tzinfo=ZoneInfo("Europe/Berlin")) if until_date else None

            detail_url = f"{slug_domain}{target}"
            addresses = item.get("addresses") or [{}]
            venue_addr = next((a for a in addresses if a.get("type") == "Veranstaltungsort"), addresses[0])
            organizer_addr = next((a for a in addresses if a.get("type") == "Veranstalter"), None)
            organizer = (organizer_addr.get("name") if organizer_addr else item.get("organizer")) or f"Stadt {muni}"

            # Category classification
            cat_names = " ".join([c.get("name", "") for c in item.get("categoryNames", [])])
            cat = classify_category(f"{item['name']} {cat_names} {item.get('teaserText') or ''}")

            street = f"{venue_addr.get('street', '')} {venue_addr.get('houseNumber', '')}".strip() or None
            zip_code = venue_addr.get("zipCode") or ("68649" if muni == "Groß-Rohrheim" else "68642")

            events.append(
                {
                    "id": f"c7-{target}",
                    "title": item["name"],
                    "organizer": organizer,
                    "venue_name": venue_addr.get("name") or muni,
                    "municipality": muni,
                    "start_time": start.isoformat(),
                    "end_time": end.isoformat() if end else None,
                    "category": cat,
                    "description": item.get("teaserText"),
                    "event_url": detail_url,
                    "ticket_url": detail_url,
                    "image_url": item.get("teaserPictureUrl"),
                    "street_address": street,
                    "postal_code": zip_code,
                    "is_free": True,
                    "source": source["id"],
                    "status": "past" if (end or start) < now else "scheduled",
                }
            )
        if len(body["items"]) < 50:
            break
    else:
        raise ValueError("Cross7 pagination limit reached; incomplete import rejected")

    async with conn.transaction():
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        for attempt in receipts:
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
    await conn.commit()


async def import_lampertheim_events(conn, client, source):
    """Scrapes structured community events from Stadt Lampertheim (Weblication CMS)."""
    receipts = []
    now = datetime.now(UTC)
    events = []
    response, digest, attempt = await acquire(conn, client, source, source["url"])
    receipts.append(attempt)
    html = response.text

    # Match each listEntryObject-eventMulti
    blocks = re.findall(r'<li[^>]*class=\"[^\"]*listEntryObject-eventMulti[^\"]*\"[^>]*>(.*?)</li>', html, re.DOTALL)
    for block in blocks:
        title_m = re.search(r'<h3 class=\"listEntryTitle\"><a[^>]*>(.*?)</a></h3>', block)
        if not title_m:
            continue
        title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
        date_m = re.search(r'<span class=\"daydate [^\"]*\">(.*?)</span>', block)
        if not date_m:
            continue
        date_str = date_m.group(1).strip() # DD.MM.YYYY

        # Extract time
        time_m = re.search(r'<span class=\"time\">(.*?)</span>\s*</span>', block, re.DOTALL)
        times = re.findall(r'\b(\d{1,2}:\d{2})\b', time_m.group(1)) if time_m else []
        from_time = times[0] if len(times) >= 1 else "10:00"
        until_time = times[1] if len(times) >= 2 else None

        # Parse dates to ISO
        try:
            parts = date_str.split(".")
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            f_parts = from_time.split(":")
            start = datetime(year, month, day, int(f_parts[0]), int(f_parts[1]), tzinfo=ZoneInfo("Europe/Berlin"))
            end = None
            if until_time:
                u_parts = until_time.split(":")
                end = datetime(year, month, day, int(u_parts[0]), int(u_parts[1]), tzinfo=ZoneInfo("Europe/Berlin"))
        except (ValueError, IndexError):
            continue

        loc_m = re.search(r'<span class=\"listEntryLocation\">(.*?)</span>', block)
        venue_text = loc_m.group(1).strip() if loc_m else "Lampertheim"
        org_m = re.search(r'<span class=\"listEntryOrganizer\">(.*?)</span>', block)
        org_text = re.sub(r'^Veranstalter:\s*', '', org_m.group(1).strip()) if org_m else "Stadt Lampertheim"
        link_m = re.search(r'<a class=\"listEntryMoreOnly\" href=\"([^\"]+)\"', block)
        detail_link = f"https://www.lampertheim.de{link_m.group(1)}" if link_m else "https://www.lampertheim.de/de/veranstaltungen/"
        img_m = re.search(r'<img[^>]*src=\"([^\"]+)\"', block)
        image_url = f"https://www.lampertheim.de{img_m.group(1)}" if img_m else None

        slug_hash = hashlib.md5(f"{title}_{date_str}_{venue_text}".encode()).hexdigest()[:10]
        cat = classify_category(f"{title} {venue_text} {org_text}")

        events.append({
            "id": f"la-{slug_hash}",
            "title": title,
            "organizer": org_text,
            "venue_name": venue_text,
            "municipality": "Lampertheim",
            "start_time": start.isoformat(),
            "end_time": end.isoformat() if end else None,
            "category": cat,
            "description": f"Veranstaltung in Lampertheim: {title} ({venue_text}). Veranstalter: {org_text}.",
            "event_url": detail_link,
            "ticket_url": detail_link,
            "image_url": image_url,
            "street_address": venue_text,
            "postal_code": "68623",
            "is_free": True,
            "source": source["id"],
            "status": "past" if (end or start) < now else "scheduled",
        })

    async with conn.transaction():
        await sync_cultural_events_to_db_and_publish(conn, source, events, digest, now)
        for attempt in receipts:
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
    await conn.commit()


async def import_tiles(conn, client, source):
    """Explicit licensed tile inventory; no request-time proxy or unbounded crawl."""
    now = datetime.now(UTC)
    for tile in source.get("tiles", []):
        layer, z, x, y = tile["layer"], tile["z"], tile["x"], tile["y"]
        if (
            layer not in ("base", "rain")
            or not 0 <= z <= 19
            or not (0 <= x < 2**z and 0 <= y < 2**z)
        ):
            raise ValueError("Invalid tile coordinate")
        response, digest, attempt = await acquire(
            conn, client, source, source["url"].format(z=z, x=x, y=y)
        )
        if not response.headers.get("content-type", "").startswith("image/"):
            raise ValueError("Tile endpoint did not return an image")
        async with conn.transaction():
            await conn.execute(
                """INSERT INTO collected_map_tiles(layer,z,x,y,payload_sha256,fetched_at)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(layer,z,x,y) DO UPDATE SET
                payload_sha256=EXCLUDED.payload_sha256,fetched_at=EXCLUDED.fetched_at""",
                (layer, z, x, y, digest, now),
            )
            await conn.execute(
                "UPDATE collection_attempts SET status='success' WHERE id=%s",
                (attempt,),
            )
        await conn.commit()
