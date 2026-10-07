"""Public club-source excerpts acquired on 2026-10-06; no production writes."""

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import biblis_events as tribe
import club_events as clubs
import pytest

ROOT = Path(__file__).parents[1]
FIXTURES = Path(__file__).parent / "fixtures/events/clubs"
SOURCES = {
    s["id"]: s for s in json.loads((ROOT / "sources.json").read_text())["sources"]
}
NOW = datetime(2026, 10, 6, tzinfo=UTC)


def fixture(name):
    return (FIXTURES / name).read_text()


@pytest.mark.parametrize(
    "value,start,end",
    [
        ("10-11.01.2026", "2026-01-10", "2026-01-11"),
        ("19./20.09.2026", "2026-09-19", "2026-09-20"),
        ("04. – 06.12.2026", "2026-12-04", "2026-12-06"),
        ("14. – 16. August 2026", "2026-08-14", "2026-08-16"),
        ("08. Februar 2027", "2027-02-08", "2027-02-08"),
    ],
)
def test_explicit_date_ranges(value, start, end):
    assert clubs.dated_range(value) == (start, end)


@pytest.mark.parametrize(
    "value",
    ["", "31.12.", "Oktober 2027", "28.03-04-04-2026", "31-29.08.2026", "31.02.2026"],
)
def test_ambiguous_or_invalid_dates_are_not_invented(value):
    with pytest.raises(ValueError):
        clubs.dated_range(value)


def test_real_tv_table_keeps_festivals_and_runs_but_not_foreign_or_placeholder_rows():
    events = clubs.table_events(fixture("tv.html"), SOURCES["tv-buerstadt-events"], NOW)
    assert len(events) == 25
    assert all(e["municipality"] == "Bürstadt" for e in events)
    titles = [e["title"] for e in events]
    assert "Brutzelfest 2026" in titles and "Bürstädter Stadtlauf" in titles
    assert any("Silvesterlauf" in t for t in titles)
    assert not any(
        "Geyer" in t or "Cheerleading-Meisterschaft" in t or "Platzhalter" in t
        for t in titles
    )
    assert not any(e["is_free"] for e in events)
    brutzel = next(e for e in events if e["title"] == "Brutzelfest 2026")
    assert brutzel["start_time"].startswith("2026-08-29T00:00")
    assert brutzel["end_time"].startswith("2026-08-30T23:59")


def test_real_kkm_list_and_explicit_year_scoped_venue_verification():
    events = clubs.table_events(
        fixture("kkm.html"), SOURCES["kkm-buerstadt-events"], NOW
    )
    assert len(events) == 13
    assert any("Bobstadt" in e["title"] for e in events)
    assert any("Riedrode" in e["title"] for e in events)
    assert not any("Lorsch" in e["title"] or "Zeltlager" in e["title"] for e in events)
    future = clubs.table_events(
        fixture("kkm.html").replace("2026", "2027"),
        SOURCES["kkm-buerstadt-events"],
        NOW,
    )
    assert not any(e["title"] == "KKM Oktoberfest" for e in future)


@pytest.mark.parametrize(
    "html", ["<table><tr><td>Maintenance</td></tr></table>", "<html></html>"]
)
def test_changed_calendar_markup_aborts(html):
    with pytest.raises(ValueError):
        clubs.table_events(html, SOURCES["kkm-buerstadt-events"], NOW)


def test_explicit_external_address_overrides_source_aliases():
    source = SOURCES["tv-buerstadt-events"]
    assert clubs.location("TV Halle, 35037 Marburg", source)[1] is None
    assert clubs.location("68642 Lampertheim", source)[1] is None
    assert clubs.location("Vereinsheim", source)[1] is None


@pytest.mark.parametrize(
    "name,count",
    [
        ("sgh-kerwe", 1),
        ("sgh-lauf", 1),
        ("sgh-kinderfasching", 1),
        ("sgh-maifest", 1),
        ("sgh-ostereierschiessen", 5),
        ("sgh-nikolausschiessen", 2),
        ("sgh-oktoberfest", 0),
        ("sgh-events-summernight", 0),
    ],
)
def test_real_sgh_pages_preserve_published_occurrences(name, count):
    events = clubs.sgh_events(
        fixture(name + ".html"),
        SOURCES["sg-huettenfeld-events"],
        NOW,
        "https://www.sg-huettenfeld.de/kerwe/",
    )
    assert len(events) == count
    assert all(e["municipality"] == "Lampertheim" for e in events)
    assert all(len(e["venue_name"]) <= 255 for e in events)
    if name == "sgh-lauf":
        assert events[0]["start_time"].startswith("2026-08-15T15:00")
        assert not events[0]["is_free"]
    if name == "sgh-ostereierschiessen":
        assert all(e["start_time"].startswith("2026-03") for e in events)
    if name == "sgh-nikolausschiessen":
        assert all("T16:00" in e["end_time"] for e in events)


def test_missing_sgh_venue_block_aborts():
    with pytest.raises(ValueError):
        clubs.sgh_events(
            "<h1>Kerwe</h1>",
            SOURCES["sg-huettenfeld-events"],
            NOW,
            "https://www.sg-huettenfeld.de/kerwe/",
        )


def test_dlrg_embedded_list_has_every_row_and_validated_export_target():
    rows = clubs.dlrg_listing(fixture("dlrg-list.html"))
    assert len(rows) == 10
    row = next(r for r in rows if r["id"] == 353975)
    url, description, cost, count = clubs.dlrg_detail(
        fixture("dlrg-353975.html"), row, SOURCES["dlrg-lampertheim-events"]
    )
    assert "action=ical" in url
    assert "Nicht-DLRG-Mitglieder" in description and "freie Plätze" in description
    assert "15,00" in cost
    assert count == 3
    with pytest.raises(ValueError):
        clubs.dlrg_detail(
            fixture("dlrg-353975.html").replace(
                "https://dlrg.net/apps/seminar", "https://example.org/apps/seminar"
            ),
            row,
            SOURCES["dlrg-lampertheim-events"],
        )


def test_dlrg_ical_keeps_individual_dates_actual_venues_prices_and_dst():
    rows = clubs.dlrg_listing(fixture("dlrg-list.html"))
    row = next(r for r in rows if r["id"] == 353975)
    _, description, cost, count = clubs.dlrg_detail(
        fixture("dlrg-353975.html"), row, SOURCES["dlrg-lampertheim-events"]
    )
    events = clubs.ical_events(
        fixture("dlrg-junior.ics"),
        row,
        SOURCES["dlrg-lampertheim-events"],
        NOW,
        description,
        cost,
        count,
    )
    assert len(events) == 3 and len({e["id"] for e in events}) == 3
    assert events[0]["start_time"] == "2026-10-22T18:00:00+02:00"
    assert events[-1]["start_time"] == "2026-10-25T14:00:00+01:00"
    assert "Weidweg 21" in events[0]["venue_name"]
    assert "Rheinstraße 90" in events[-1]["venue_name"]
    assert all(not e["is_free"] for e in events)


@pytest.mark.parametrize("extra", ["RRULE:FREQ=WEEKLY\n", "RDATE:20261029T180000\n"])
def test_unexpanded_recurrence_feed_aborts(extra):
    body = fixture("dlrg-junior.ics").replace(
        "DTSTART:20261022T180000", extra + "DTSTART:20261022T180000"
    )
    with pytest.raises(ValueError):
        clubs.ical_events(
            body,
            {"titel": "Course", "link": "https://lampertheim.dlrg.de", "id": 1},
            SOURCES["dlrg-lampertheim-events"],
            NOW,
            "",
            "",
        )


def test_hofheim_all_embedded_pages_actual_times_and_venue_exclude_school_holidays():
    events = clubs.hofheim_events(
        fixture("hofheim-calendar.html"), SOURCES["tv-hofheim-events"], NOW
    )
    assert len(events) == 4
    assert events[0]["start_time"] == "2026-10-23T17:00:00+02:00"
    assert events[1]["end_time"] == "2026-11-08T18:30:00+01:00"
    assert events[-1]["end_time"] == "2026-12-05T23:59:59+01:00"
    url, form = clubs.hofheim_request(
        fixture("hofheim-request.html"), SOURCES["tv-hofheim-events"]
    )
    assert url == "https://tv1896hofheim.de/wp-admin/admin-ajax.php"
    assert form["subaction"] == "display_calendar"


def test_hofheim_race_never_guesses_next_year_venue():
    source = SOURCES["hofheimer-volkslauf"]
    events = clubs.hofheim_race(fixture("hofheim-race.html"), source, NOW)
    assert len(events) == 1 and events[0]["municipality"] == "Lampertheim"
    assert (
        clubs.hofheim_race(
            fixture("hofheim-race.html").replace("2026", "2027"), source, NOW
        )
        == []
    )


def test_neuschloss_reuses_complete_tribe_feed_without_biblis_ids():
    source = SOURCES["neuschloss-events"]
    body = json.loads(fixture("neuschloss.json"))
    assert tribe.pagination(body) == (2, 1)
    assert tribe.parse_event(body["events"][0], source, NOW) is None
    event = tribe.parse_event(body["events"][1], source, NOW)
    assert (
        event["id"].startswith("neuschloss-") and event["municipality"] == "Lampertheim"
    )


class ClockMeta(type):
    def __instancecheck__(cls, instance):
        return isinstance(instance, datetime)


class FixedClock(datetime, metaclass=ClockMeta):
    @classmethod
    def now(cls, tz=None):
        return NOW if tz is None else NOW.astimezone(tz)


class Connection:
    def __init__(self):
        self.execute = AsyncMock()
        self.commit = AsyncMock()

    @asynccontextmanager
    async def transaction(self):
        yield


@pytest.mark.asyncio
async def test_acquisition_failure_after_first_page_never_reconciles(monkeypatch):
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(text="<html></html>"), "digest", 1),
            RuntimeError("offline"),
        ]
    )
    publish = AsyncMock()
    monkeypatch.setattr(clubs, "acquire", acquire)
    monkeypatch.setattr(clubs, "sync_cultural_events_to_db_and_publish", publish)
    conn = Connection()
    with pytest.raises(RuntimeError):
        await clubs.import_club_events(conn, None, SOURCES["sg-huettenfeld-events"])
    publish.assert_not_awaited()
    conn.execute.assert_not_awaited()
    conn.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_complete_table_reconciles_only_its_future_window(monkeypatch):
    monkeypatch.setattr(clubs, "datetime", FixedClock)
    monkeypatch.setattr(
        clubs,
        "acquire",
        AsyncMock(return_value=(SimpleNamespace(text=fixture("tv.html")), "digest", 1)),
    )
    publish = AsyncMock()
    monkeypatch.setattr(clubs, "sync_cultural_events_to_db_and_publish", publish)
    conn = Connection()
    await clubs.import_club_events(conn, None, SOURCES["tv-buerstadt-events"])
    assert len(publish.call_args.args[2]) == 25
    delete = conn.execute.call_args_list[0]
    assert delete.args[1][0] == "tv-buerstadt-events"
    assert delete.args[1][2].hour == 0
    assert "COALESCE(end_time,start_time) >= %s" in delete.args[0]
    conn.commit.assert_awaited_once()


def test_dlrg_truncated_export_aborts_before_partial_course_is_published():
    row = {"titel": "Juniorretter", "link": "https://lampertheim.dlrg.de", "id": 353975}
    with pytest.raises(ValueError, match="truncated"):
        clubs.ical_events(
            fixture("dlrg-junior.ics"),
            row,
            SOURCES["dlrg-lampertheim-events"],
            NOW,
            "",
            "",
            4,
        )


@pytest.mark.asyncio
async def test_dlrg_import_excludes_orders_and_foreign_trips_and_imports_sessions(
    monkeypatch,
):
    from html import escape

    monkeypatch.setattr(clubs, "datetime", FixedClock)
    rows = [
        row
        for row in clubs.dlrg_listing(fixture("dlrg-list.html"))
        if row["id"] in (353975, 375492, 366849)
    ]
    listing = (
        '<table id="DlrgSeminarPublicSeminarList1" data-data="'
        + escape(json.dumps(rows), quote=True)
        + '"></table>'
    )
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(text=listing), "list", 1),
            (SimpleNamespace(text=fixture("dlrg-353975.html")), "detail", 2),
            (SimpleNamespace(content=fixture("dlrg-junior.ics")), "calendar", 3),
        ]
    )
    publish = AsyncMock()
    monkeypatch.setattr(clubs, "acquire", acquire)
    monkeypatch.setattr(clubs, "sync_cultural_events_to_db_and_publish", publish)
    conn = Connection()
    await clubs.import_club_events(conn, None, SOURCES["dlrg-lampertheim-events"])
    assert acquire.await_count == 3
    assert len(publish.call_args.args[2]) == 3
    assert conn.execute.await_count == 4


def test_new_sources_are_enabled_unique_and_registered():
    import runner

    manifest = runner.sources()
    added = [s for s in manifest if s["adapter"] in ("club-events", "tribe-events")]
    assert len(added) == 7
    assert all(s["enabled"] for s in added)
    assert runner.ADAPTERS["club-events"] is clubs.import_club_events
    assert runner.ADAPTERS["tribe-events"] is tribe.import_biblis_events
