"""Biblis feed regression checks using public source records from 2026-10-06."""

import copy
import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import biblis_events as feed
import pytest

ROOT = Path(__file__).parents[1]
SOURCE = next(
    s
    for s in json.loads((ROOT / "sources.json").read_text())["sources"]
    if s["id"] == "buergerstiftung-biblis-events"
)
ITEMS = json.loads((Path(__file__).parent / "fixtures/events/biblis.json").read_text())
NOW = datetime(2026, 10, 6, tzinfo=UTC)


def item(identity):
    return copy.deepcopy(next(e for e in ITEMS if e["id"] == identity))


def test_real_events_and_verified_specific_venues():
    for identity in (6726, 7430, 7831, 7131, 7141):
        event = feed.parse_event(item(identity), SOURCE, NOW)
        assert event["municipality"] == "Biblis"
        assert event["id"] == f"bsb-{identity}"
    assert not feed.parse_event(item(6726), SOURCE, NOW)["is_free"]
    assert not feed.parse_event(item(7430), SOURCE, NOW)["is_free"]
    assert feed.parse_event(item(8211), SOURCE, NOW) is None
    altered = item(7141)
    altered["venue"]["id"] = 99999
    assert feed.parse_event(altered, SOURCE, NOW) is None


@pytest.mark.parametrize(
    "city,postcode", [("Heppenheim", "64646"), ("Biblis", "68642")]
)
def test_foreign_or_conflicting_address_overrides_venue(city, postcode):
    event = item(7831)
    event["venue"].update(city=city, zip=postcode)
    assert feed.parse_event(event, SOURCE, NOW) is None


def test_all_day_dst_and_entities():
    event = item(7131)
    event.update(
        start_date="2026-10-25 00:00:00",
        end_date="2026-10-25 23:59:59",
        title="Fest &#038; Lauf",
    )
    parsed = feed.parse_event(event, SOURCE, NOW)
    assert parsed["title"] == "Fest & Lauf"
    assert parsed["start_time"].endswith("+02:00")
    assert parsed["end_time"].endswith("+01:00")
    assert "Tagesgrenzen" in parsed["description"]
    event.update(
        all_day=False,
        utc_start_date="2026-10-25 00:30:00",
        utc_end_date="2026-10-25 01:30:00",
    )
    start, end = feed.period(event)
    assert start.hour == end.hour == 2
    assert start.utcoffset() != end.utcoffset()


@pytest.mark.parametrize(
    "cost,description,expected",
    [
        ("", "Eintritt frei.", True),
        ("", "Eintritt nur für Mitglieder frei.", False),
        ("", "Eintritt frei. Andere zahlen 5 Euro.", False),
        ("€12,99", "Eintritt frei.", False),
        ("", "", False),
        ("0,00 €", "", True),
    ],
)
def test_admission(cost, description, expected):
    assert feed.admission(cost, description) is expected


class Connection:
    execute = None

    def __init__(self):
        self.execute = AsyncMock()
        self.commit = AsyncMock()

    @asynccontextmanager
    async def transaction(self):
        yield


@pytest.mark.asyncio
async def test_complete_pagination_keeps_recurrence_ids(monkeypatch):
    events = [dict(item(7831), id=1000 + i) for i in range(51)]
    responses = [
        {"events": events[:50], "total": 51, "total_pages": 2},
        {"events": events[50:], "total": 51, "total_pages": 2},
    ]
    acquire = AsyncMock(
        side_effect=[
            (SimpleNamespace(json=lambda body=body: body), str(index), index)
            for index, body in enumerate(responses)
        ]
    )
    publish = AsyncMock()
    monkeypatch.setattr(feed, "acquire", acquire)
    monkeypatch.setattr(feed, "sync_cultural_events_to_db_and_publish", publish)
    conn = Connection()
    await feed.import_biblis_events(conn, None, SOURCE)
    assert len(publish.call_args.args[2]) == 51
    assert "page=2" in acquire.call_args_list[1].args[3]
    assert (
        "DELETE FROM cultural_events WHERE source=%s"
        in conn.execute.call_args_list[0].args[0]
    )
    conn.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["truncated", "duplicate", "changed", "broken"])
async def test_incomplete_import_never_reconciles_or_publishes(monkeypatch, failure):
    events = [dict(item(7831), id=1000 + i) for i in range(51)]
    second = {"events": events[50:], "total": 51, "total_pages": 2}
    if failure == "truncated":
        second["events"] = []
    if failure == "duplicate":
        second["events"] = [events[0]]
    if failure == "changed":
        second["total"] = 52
    if failure == "broken":
        second = {}
    bodies = [{"events": events[:50], "total": 51, "total_pages": 2}, second]
    monkeypatch.setattr(
        feed,
        "acquire",
        AsyncMock(
            side_effect=[
                (SimpleNamespace(json=lambda body=body: body), str(i), i)
                for i, body in enumerate(bodies)
            ]
        ),
    )
    publish = AsyncMock()
    monkeypatch.setattr(feed, "sync_cultural_events_to_db_and_publish", publish)
    conn = Connection()
    with pytest.raises((ValueError, TypeError)):
        await feed.import_biblis_events(conn, None, SOURCE)
    publish.assert_not_awaited()
    conn.execute.assert_not_awaited()
    conn.commit.assert_not_awaited()
