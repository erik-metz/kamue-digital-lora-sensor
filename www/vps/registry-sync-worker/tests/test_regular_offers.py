from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from regular_offers import import_tv_lauftreff, tv_lauftreff
from test_club_events import SOURCES

SOURCE = SOURCES["tv-gross-rohrheim-lauftreff"]
BODY = (Path(__file__).parent / "fixtures/events/tv-lauftreff.html").read_text()


def test_weekly_offer_has_no_invented_occurrences_or_price():
    offer = tv_lauftreff(BODY, SOURCE)[0]
    assert offer["weekday"] == "Mittwoch" and offer["start_local"] == "19:00"
    assert offer["municipality"] == "Groß-Rohrheim"
    assert "Bürgerhalle" in offer["venue_name"]
    assert not {"start_time", "end_time", "is_free", "valid_until"} & offer.keys()


@pytest.mark.parametrize(
    "before,after",
    [
        ("mittwochs", "donnerstags"),
        ("19.00", "18.00"),
        ("Eingang Bürgerhalle", "Sporthalle Darmstadt"),
        ("<h1>Lauftreff</h1>", "<h1>Archiv</h1>"),
    ],
)
def test_changed_schedule_or_place_requires_verification(before, after):
    with pytest.raises(ValueError):
        tv_lauftreff(BODY.replace(before, after), SOURCE)


class RegularOffersDatabaseTests(DatabaseCase):
    async def test_replay_archives_source_without_creating_calendar_events(self):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, text=BODY)
            )
        ) as client:
            await import_tv_lauftreff(self.conn, client, SOURCE)
            await import_tv_lauftreff(self.conn, client, SOURCE)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers'"
        )
        self.assertEqual(len(data), 1)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 0)
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collection_attempts WHERE status='success'"
            ),
            2,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT convert_from(p.body,'UTF8') FROM collected_payloads p JOIN collected_datasets d ON d.payload_sha256=p.sha256 WHERE d.dataset='social/regular-offers'"
            ),
            BODY,
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, text=BODY.replace("19.00", "18.00"))
            )
        ) as client:
            with self.assertRaises(ValueError):
                await import_tv_lauftreff(self.conn, client, SOURCE)
        self.assertEqual(
            await self.scalar(
                "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers'"
            ),
            data,
        )
