"""Public Musikkiste feed acquired on 2026-10-07; no production writes."""

import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from biblis_events import import_biblis_events, parse_event
from db_support import DatabaseCase
from test_club_events import SOURCES, FixedClock

SOURCE = SOURCES["musikkiste-gross-rohrheim-events"]
BODY = json.loads(
    (Path(__file__).parent / "fixtures/events/musikkiste.json").read_text()
)
NOW = datetime(2026, 10, 7, tzinfo=UTC)


def test_real_calendar_keeps_dates_prices_venues_and_unique_source_ids():
    parsed = [parse_event(item, SOURCE, NOW) for item in BODY["events"]]
    events = [event for event in parsed if event is not None]
    assert len(events) == 12 and len({event["id"] for event in events}) == 12
    deferred = [item for item, event in zip(BODY["events"], parsed) if event is None]
    assert [item["title"] for item in deferred] == [
        "Herbstjazz in der Groß-Rohrheimer Kirche"
    ]
    assert deferred[0]["venue"]["zip"] == "68647"
    assert all(event["municipality"] == "Groß-Rohrheim" for event in events)
    assert all(event["category"] == "concert" for event in events)
    assert all(event["id"].startswith("musikkiste-gr-") for event in events)
    upcoming = [event for event in events if event["status"] == "scheduled"]
    assert [event["start_time"] for event in upcoming] == [
        "2026-11-03T20:00:00+01:00",
        "2026-12-01T20:00:00+01:00",
    ]
    assert all(event["end_time"].endswith("T22:00:00+01:00") for event in upcoming)
    assert all(event["is_free"] for event in upcoming)
    assert all("Alemannia" in event["venue_name"] for event in upcoming)


@pytest.mark.parametrize(
    "venue", [{}, {"venue": "Alemannia", "city": "Darmstadt", "zip": "64283"}]
)
def test_organizer_location_never_replaces_unknown_or_foreign_event_venue(venue):
    item = copy.deepcopy(BODY["events"][-1])
    item["venue"] = venue
    assert parse_event(item, SOURCE, NOW) is None


def test_source_category_override_applies_only_to_verified_titles():
    item = copy.deepcopy(BODY["events"][-1])
    item["title"] = "Jahreshauptversammlung"
    assert parse_event(item, SOURCE, NOW)["category"] == "civic"
    plain_source = {
        key: value for key, value in SOURCE.items() if key != "category_overrides"
    }
    assert parse_event(BODY["events"][-1], plain_source, NOW)["category"] == "theater"


class MusikkisteDatabaseTests(DatabaseCase):
    async def test_full_feed_publishes_and_replays_without_duplicates(self):
        requests = []

        def response(request):
            requests.append(request)
            return httpx.Response(200, json=BODY)

        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            with patch("biblis_events.datetime", FixedClock):
                await import_biblis_events(self.conn, client, SOURCE)
                await import_biblis_events(self.conn, client, SOURCE)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 12)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset='social/events'"
        )
        self.assertEqual(len(data), 12)
        self.assertTrue(all(event["source"] == SOURCE["id"] for event in data))
        self.assertTrue(
            all(event["source_events"][0]["source"] == SOURCE["id"] for event in data)
        )
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collection_attempts WHERE status='success'"
            ),
            2,
        )
        self.assertTrue(
            all(request.url.params["end_date"] == "2027-12-31" for request in requests)
        )
