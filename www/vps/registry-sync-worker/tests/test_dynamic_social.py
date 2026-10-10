"""Provider changes must propagate without adding event/year/course allowlists."""

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import club_events
import httpx
import pytest
from db_support import DatabaseCase
from dynamic_calendar import explicit_periods, internal_links
from municipal_events import confirmed_detail_period
from municipal_festival_notices import municipal_festival_notice
from news_events import article_events, feed_links, import_news_events
from regular_offers import (
    buerstadt_lauftreff,
    rompin_stompin,
    tv_gymnastik,
    tv_lauftreff,
    tvl_triathlon,
)
from social_diagnostics import CURRENT, begin, finish
from test_club_events import SOURCES, Connection
from verified_christmas_markets import christmas_markets, import_christmas_markets
from verified_hcv_campaign import campaign_events

FIXTURES = Path(__file__).parent / "fixtures/events"
NOW = datetime(2026, 10, 9, tzinfo=UTC)
NEWS = SOURCES["gross-rohrheim-news-events"]
MENU = '<li><a href="/verein/">Events</a><ul><li><a href="/neues-fest/">Neues Fest</a></li></ul></li>'


def body(name):
    return (FIXTURES / name).read_text()


@pytest.mark.parametrize(
    "text,period",
    [
        (
            "Das Fest 2028 findet vom 2. bis 4. Juni statt.",
            ("2028-06-02", "2028-06-04"),
        ),
        ("Neue Termine: 5. Dezember 2029", ("2029-12-05", "2029-12-05")),
        ("22./23. Mai 2028", ("2028-05-22", "2028-05-23")),
    ],
)
def test_explicit_years_are_parsed_without_calendar_year_configuration(text, period):
    assert explicit_periods(text) == [period]
    assert explicit_periods("am 5. Dezember") == []


def test_menu_discovery_includes_new_links_excludes_parent_and_external_targets():
    html = MENU.replace(
        "</ul>",
        '<li><a href="https://outside.example/fest">Outside</a></li><li><a href="/neues-fest/#details">Duplicate</a></li></ul>',
    )
    assert internal_links(html, "https://www.sg-huettenfeld.de/", section="Events") == [
        "https://www.sg-huettenfeld.de/neues-fest/"
    ]
    with pytest.raises(ValueError):
        internal_links(
            "<p>Maintenance</p>", "https://www.sg-huettenfeld.de/", section="Events"
        )


@pytest.mark.asyncio
async def test_new_sgh_detail_is_discovered_and_published_without_manifest_edit(
    monkeypatch,
):
    detail = (
        body("clubs/sgh-maifest.html")
        .replace("Maifest", "Neues Vereinsfest")
        .replace(">1. Mai<", ">1. Mai 2027<")
    )
    # A new title and URL use the same published date/address structure.
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(text=MENU), "listing", 1),
            (SimpleNamespace(text=detail), "detail", 2),
        ]
    )
    publish = AsyncMock()
    monkeypatch.setattr(club_events, "acquire", acquire)
    monkeypatch.setattr(club_events, "sync_cultural_events_to_db_and_publish", publish)
    await club_events.import_club_events(
        Connection(), None, SOURCES["sg-huettenfeld-events"]
    )
    assert acquire.call_args_list[1].args[3].endswith("/neues-fest/")
    assert publish.call_args.args[2][0]["title"] == "Neues Vereinsfest"


@pytest.mark.parametrize("key", ["wanderung", "spargelfest", "howwemer", "kerwe"])
def test_municipal_festivals_follow_new_years(key):
    source = SOURCES["lampertheim-" + key + "-festival-notice"]
    original = body("lampertheim-" + key + "-2027.html")
    changed = municipal_festival_notice(original.replace("2027", "2029"), source, NOW)
    assert changed["start_time"].startswith("2029-")
    assert changed["id"].endswith("2029")
    with pytest.raises(ValueError):
        municipal_festival_notice(
            original.replace("<h1>", "<h2>").replace("</h1>", "</h2>"), source, NOW
        )


def test_market_opening_change_new_year_and_added_district_are_read_from_source():
    html = body("lampertheim-district-christmas.html")
    source = SOURCES["lampertheim-district-christmas-markets"]
    changed = christmas_markets(
        html.replace("2026:", "2028:").replace("13-19 Uhr", "13-20 Uhr"), source, NOW
    )
    assert all(e["start_time"].startswith("2028-") for e in changed)
    assert changed[-1]["end_time"].endswith("20:00:00+01:00")
    added = html.replace(
        "<!--CONTENT:STOP-->",
        "<h2>Rosengartener Weihnachtsmarkt</h2><p>Weihnachtsmarkt in Rosengarten. Öffnungszeiten 2026: Sonntag, 13.12., 14 - 18 Uhr</p><!--CONTENT:STOP-->",
    )
    # Explicit district names are accepted; unrelated outside markets are excluded.
    events = christmas_markets(added, source, NOW)
    assert len(events) == 10
    with pytest.raises(ValueError):
        christmas_markets(html.replace("13-19 Uhr", "22-19 Uhr"), source, NOW)


def test_hcv_accepts_new_titles_times_years_and_never_executes_provider_code():
    source = SOURCES["hcv-buerstadt-campaign"]
    script = body("hcv-campaign-fragment.js")
    changed = campaign_events(
        script.replace("2027", "2029")
        .replace("19:31", "20:31")
        .replace("HCV Schlachtfest", "Neues öffentliches Fest"),
        source,
        NOW,
    )
    assert any(e["title"] == "Neues öffentliches Fest" for e in changed)
    assert any(
        e["start_time"].startswith("2029-") and "T20:31" in e["start_time"]
        for e in changed
    )
    assert not any("Familienabend" in e["title"] for e in changed)
    with pytest.raises(ValueError):
        campaign_events(script.replace('"18:00 Uhr"', "doSomething()"), source, NOW)
    with pytest.raises(ValueError):
        campaign_events(script + script, source, NOW)


def test_course_changes_new_cards_and_foreign_venues():
    source = SOURCES["rompin-stompin-regular-offers"]
    html = body("rompin-stompin-courses.html")
    changed = rompin_stompin(html.replace("18:00- 19:00", "18:15- 19:15"), source)
    assert any(
        o["start_local"] == "18:15" and o["end_local"] == "19:15" for o in changed
    )
    added = '<div class="listText" id="new"><span class="itemName">Neuer Kurs am Freitag</span><p>16:00 - 17:00 Uhr</p><strong>Bürgerzentrum Biblis</strong></div>'
    assert len(rompin_stompin(html + added, source)) == 11
    external = rompin_stompin(
        html.replace("Bürgerzentrum Biblis", "Mehrzweckhalle Einhausen"), source
    )
    assert all(o["municipality"] == "Bürstadt" for o in external)
    assert not any("Einhausen" in o["venue_name"] for o in changed)


def test_gymnastics_new_group_and_updated_hours_keep_published_registration_conditions():
    source = SOURCES["tv-gross-rohrheim-gymnastik"]
    html, venue = body("tv-gymnastik.html"), body("tv-gymnastik-venue.html")
    changed = tv_gymnastik(html.replace("18:30-19:30", "18:45-19:45"), venue, source)
    assert any(o["start_local"] == "18:45" for o in changed)
    added = "<h3>Freitag</h3><h3>Neuer Kurs</h3><p>16:00-17:00 Uhr, Hallenanbau. Anmeldung erforderlich.</p>"
    assert any(
        o["title"] == "Neuer Kurs" for o in tv_gymnastik(html + added, venue, source)
    )
    assert any(
        "Anmeldung ist zwingend erforderlich" in o["description"]
        for o in changed
        if "Yoga" in o["title"]
    )


def test_running_and_triathlon_updates_are_not_rejected_by_text_hashes():
    source = SOURCES["tv-gross-rohrheim-lauftreff"]
    offer = tv_lauftreff(
        body("tv-lauftreff.html")
        .replace("mittwochs", "donnerstags")
        .replace("19.00", "18.00"),
        source,
    )[0]
    assert (offer["weekday"], offer["start_local"]) == ("Donnerstag", "18:00")
    b = buerstadt_lauftreff(
        body("tv-buerstadt-lauftreff.html").replace(
            "Dienstags 18 Uhr", "Dienstags 19 Uhr"
        ),
        SOURCES["tv-buerstadt-lauftreff"],
    )
    assert b[0]["start_local"] == "19:00"
    t = tvl_triathlon(
        body("tvl-triathlon.html").replace("Freitag 18:30", "Freitag 18:45"),
        SOURCES["tvl-triathlon-regular-offers"],
    )
    assert any(o["start_local"] == "18:45" for o in t)


def test_news_discovery_and_new_article_with_explicit_date_and_place():
    feed = b"<rss><channel><item><link>https://gross-rohrheim.orts.app/-neues-fest_X</link></item></channel></rss>"
    assert feed_links(feed, NEWS) == ["https://gross-rohrheim.orts.app/-neues-fest_X"]
    html = '<h1>Neues Fest</h1><div itemprop="articleBody"><p>Alle sind herzlich willkommen am 15. November 2027 ab 17 Uhr in der Allee.</p></div>'
    events = article_events(html, feed_links(feed, NEWS)[0], NEWS, NOW)
    assert len(events) == 1 and events[0]["start_time"] == "2027-11-15T17:00:00+01:00"
    assert (
        article_events(
            html.replace("in der Allee", "in Darmstadt"),
            "https://gross-rohrheim.orts.app/-X",
            NEWS,
            NOW,
        )
        == []
    )
    assert (
        article_events(
            html.replace("2027", ""), "https://gross-rohrheim.orts.app/-X", NEWS, NOW
        )
        == []
    )
    with pytest.raises(ValueError):
        feed_links(
            feed.replace(
                b"https://gross-rohrheim.orts.app/", b"https://external.example/"
            ),
            NEWS,
        )


def test_conflicting_listing_can_only_be_repaired_with_explicit_valid_detail_period():
    start, end = confirmed_detail_period(
        {"Termine": "Di, 29.12.2026, 19:00 Uhr - 22:00 Uhr"}
    )
    assert start.isoformat() == "2026-12-29T19:00:00+01:00"
    assert end.isoformat() == "2026-12-29T22:00:00+01:00"
    with pytest.raises(ValueError):
        confirmed_detail_period({"Termine": "29.12.2026 - 27.05.2026"})
    with pytest.raises(ValueError):
        confirmed_detail_period({})


class DynamicPublicationDatabaseTests(DatabaseCase):
    async def test_changed_market_date_replaces_only_future_own_rows(self):
        html = body("lampertheim-district-christmas.html")
        source = SOURCES["lampertheim-district-christmas-markets"]
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, text=html))
        ) as client:
            await import_christmas_markets(self.conn, client, source)
            html = html.replace("2026:", "2028:")
            await import_christmas_markets(self.conn, client, source)
            data = await self.scalar(
                "SELECT data FROM collected_datasets WHERE dataset='social/events'"
            )
            self.assertEqual(len(data), 9)
            self.assertTrue(all(e["start_time"].startswith("2028-") for e in data))

    async def test_news_feed_is_archived_and_rejection_diagnostics_publish_independently(
        self,
    ):
        feed = "<rss><channel><item><link>https://gross-rohrheim.orts.app/-new_X</link></item></channel></rss>"
        html = '<h1>Neues Fest</h1><div itemprop="articleBody"><p>Alle sind herzlich willkommen am 15. November 2027 ab 17 Uhr in der Allee.</p></div>'
        started = await self.scalar("SELECT clock_timestamp()")
        token = begin()
        try:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(
                    lambda r: httpx.Response(
                        200, text=feed if str(r.url) == NEWS["url"] else html
                    )
                )
            ) as client:
                await import_news_events(self.conn, client, NEWS)
            await finish(self.conn, NEWS, started)
        finally:
            CURRENT.reset(token)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset=%s",
            ("social/source-diagnostics/" + NEWS["id"],),
        )
        self.assertEqual(data["accepted"], 1)
        self.assertEqual(data["http_attempts"], 2)
        self.assertEqual(
            await self.scalar(
                "SELECT item_count FROM collection_attempts ORDER BY id DESC LIMIT 1"
            ),
            1,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collection_attempts WHERE status='success'"
            ),
            2,
        )


def test_calendar_window_accepts_explicit_dates_beyond_next_year():
    from biblis_events import window
    start, end = window(NOW)
    assert start.year == 2026 and end.year == 2031
    assert start < datetime(2029, 5, 1, tzinfo=UTC) < end


class NewsReconciliationDatabaseTests(DatabaseCase):
    async def test_changed_article_date_replaces_previous_future_occurrence(self):
        feed = "<rss><channel><item><link>https://gross-rohrheim.orts.app/-new_X</link></item></channel></rss>"
        html = '<h1>Neues Fest</h1><div itemprop="articleBody"><p>Alle sind herzlich willkommen am 15. November 2027 ab 17 Uhr in der Allee.</p></div>'
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda r: httpx.Response(200, text=feed if str(r.url) == NEWS["url"] else html)
        )) as client:
            await import_news_events(self.conn, client, NEWS)
            html = html.replace("15. November", "16. November")
            await import_news_events(self.conn, client, NEWS)
        data = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='social/events'")
        self.assertEqual(len(data), 1)
        self.assertTrue(data[0]["start_time"].startswith("2027-11-16"))
