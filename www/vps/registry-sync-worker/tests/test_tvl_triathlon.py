from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from regular_offers import import_tv_lauftreff, import_tvl_triathlon, tvl_triathlon
from test_club_events import SOURCES
from test_regular_offers import BODY as RUNNING_BODY

SOURCE = SOURCES["tvl-triathlon-regular-offers"]
BODY = (Path(__file__).parent / "fixtures/events/tvl-triathlon.html").read_text()


def test_verified_training_has_season_membership_and_no_invented_end():
    offers = tvl_triathlon(BODY, SOURCE)
    assert len(offers) == len({o["id"] for o in offers}) == 3
    assert all(o["municipality"] == "Lampertheim" for o in offers)
    assert [(o["weekday"], o["start_local"], o.get("end_local")) for o in offers] == [
        ("Freitag", "18:30", "20:00"),
        ("Freitag", "20:00", "21:00"),
        ("Samstag", "10:45", None),
    ]
    assert all("Vereinsmitglieder" in o["description"] for o in offers[:2])
    assert "außerhalb des Winterplans" in offers[0]["description"]
    assert all("Oktober–März" in o["title"] for o in offers[1:])
    assert "60–90 Minuten" in offers[2]["description"]
    assert all("triathlon@tv-lampertheim.de" in o["description"] for o in offers)
    assert not any({"start_time", "end_time", "is_free"} & o.keys() for o in offers)
    assert not any("Schwimm" in o["title"] or "Rad" in o["title"] for o in offers)


@pytest.mark.parametrize(
    "before,after",
    [
        ("Freitag 18:30", "Freitag 18:45"),
        ("Samstag 10:45", "Sonntag 10:45"),
        ("Lampertheim - Gymnastikraum", "Einhausen - Gymnastikraum"),
        ("Goetheschule-Sporthalle", "Andere Sporthalle"),
        ("Oktober - März", "November - Februar"),
        ("alle Mitglieder", "alle Interessierten"),
        ("60-90 min", "90-120 min"),
        ("triathlon@tv-lampertheim.de", "andere@example.org"),
        (
            "Rumpfstabilisation und koordinatives Zirkeltraining",
            "Nur Rumpfstabilisation",
        ),
    ],
)
def test_changed_time_venue_season_membership_or_plan_requires_verification(
    before, after
):
    with pytest.raises(ValueError):
        tvl_triathlon(BODY.replace(before, after), SOURCE)


def test_duplicate_schedule_is_rejected():
    with pytest.raises(ValueError):
        tvl_triathlon(BODY + BODY, SOURCE)


class TvlOfferDatabaseTests(DatabaseCase):
    async def test_replay_and_failed_update_preserve_other_clubs_and_archive_source(
        self,
    ):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    text=BODY if str(request.url) == SOURCE["url"] else RUNNING_BODY,
                )
            )
        ) as client:
            await import_tv_lauftreff(
                self.conn, client, SOURCES["tv-gross-rohrheim-lauftreff"]
            )
            await import_tvl_triathlon(self.conn, client, SOURCE)
            await import_tvl_triathlon(self.conn, client, SOURCE)
        query = "SELECT data FROM collected_datasets WHERE dataset='social/regular-offers/tvl-triathlon-regular-offers'"
        data = await self.scalar(query)
        self.assertEqual(len(data), 3)
        self.assertEqual(await self.scalar("SELECT count(*) FROM cultural_events"), 0)
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collected_datasets WHERE dataset LIKE 'social/regular-offers/%%'"
            ),
            2,
        )
        self.assertEqual(
            await self.scalar(
                "SELECT convert_from(p.body,'UTF8') FROM collected_payloads p JOIN collected_datasets d ON d.payload_sha256=p.sha256 WHERE d.dataset='social/regular-offers/tvl-triathlon-regular-offers'"
            ),
            BODY,
        )
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, text=BODY.replace("Oktober - März", "November - Februar")
                )
            )
        ) as client:
            with self.assertRaises(ValueError):
                await import_tvl_triathlon(self.conn, client, SOURCE)
        self.assertEqual(await self.scalar(query), data)
        self.assertEqual(
            await self.scalar(
                "SELECT count(*) FROM collected_datasets WHERE dataset='social/regular-offers/tv-gross-rohrheim-lauftreff'"
            ),
            1,
        )
