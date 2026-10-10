"""Verified calendar dates, no extrapolated programme or opening hours."""

from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from long_term_events import import_long_term_events, long_term_events
from test_club_events import SOURCES

SOURCE = SOURCES["gross-rohrheim-long-term-events"]
BODY = (
    Path(__file__).parent / "fixtures/events/gross-rohrheim-long-term.html"
).read_text()
NOW = datetime(2026, 10, 8, tzinfo=UTC)


def test_only_published_festival_dates_in_authorized_year_are_imported():
    events = long_term_events(BODY, SOURCE, NOW)
    assert [e["title"] for e in events] == ["Maimarkt", "Rohremer Kerb / Kirchweih"]
    assert [(e["start_time"], e["end_time"]) for e in events] == [
        ("2027-05-22T00:00:00+02:00", "2027-05-23T23:59:59+02:00"),
        ("2027-08-21T00:00:00+02:00", "2027-08-21T23:59:59+02:00"),
    ]
    assert all(
        e["municipality"] == "Groß-Rohrheim"
        and not e["is_free"]
        and e["category"] == "festival"
        for e in events
    )
    assert all(
        "noch nicht veröffentlicht" in e["venue_name"]
        and "Tagesgrenzen" in e["description"]
        for e in events
    )
    assert not any("Bürgerhalle" in e["venue_name"] for e in events)
    assert long_term_events(BODY, SOURCE, NOW) == events


@pytest.mark.parametrize(
    "old,new",
    [
        ("Langfristige Termine", "Andere Termine"),
        ("Für Ihre langfristige Terminplanung", "Abgesagte Veranstaltungen"),
        ("22./23. Mai 2027", "22./25. Mai 2027"),
        ("21. August 2027", "21./23. August 2027"),
        ("21. August 2027", "32. August 2027"),
        ("21. August 2027", "21. August 2027 22. August 2027"),
        ("21. August 2027", "Termin abgesagt"),
    ],
)
def test_unverified_changes_fail_without_guessing(old, new):
    with pytest.raises(ValueError):
        long_term_events(BODY.replace(old, new), SOURCE, NOW)


class LongTermDatabaseTests(DatabaseCase):
    async def test_replay_and_changed_notice_keep_good_publication(self):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, text=BODY)
            )
        ) as client:
            await import_long_term_events(self.conn, client, SOURCE)
            await import_long_term_events(self.conn, client, SOURCE)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 2)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset='social/events'"
        )
        self.assertEqual(len(data), 2)
        self.assertTrue(
            all(e["source_events"][0]["source"] == SOURCE["id"] for e in data)
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, text=BODY.replace("21. August 2027", "abgesagt")
                )
            )
        ) as client:
            with self.assertRaises(ValueError):
                await import_long_term_events(self.conn, client, SOURCE)
        self.assertEqual(
            await self.scalar(
                "SELECT data FROM collected_datasets WHERE dataset='social/events'"
            ),
            data,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collection_attempts WHERE status='success'"
            ),
            2,
        )
