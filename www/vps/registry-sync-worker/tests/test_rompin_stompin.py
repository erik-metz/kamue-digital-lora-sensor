from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from regular_offers import import_rompin_stompin, import_tv_lauftreff, rompin_stompin
from test_club_events import SOURCES
from test_regular_offers import BODY as GROSS_BODY

SOURCE = SOURCES["rompin-stompin-regular-offers"]
BODY = (
    Path(__file__).parent / "fixtures/events/rompin-stompin-courses.html"
).read_text()


def test_verified_courses_preserve_town_times_venues_and_unknown_participation():
    offers = rompin_stompin(BODY, SOURCE)
    assert len(offers) == len({o["id"] for o in offers}) == 8
    assert [o["municipality"] for o in offers].count("Biblis") == 4
    assert [o["municipality"] for o in offers].count("Bürstadt") == 4
    assert {
        (o["start_local"], o["end_local"])
        for o in offers
        if o["municipality"] == "Biblis"
    } == {
        ("10:00", "11:00"),
        ("18:00", "19:00"),
        ("19:00", "20:00"),
        ("20:00", "21:00"),
    }
    assert all(o["weekday"] in {"Montag", "Donnerstag"} for o in offers)
    assert all("Einhausen" not in o["venue_name"] for o in offers)
    assert all(not {"start_time", "end_time", "is_free"} & o.keys() for o in offers)
    assert all("freie Plätze" in o["description"] for o in offers)


@pytest.mark.parametrize(
    "before,after",
    [
        ("18:00- 19:00", "18:15- 19:00"),
        ("Bürgerzentrum Biblis", "Mehrzweckhalle Einhausen"),
        ("Darmstädter Straße 4-6", "Andere Straße 9"),
        ("Mainstraße 44", "Mainstraße 99"),
        ("Unser Kursangebot", "Archiv"),
        ("am Montag mit Britta", "am Dienstag mit Britta"),
    ],
)
def test_changed_course_or_venue_requires_new_verification(before, after):
    with pytest.raises(ValueError):
        rompin_stompin(BODY.replace(before, after), SOURCE)


def test_duplicate_course_is_rejected():
    with pytest.raises(ValueError):
        rompin_stompin(BODY + BODY, SOURCE)


class RompinOfferDatabaseTests(DatabaseCase):
    async def test_replay_and_failed_update_preserve_other_club(self):
        def response(request):
            if str(request.url) == SOURCE["url"]:
                assert request.headers["user-agent"] == SOURCE["headers"]["User-Agent"]
            return httpx.Response(
                200, text=BODY if str(request.url) == SOURCE["url"] else GROSS_BODY
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            await import_tv_lauftreff(
                self.conn, client, SOURCES["tv-gross-rohrheim-lauftreff"]
            )
            await import_rompin_stompin(self.conn, client, SOURCE)
            await import_rompin_stompin(self.conn, client, SOURCE)
        data = await self.scalar(
            "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers/rompin-stompin-regular-offers'"
        )
        self.assertEqual(len(data), 8)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 0)
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collected_datasets WHERE dataset LIKE 'social/regular-offers/%%'"
            ),
            2,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT convert_from(p.body,'UTF8') FROM collected_payloads p JOIN collected_datasets d ON d.payload_sha256=p.sha256 WHERE d.dataset='social/regular-offers/rompin-stompin-regular-offers'"
            ),
            BODY,
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, text=BODY.replace("18:00- 19:00", "18:15- 19:00")
                )
            )
        ) as client:
            with self.assertRaises(ValueError):
                await import_rompin_stompin(self.conn, client, SOURCE)
        self.assertEqual(
            await self.scalar(
                "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers/rompin-stompin-regular-offers'"
            ),
            data,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collected_datasets WHERE dataset='social/regular-offers/tv-gross-rohrheim-lauftreff'"
            ),
            1,
        )
