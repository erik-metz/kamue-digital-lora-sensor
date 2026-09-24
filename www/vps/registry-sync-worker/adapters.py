"""Provider adapters; every acquired response is archived before normalization."""

from datetime import UTC, datetime
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from publications import acquire, publish


async def import_cross7(conn, client, source):
    events = []
    receipts = []
    now = datetime.now(UTC)
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
            start = datetime.fromisoformat(
                item["fromDate"].split("T")[0]
                + "T"
                + (item.get("fromTime") or "00:00:00")
            ).replace(tzinfo=ZoneInfo("Europe/Berlin"))
            url = f"https://www.buerstadt.de/de/kultur-freizeit/veranstaltungen/veranstaltungskalender?c7-item={target}"
            address = (item.get("addresses") or [{}])[0]
            events.append(
                {
                    "id": f"cross7-{target}",
                    "title": item["name"],
                    "organizer": item.get("organizer", ""),
                    "venue_name": address.get("name", ""),
                    "municipality": "Bürstadt",
                    "start_time": start.isoformat(),
                    "category": "civic",
                    "description": item.get("teaserText"),
                    "event_url": url,
                    "ticket_url": url,
                    "is_free": None,
                    "source": "stadt_buerstadt_cross7",
                    "status": "past" if start < now else "scheduled",
                }
            )
        if len(body["items"]) < 50:
            break
    else:
        raise ValueError("Cross7 pagination limit reached; incomplete import rejected")
    async with conn.transaction():
        # An aggregate's normalized version is linked to its final page; all page receipts retained.
        await publish(conn, source, "social/events", events, digest, now)
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
