"""Verified weekly club offers, without fabricated calendar occurrences."""

from datetime import UTC, datetime

from dynamic_offers import dance, gymnastics, running, triathlon
from publications import acquire, publish


def tv_lauftreff(html, source):
    return running(html, source)


def buerstadt_lauftreff(html, source):
    return running(html, source, buerstadt=True)


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
    return dance(html, source)


async def import_rompin_stompin(conn, client, source):
    await import_regular_offers(conn, client, source, rompin_stompin)


def tv_gymnastik(html, venue_html, source):
    return gymnastics(html, venue_html, source)


async def import_tv_gymnastik(conn, client, source):
    response, digest, attempt = await acquire(conn, client, source)
    venue, _, venue_attempt = await acquire(conn, client, source, source["venue_url"])
    offers = tv_gymnastik(response.text, venue.text, source)
    async with conn.transaction():
        await publish(
            conn,
            source,
            "social/regular-offers/" + source["id"],
            offers,
            digest,
            datetime.now(UTC),
        )
        await conn.execute(
            "UPDATE collection_attempts SET status='success' WHERE id IN (%s,%s)",
            (attempt, venue_attempt),
        )
    await conn.commit()


def tvl_triathlon(html, source):
    return triathlon(html, source)


async def import_tvl_triathlon(conn, client, source):
    await import_regular_offers(conn, client, source, tvl_triathlon)
