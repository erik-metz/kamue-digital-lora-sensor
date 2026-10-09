from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from db_support import DatabaseCase
from test_club_events import SOURCES
from verified_christmas_markets import (
    SOURCE_ID,
    christmas_markets,
    import_christmas_markets,
)

HTML = (Path(__file__).parent / "fixtures/events/lampertheim-district-christmas.html").read_text()
SOURCE = SOURCES[SOURCE_ID]
NOW = datetime(2026, 10, 9, tzinfo=UTC)


def test_daily_openings_do_not_include_overnight_closure():
    events = christmas_markets(HTML, SOURCE, NOW)
    assert [(e['start_time'], e['end_time']) for e in events] == [
        ('2026-12-05T16:00:00+01:00', '2026-12-05T21:00:00+01:00'),
        ('2026-12-06T15:00:00+01:00', '2026-12-06T19:00:00+01:00'),
        ('2026-12-12T15:00:00+01:00', '2026-12-12T21:00:00+01:00'),
    ]
    assert len({e['id'] for e in events}) == 3
    assert all(e['municipality'] == 'Lampertheim' and not e['is_free'] for e in events)
    assert [e['venue_name'] for e in events] == [
        'Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim',
        'Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim',
        'Rund ums Bürgerhaus Hüttenfeld, Lampertheim-Hüttenfeld',
    ]
    assert all(e['status'] == 'past' for e in christmas_markets(HTML, SOURCE, datetime(2027, 1, 1, tzinfo=UTC)))


@pytest.mark.parametrize('old,new', [
    ('2026:', '2027:'), ('16 - 21', '17 - 21'), ('05.12.', '04.12.'),
    ('rund ums Bürgerhaus', 'auf dem Sportplatz'),
    ('Hofheimer Weihnachtsmarkt', 'Anderer Markt'),
])
def test_changed_year_hours_date_or_venue_require_review(old, new):
    with pytest.raises(ValueError):
        christmas_markets(HTML.replace(old, new), SOURCE, NOW)


def test_missing_duplicate_and_unexpected_sources_are_rejected():
    for html in ('', HTML + HTML):
        with pytest.raises(ValueError):
            christmas_markets(html, SOURCE, NOW)
    source = deepcopy(SOURCE)
    source['url'] = 'https://example.com/'
    with pytest.raises(ValueError):
        christmas_markets(HTML, source, NOW)


def test_unrelated_market_changes_do_not_import_other_markets():
    assert christmas_markets(HTML.replace('Keine Übernahme', 'Neue Angaben'), SOURCE, NOW) == christmas_markets(HTML, SOURCE, NOW)


class ChristmasDatabaseTests(DatabaseCase):
    async def test_repeated_import_is_idempotent_and_changed_original_keeps_last_good(self):
        html = HTML
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, text=html))) as client:
            for _ in range(2):
                await import_christmas_markets(self.conn, client, SOURCE)
            self.assertEqual(await self.scalar('SELECT count(*) FROM cultural_events'), 3)
            data = await self.scalar("SELECT data FROM collected_datasets WHERE dataset='social/events'")
            self.assertEqual(len(data), 3)
            self.assertEqual(await self.scalar('SELECT count(*) FROM collection_attempts WHERE status=\'success\''), 2)
            self.assertEqual(await self.scalar("SELECT convert_from(body,'UTF8') FROM collected_payloads LIMIT 1"), HTML)
            html = HTML.replace('2026:', '2027:')
            with self.assertRaises(ValueError):
                await import_christmas_markets(self.conn, client, SOURCE)
            self.assertEqual(await self.scalar("SELECT data FROM collected_datasets WHERE dataset='social/events'"), data)
