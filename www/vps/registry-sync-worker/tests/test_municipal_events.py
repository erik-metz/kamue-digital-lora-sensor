"""Regression checks against municipal markup acquired on 2026-10-06."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import adapters
import pytest
from municipal_events import (
    calendar_page,
    calendar_url,
    detail_fields,
    event_period,
    municipality_for_venue,
)

FIXTURES = Path(__file__).with_name("fixtures") / "events"
NOW = datetime(2026, 10, 6, tzinfo=UTC)


def test_real_nested_markup_preserves_multiday_dates_and_next_page():
    events, url = calendar_page(
        (FIXTURES / "lampertheim-page.html").read_text(),
        calendar_url("https://www.lampertheim.de/de/veranstaltungen/", NOW),
        "la",
        NOW,
    )
    assert len(events) == 2
    assert events[0]["start_time"] == "2025-11-16T11:00:00+01:00"
    assert events[0]["end_time"] == "2026-01-25T12:30:00+01:00"
    assert events[0]["municipality"] == "Lampertheim"
    assert "dateFrom=01.01.2026" in url and "dateTo=31.12.2030" in url
    assert "pageId27f0831a=2" in url


def test_real_detail_does_not_label_paid_theatre_as_free():
    fields, description, free = detail_fields(
        (FIXTURES / "lampertheim-detail.html").read_text()
    )
    assert fields["Preis"] == "12,00 €"
    assert "Howwe" in description
    assert not free


@pytest.mark.parametrize(
    "city,postcode,expected",
    [
        ("Bürstadt", "68642", "Bürstadt"),
        ("Lampertheim-Hofheim", "68623", "Lampertheim"),
        ("Biblis", "68647", "Biblis"),
        ("Groß-Rohrheim", "68649", "Groß-Rohrheim"),
        ("Heppenheim", "64646", None),
        ("Lampertheim", "67100", None),
    ],
)
def test_actual_address_overrides_local_sounding_venue(city, postcode, expected):
    assert (
        municipality_for_venue("Bürgerhaus Bürstadt", city=city, postcode=postcode)
        == expected
    )


def test_ambiguous_or_missing_location_is_not_assigned_to_source_municipality():
    assert municipality_for_venue("Marktplatz") is None
    assert municipality_for_venue("Biblis und Lampertheim") is None
    assert municipality_for_venue("Bürgerhaus Riedrode") == "Bürstadt"
    assert municipality_for_venue("Neuschloß - Schlosskeller") == "Lampertheim"


def test_date_bounds_midnight_and_dst():
    start, end = event_period("2026-10-24", "18:00", "2026-10-25", "00:30")
    assert end.day == 25 and end.hour == 0
    start, end = event_period("2026-10-24", "18:00", None, "00:30")
    assert end.day == 25
    start, end = event_period("2026-10-25")
    assert start.hour == 0 and end.hour == 23
    assert start.utcoffset() != end.utcoffset()
    with pytest.raises(ValueError):
        event_period("2026-10-25", None, "2026-10-24")


def test_broken_markup_and_external_next_link_fail_closed():
    with pytest.raises(ValueError):
        calendar_page(
            "<html>maintenance</html>",
            "https://www.lampertheim.de/de/veranstaltungen/",
            "la",
            NOW,
        )
    html = (
        (FIXTURES / "lampertheim-page.html")
        .read_text()
        .replace("?pageId27f0831a=2#list_27f0831a", "https://example.org/next")
    )
    with pytest.raises(ValueError):
        calendar_page(html, "https://www.lampertheim.de/de/veranstaltungen/", "la", NOW)


class Connection:
    def __init__(self):
        self.execute = AsyncMock()
        self.commit = AsyncMock()

    @asynccontextmanager
    async def transaction(self):
        yield


@pytest.mark.asyncio
async def test_all_pages_and_details_are_acquired_before_publication(monkeypatch):
    conn = Connection()
    html = (FIXTURES / "lampertheim-page.html").read_text()
    last = html[: html.index('<a class="pageNaviNextLink"')]
    detail = (FIXTURES / "lampertheim-detail.html").read_text()
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(text=html), "page1", 1),
            (SimpleNamespace(text=detail), "detail1", 2),
            (SimpleNamespace(text=detail), "detail2", 3),
            (SimpleNamespace(text=last), "page2", 4),
        ]
    )
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "acquire", acquire)
    monkeypatch.setattr(adapters, "sync_cultural_events_to_db_and_publish", publish)
    await adapters.import_lampertheim_events(
        conn,
        None,
        {"id": "la", "url": "https://www.lampertheim.de/de/veranstaltungen/"},
    )
    assert acquire.await_count == 4
    assert len(publish.call_args.args[2]) == 2
    assert conn.execute.await_count == 5
    assert "DELETE FROM cultural_events" in conn.execute.call_args_list[0].args[0]
    conn.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_pagination_cycle_never_publishes_partial_data(monkeypatch):
    conn = Connection()
    html = (FIXTURES / "lampertheim-page.html").read_text()
    detail = (FIXTURES / "lampertheim-detail.html").read_text()
    monkeypatch.setattr(
        adapters,
        "acquire",
        AsyncMock(
            side_effect=[
                (SimpleNamespace(text=html), "page1", 1),
                (SimpleNamespace(text=detail), "detail1", 2),
                (SimpleNamespace(text=detail), "detail2", 3),
                (SimpleNamespace(text=html), "page2", 4),
            ]
        ),
    )
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "sync_cultural_events_to_db_and_publish", publish)
    with pytest.raises(ValueError, match="cycle"):
        await adapters.import_lampertheim_events(
            conn,
            None,
            {"id": "la", "url": "https://www.lampertheim.de/de/veranstaltungen/"},
        )
    publish.assert_not_awaited()


def test_invalid_provider_date_is_deferred_without_inventing_a_correction(caplog):
    events, _ = calendar_page(
        (FIXTURES / "invalid-date.html").read_text(),
        "https://www.lampertheim.de/de/veranstaltungen/",
        "la",
        NOW,
    )
    assert events == []
    assert "invalid source dates" in caplog.text


@pytest.mark.asyncio
async def test_cross7_real_addresses_and_full_pagination(monkeypatch):
    import json

    conn = Connection()
    items = json.loads((FIXTURES / "cross7.json").read_text())["items"]
    external = dict(
        items[0],
        addresses=[
            {"name": "Bürgerhaus Bürstadt", "city": "Heppenheim", "zipCode": "64646"}
        ],
    )
    pages = [{"items": items * 10}, {"items": [external]}]
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(json=lambda: pages[0]), "a", 1),
            (SimpleNamespace(json=lambda: pages[1]), "b", 2),
        ]
    )
    monkeypatch.setattr(adapters, "acquire", acquire)
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "sync_cultural_events_to_db_and_publish", publish)
    await adapters.import_cross7(
        conn,
        None,
        {
            "id": "c7",
            "municipality": "Bürstadt",
            "url": "https://api.cross-7.de/public/calendar/667/events",
        },
    )
    assert acquire.await_count == 2
    events = publish.call_args.args[2]
    assert len(events) == 40
    assert all(e["municipality"] == "Bürstadt" for e in events)
    gymnastics = next(e for e in events if e["title"] == "Gymnastika Bürstadt")
    assert gymnastics["end_time"] == "2026-07-11T23:59:59+02:00"
    assert not gymnastics["is_free"]


def test_verified_source_alias_does_not_override_external_address():
    from municipal_events import cross7_venue

    source = {"venue_aliases": {"Bürgerhalle": "Groß-Rohrheim"}}
    assert cross7_venue({"building": "Bürgerhalle", "room": "Anbau"}, source) == (
        "Bürgerhalle Anbau",
        "Groß-Rohrheim",
    )
    assert (
        cross7_venue({"name": "Bürgerhalle", "city": "Heppenheim"}, source)[1] is None
    )
    assert cross7_venue({"name": "Vereinsheim"}, source)[1] is None


@pytest.mark.asyncio
async def test_database_failure_cannot_publish_an_incomplete_aggregate(monkeypatch):
    conn = Connection()
    conn.execute.side_effect = RuntimeError("database failure")
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "publish", publish)
    with pytest.raises(RuntimeError, match="database failure"):
        await adapters.sync_cultural_events_to_db_and_publish(
            conn,
            {"id": "la"},
            [
                {
                    "id": "one",
                    "title": "Test",
                    "municipality": "Bürstadt",
                    "start_time": NOW.isoformat(),
                    "category": "festival",
                }
            ],
            "digest",
            NOW,
        )
    publish.assert_not_awaited()


@pytest.mark.parametrize(
    "price,expected",
    [
        ("Eintritt frei", True),
        ("0,00 €", True),
        ("Kinder kostenlos, Erwachsene 12 €", False),
        ("nicht kostenlos", False),
        ("", False),
    ],
)
def test_only_unconditional_explicit_free_price_is_marked_free(price, expected):
    _, _, free = detail_fields(
        '<div class="eventData"><p><strong>Preis</strong>' + price + "</p></div>"
    )
    assert free is expected


def test_calendar_range_uses_local_year_at_new_year():
    url = calendar_url(
        "https://www.lampertheim.de/de/veranstaltungen/",
        datetime(2026, 12, 31, 23, 30, tzinfo=UTC),
    )
    assert "dateFrom=01.01.2027" in url and "dateTo=31.12.2031" in url


@pytest.mark.asyncio
async def test_cross7_repeated_page_is_not_published(monkeypatch):
    import json

    items = json.loads((FIXTURES / "cross7.json").read_text())["items"]
    response = SimpleNamespace(json=lambda: {"items": items * 10})
    monkeypatch.setattr(
        adapters, "acquire", AsyncMock(return_value=(response, "same", 1))
    )
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "sync_cultural_events_to_db_and_publish", publish)
    with pytest.raises(ValueError, match="repeated page"):
        await adapters.import_cross7(
            Connection(),
            None,
            {
                "id": "c7",
                "municipality": "Bürstadt",
                "url": "https://api.cross-7.de/public/calendar/667/events",
            },
        )
    publish.assert_not_awaited()
