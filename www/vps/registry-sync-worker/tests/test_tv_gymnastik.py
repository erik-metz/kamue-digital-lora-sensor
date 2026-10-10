from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from regular_offers import import_tv_gymnastik, import_tv_lauftreff, tv_gymnastik
from test_club_events import SOURCES
from test_regular_offers import BODY as RUNNING_BODY

SOURCE = SOURCES["tv-gross-rohrheim-gymnastik"]
FIXTURES = Path(__file__).parent / "fixtures/events"
BODY = (FIXTURES / "tv-gymnastik.html").read_text()
VENUE = (FIXTURES / "tv-gymnastik-venue.html").read_text()


def test_verified_groups_have_real_times_rooms_and_participation():
    offers = tv_gymnastik(BODY, VENUE, SOURCE)
    assert len(offers) == len({o["id"] for o in offers}) == 7
    assert {(o["weekday"], o["start_local"], o["end_local"]) for o in offers} == {
        ("Montag", "09:00", "10:00"),
        ("Montag", "18:00", "19:30"),
        ("Montag", "19:30", "20:30"),
        ("Donnerstag", "19:00", "20:00"),
        ("Dienstag", "18:30", "19:30"),
        ("Dienstag", "19:30", "20:30"),
        ("Donnerstag", "20:00", "21:30"),
    }
    assert all(o["municipality"] == "Groß-Rohrheim" for o in offers)
    assert all("Jahnstraße" in o["venue_name"] for o in offers)
    assert all("vor der ersten Teilnahme" in o["description"] for o in offers)
    assert any("Yoga" in o["title"] for o in offers)
    assert any("Zumba" in o["title"] for o in offers)
    assert not any({"start_time", "end_time", "is_free"} & o.keys() for o in offers)






def test_duplicate_group_requires_verification():
    with pytest.raises(ValueError):
        tv_gymnastik(
            BODY + BODY.replace("<h1>Gymnastikgruppen</h1>", ""), VENUE, SOURCE
        )


class GymnastikDatabaseTests(DatabaseCase):
    async def test_replay_archives_both_pages_and_failed_update_preserves_offers(self):
        def response(request):
            body = VENUE if str(request.url) == SOURCE["venue_url"] else BODY
            if str(request.url) == SOURCES["tv-gross-rohrheim-lauftreff"]["url"]:
                body = RUNNING_BODY
            return httpx.Response(200, text=body)

        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            await import_tv_lauftreff(
                self.conn, client, SOURCES["tv-gross-rohrheim-lauftreff"]
            )
            await import_tv_gymnastik(self.conn, client, SOURCE)
            await import_tv_gymnastik(self.conn, client, SOURCE)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers/tv-gross-rohrheim-gymnastik'"
        )
        self.assertEqual(len(data), 7)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 0)
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collected_datasets WHERE dataset LIKE 'social/regular-offers/%%'"
            ),
            2,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT count(DISTINCT payload_sha256) FROM collection_attempts WHERE source_id=%s",
                (SOURCE["id"],),
            ),
            2,
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    text=VENUE.replace("Jahnstraße", "Andere Straße")
                    if str(request.url) == SOURCE["venue_url"]
                    else BODY,
                )
            )
        ) as client:
            with self.assertRaises(ValueError):
                await import_tv_gymnastik(self.conn, client, SOURCE)
        self.assertEqual(
            await self.scalar(
                "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers/tv-gross-rohrheim-gymnastik'"
            ),
            data,
        )
