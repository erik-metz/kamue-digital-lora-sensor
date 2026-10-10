from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import UTC, datetime
from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import AsyncMock

import adapters
import httpx
import pytest
from db_support import DatabaseCase
from event_replacements import REPLACED_SOURCE, REPLACED_URLS, superseded_occurrence
from test_verified_christmas_markets import HTML, SOURCE
from verified_christmas_markets import christmas_markets, import_christmas_markets

NOW = datetime(2026, 10, 9, tzinfo=UTC)


def original(url, year=2026, source=REPLACED_SOURCE, suffix=''):
    event = deepcopy(christmas_markets(HTML, SOURCE, NOW)[0])
    event.update(id='old-'+str(REPLACED_URLS.index(url))+'-'+str(year)+'-'+source+suffix,
                 event_url=url, source=source, start_time=f'{year}-12-04T17:00:00+01:00',
                 end_time=f'{year}-12-06T22:00:00+01:00')
    return event


def test_only_exact_source_url_and_2026_occurrence_are_superseded():
    for url in REPLACED_URLS:
        assert superseded_occurrence(original(url))
        for year in (2025, 2027):
            assert not superseded_occurrence(original(url, year))
        assert not superseded_occurrence(original(url, source='other-calendar'))
        e = original(url)
        e['event_url'] += '?different=event'
        assert not superseded_occurrence(e)


@pytest.mark.asyncio
async def test_municipal_recrawl_cannot_reimport_superseded_occurrences(monkeypatch):
    events = [original(url) for url in REPLACED_URLS]
    retained = original(REPLACED_URLS[0], 2027)
    @asynccontextmanager
    async def transaction():
        yield
    conn = SimpleNamespace(execute=AsyncMock(), commit=AsyncMock(), transaction=transaction)
    monkeypatch.setattr(adapters, 'calendar_page', lambda *args, **kwargs: (events+[retained], None))
    acquire = AsyncMock(return_value=(SimpleNamespace(text='<p>Original</p>'), 'digest', 1))
    monkeypatch.setattr(adapters, 'acquire', acquire)
    monkeypatch.setattr(adapters, 'detail_fields', lambda html: ({}, '', False))
    publish = AsyncMock()
    monkeypatch.setattr(adapters, 'sync_cultural_events_to_db_and_publish', publish)
    for _ in range(2):
        await adapters.import_lampertheim_events(conn, None, {'id': REPLACED_SOURCE, 'url': 'https://www.lampertheim.de/de/veranstaltungen/'})
        assert publish.call_args.args[2] == [retained]
    assert acquire.await_count == 4  # One calendar and only the retained detail per crawl.


class ReplacementDatabaseTests(DatabaseCase):
    async def test_only_reviewed_originals_are_replaced_after_successful_validation(self):
        obsolete = [original(url) for url in REPLACED_URLS]
        retained = [original(REPLACED_URLS[0], year) for year in (2025, 2027)]
        retained.append(original(REPLACED_URLS[0], source='other-calendar'))
        unrelated = original(REPLACED_URLS[0], suffix='unrelated')
        unrelated['event_url'] = 'https://www.lampertheim.de/de/veranstaltungen/termine/other.php'
        retained.append(unrelated)
        digest = sha256(b"reviewed old occurrences").hexdigest()
        await self.conn.execute(
            "INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,'text/plain')",
            (digest, b"reviewed old occurrences"),
        )
        await adapters.sync_cultural_events_to_db_and_publish(self.conn, SOURCE, obsolete+retained, digest, NOW)
        before = await self.scalar('SELECT count(*) FROM cultural_events')
        html = HTML.replace('Öffnungszeiten 2026:', 'Öffnungszeiten:')
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, text=html))) as client:
            with pytest.raises(ValueError):
                await import_christmas_markets(self.conn, client, SOURCE)
            self.assertEqual(await self.scalar('SELECT count(*) FROM cultural_events'), before)
            html = HTML
            for _ in range(2):
                await import_christmas_markets(self.conn, client, SOURCE)
            ids = {row[0] for row in await (await self.conn.execute('SELECT id FROM cultural_events')).fetchall()}
            self.assertTrue(all(e['id'] not in ids for e in obsolete))
            self.assertTrue(all(e['id'] in ids for e in retained))
            self.assertEqual(len(ids), 9 + len(retained))
