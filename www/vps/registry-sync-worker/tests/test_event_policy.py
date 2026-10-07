from unittest.mock import AsyncMock

import adapters
import pytest
from event_policy import aggregate_events


def item(identity="a", **values):
    return dict(
        id=identity,
        title="Kerwe-Frühschoppen",
        municipality="Bürstadt",
        venue_name="Bürgerhaus Bobstadt",
        start_time="2026-08-23T10:00:00+02:00",
        end_time="2026-08-23T13:00:00+02:00",
        source=identity,
        status="scheduled",
        is_free=True,
        **values,
    )


def test_cross_source_duplicate_keeps_stable_identity_and_provenance():
    a = item("a", description="Programm")
    b = item("b", event_url="https://example.org/kerwe")
    b["title"] = "Kerwe Frühschoppen"
    assert aggregate_events([a, b]) == aggregate_events([b, a])
    result = aggregate_events([b, a])
    assert len(result) == 1 and result[0]["id"] == "a"
    assert len(result[0]["source_events"]) == 2
    assert result[0]["description"] == "Programm"


@pytest.mark.parametrize(
    "field,value",
    [
        ("start_time", "2026-08-23T11:00:00+02:00"),
        ("end_time", "2026-08-23T14:00:00+02:00"),
        ("municipality", "Lampertheim"),
        ("venue_name", "Rathaus"),
        ("title", "Kinderkerwe"),
        ("venue_name", ""),
    ],
)
def test_distinct_sessions_or_uncertain_venues_remain_separate(field, value):
    a, b = item("a"), item("b")
    b[field] = value
    assert len(aggregate_events([a, b])) == 2


def test_explicit_cancellation_wins_over_other_calendar_and_fee_is_conservative():
    a, b = item("a"), item("b")
    b.update(title="ABGESAGT: Kerwe-Frühschoppen", is_free=False)
    result = aggregate_events([a, b])
    assert len(result) == 1 and result[0]["status"] == "cancelled"
    assert not result[0]["is_free"]
    assert b["status"] == "scheduled"  # do not mutate independent source data


def test_discussion_of_cancelled_prior_year_does_not_cancel_new_event():
    a = item(description="Letztes Jahr abgesagt. Dieses Jahr findet die Kerwe statt.")
    assert aggregate_events([a])[0]["status"] == "scheduled"


@pytest.mark.asyncio
async def test_publication_deduplicates_without_deleting_source_rows(monkeypatch):
    a, b = item("a"), item("b")
    conn = AsyncMock()
    cursor = AsyncMock()
    cursor.fetchall.return_value = [(a,), (b,)]
    conn.execute.return_value = cursor
    publish = AsyncMock()
    monkeypatch.setattr(adapters, "publish", publish)
    await adapters.sync_cultural_events_to_db_and_publish(
        conn, {"id": "test"}, [], "digest", None
    )
    assert len(publish.call_args.args[3]) == 1
    assert all("DELETE" not in call.args[0] for call in conn.execute.call_args_list)
