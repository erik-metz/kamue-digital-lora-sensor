"""Reference propagation, source cooldown and real canonical persistence contracts."""
import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import psycopg
import psycopg_pool
import pytest
from collector import (
    identifiers,
    ingest,
    ingest_catalog,
    next_catalog_time,
    refresh,
    store_positions,
)
from dependencies import get_db_pool
from endpoints import satellite_tracking
from fastapi import FastAPI
from psycopg import sql
from psycopg.rows import dict_row
from satellite_orbits import element, in_ried, position, regional_position
from sgp4 import exporter
from sgp4.api import Satrec

TLE = ('1 25544U 98067A   19343.69339541  .00001764  00000-0  38792-4 0  9991',
       '2 25544  51.6439 211.2001 0007417  17.6667  85.6398 15.50103472202482')

@pytest.fixture
def raw():
    data = exporter.export_omm(Satrec.twoline2rv(*TLE), 'ISS')
    data['CREATION_DATE'] = '2019-12-09T17:00:00'
    return data


def test_reference_propagation_and_staleness(raw):
    stamp = datetime(2019, 12, 9, 20, 42, tzinfo=UTC)
    sample = position(raw, stamp)
    # SGP4 reference example: TEME (-6088.92,-936.13,-2866.44) km.
    assert -28 < sample['latitude'] < -24
    assert 380 < sample['altitude_km'] < 450
    assert 7.5 < sample['speed_km_s'] < 7.9
    assert -180 <= sample['longitude'] <= 180
    assert position(raw, stamp + timedelta(days=11)) is None
    assert position(raw, datetime(2019, 1, 1, tzinfo=UTC)) is None
    assert position(raw, stamp + timedelta(seconds=1))['longitude'] != sample['longitude']
    _, _, orbit, _ = element(raw)
    reference = Satrec.twoline2rv(*TLE)
    _, r, _ = orbit.sgp4(2458826.5, .8625)
    _, expected, _ = reference.sgp4(2458826.5, .8625)
    assert r == pytest.approx(expected, abs=0.001)


def test_invalid_elements_and_selection(raw):
    assert identifiers('25544,25544,43873') == [25544, 43873]
    for value in ('', '0', '../gp', '25544/format/json', '1000000000'):
        with pytest.raises(ValueError):
            identifiers(value)
    for key, value in (('MEAN_MOTION', 'NaN'), ('REF_FRAME', 'J2000'), ('ECCENTRICITY', 2)):
        with pytest.raises(ValueError):
            element({**raw, key: value})

@pytest.fixture
def database():
    dsn = os.getenv('SATELLITE_TEST_DATABASE_URL')
    if not dsn:
        pytest.skip('Set SATELLITE_TEST_DATABASE_URL for isolated-schema database tests')
    schema = 'satellite_test_' + uuid4().hex
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        conn.execute(sql.SQL('SET search_path TO {}, public').format(sql.Identifier(schema)))
        try:
            migration = Path(__file__).resolve().parents[2] / 'api/v1/migrations/20260930_measurements.sql'
            conn.execute(migration.read_text())
            yield conn, schema
        finally:
            conn.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def test_idempotency_same_epoch_publications_corrections_and_positions(database, raw):
    conn, _ = database
    now = datetime(2019, 12, 9, 21, tzinfo=UTC)
    ingest(conn, [raw], [25544], now)
    ingest(conn, [raw], [25544], now)
    assert conn.execute('SELECT count(*) FROM readings').fetchone()[0] == 1
    newer = {**raw, 'CREATION_DATE': '2019-12-09T18:00:00', 'MEAN_ANOMALY': 86}
    ingest(conn, [newer], [25544], now)
    assert conn.execute('SELECT count(*) FROM readings').fetchone()[0] == 2
    ingest(conn, [{**newer, 'MEAN_ANOMALY': 87}], [25544], now + timedelta(seconds=1))
    assert conn.execute('SELECT count(*) FROM reading_revisions').fetchone()[0] == 1
    ingest(conn, [raw], [25544], now + timedelta(seconds=2))
    assert conn.execute("SELECT provenance->'omm'->>'MEAN_ANOMALY' FROM latest_readings").fetchone()[0] == '87'
    with patch('collector.regional_position', return_value={**position(raw, now), 'latitude': 49.65, 'longitude': 8.45}):
        store_positions(conn, now)
        store_positions(conn, now)
    assert conn.execute('SELECT count(*) FROM readings').fetchone()[0] == 7
    store_positions(conn, now + timedelta(days=11))
    assert conn.execute('SELECT count(*) FROM readings').fetchone()[0] == 8


def test_cooldown_survives_failed_request(database):
    conn, _ = database
    async def check():
        with patch('collector.httpx.AsyncClient') as client:
            client.return_value.__aenter__.return_value.post = AsyncMock(side_effect=httpx.ConnectError('unavailable'))
            with pytest.raises(httpx.ConnectError):
                await refresh(conn, [25544], 'account', 'secret')
            await refresh(conn, [25544], 'account', 'secret')
            assert client.call_count == 1
    asyncio.run(check())
    assert conn.execute("SELECT metadata->>'next_attempt' FROM entities WHERE id='satellite:feed'").fetchone()[0]


def test_api_history_pagination_historical_elements_and_stream_disconnect(database, raw):
    conn, schema = database
    dsn = os.environ["SATELLITE_TEST_DATABASE_URL"]
    now = datetime(2019, 12, 9, 21, tzinfo=UTC)
    ingest(conn, [raw], [25544], now)
    with patch('collector.regional_position', side_effect=lambda orbit, at: {**position(raw, at), 'latitude': 49.65, 'longitude': 8.45}):
        store_positions(conn, now)
        store_positions(conn, now + timedelta(seconds=10))
    async def check():
        async with psycopg_pool.AsyncConnectionPool(dsn, kwargs={'options': f'-c search_path={schema},public', 'row_factory': dict_row}, open=False) as pool:
            app = FastAPI()
            app.include_router(satellite_tracking.router)
            app.dependency_overrides[get_db_pool] = lambda: pool
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                params = {'start': now.isoformat(), 'end': (now+timedelta(hours=1)).isoformat(), 'limit': 1}
                first = await client.get('/satellites/25544/history', params=params)
                assert first.status_code == 200
                body = first.json()
                assert len(body['positions']) == 1 and body['next_start']
                params['start'] = body['next_start']
                second = (await client.get('/satellites/25544/history', params=params)).json()
                assert second['positions'][0]['timestamp'] != body['positions'][0]['timestamp']
                orbit = await client.get('/satellites/25544/orbit', params={'at': now.isoformat(), 'minutes': 1})
                assert orbit.status_code == 200 and len(orbit.json()['positions']) == 3
                absent = await client.get('/satellites/25544/orbit', params={'at': '2019-12-09T16:00:00Z'})
                assert absent.status_code == 404
                invalid = await client.get('/satellites/25544/history', params={'start': '2019-12-09T21:00:00', 'end': '2019-12-10T21:00:00'})
                assert invalid.status_code == 422
            # No live positions from stale fixtures; catalog retains satellite metadata.
            snapshot = await satellite_tracking.snapshot(pool)
            assert snapshot['positions'] == [] and snapshot['catalog_count'] == 1 and snapshot['status'] == 'unavailable'
            request = AsyncMock()
            request.is_disconnected.side_effect = [False, True]
            streamed = await satellite_tracking.stream(request, pool)
            iterator = streamed.body_iterator
            with patch('endpoints.satellite_tracking.asyncio.sleep', new=AsyncMock()):
                event = await anext(iterator)
                assert json.loads(event.removeprefix('data: ').strip())['basis'] == 'model'
                with pytest.raises(StopAsyncIteration):
                    await anext(iterator)
    asyncio.run(check())


def test_region_bounds_and_fast_gate_match_full_propagation(raw):
    assert in_ried({'latitude': 49.45, 'longitude': 8.15})
    assert in_ried({'latitude': 49.90, 'longitude': 8.80})
    assert not in_ried({'latitude': 49.449, 'longitude': 8.5})
    assert not in_ried({'latitude': 49.65, 'longitude': 8.801})
    orbit = element(raw)
    start = datetime(2019, 12, 9, 21, tzinfo=UTC)
    for seconds in range(0, 86400 * 3, 30):
        at = start + timedelta(seconds=seconds)
        full = position(raw, at)
        fast = regional_position(orbit, at)
        assert bool(fast) == in_ried(full)
        if fast:
            assert fast == full


def test_catalog_new_satellites_changes_and_decay_are_historical(database, raw):
    conn, _ = database
    now = datetime(2019, 12, 9, 21, tzinfo=UTC)
    assert identifiers('all') is None
    ingest(conn, [raw, {**raw, 'NORAD_CAT_ID': 12345, 'OBJECT_NAME': 'NEW'}], None, now)
    assert conn.execute("SELECT count(*) FROM entities WHERE entity_type='satellite'").fetchone()[0] == 2
    catalog = {'NORAD_CAT_ID': 25544, 'OBJECT_TYPE': 'PAYLOAD', 'SATNAME': 'ISS', 'DECAY': None}
    ingest_catalog(conn, [catalog], now)
    ingest_catalog(conn, [catalog], now + timedelta(seconds=1))
    assert conn.execute("SELECT count(*) FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id WHERE d.metric='catalog_status'").fetchone()[0] == 1
    ingest_catalog(conn, [{**catalog, 'DECAY': '2019-12-10'}], now + timedelta(days=1))
    assert conn.execute("SELECT metadata->>'decayed' FROM entities WHERE id='satellite:25544'").fetchone()[0] == 'true'
    assert conn.execute("SELECT count(*) FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id WHERE d.metric='catalog_status'").fetchone()[0] == 2
    from collector import load_elements
    assert [key for key, _ in load_elements(conn)] == ['satellite:12345']
    with pytest.raises(ValueError):
        ingest_catalog(conn, [], now)


def test_only_regional_positions_persist_and_exit_is_recorded(database, raw):
    conn, _ = database
    now = datetime(2019, 12, 9, 21, tzinfo=UTC)
    ingest(conn, [raw], None, now)
    store_positions(conn, now)
    assert conn.execute('SELECT count(*) FROM readings').fetchone()[0] == 1
    sample = {**position(raw, now), 'latitude': 49.65, 'longitude': 8.45}
    with patch('collector.regional_position', return_value=sample):
        store_positions(conn, now + timedelta(seconds=10))
    store_positions(conn, now + timedelta(seconds=20))
    states = conn.execute("SELECT r.value FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id WHERE d.metric='regional_presence' ORDER BY observed_at").fetchall()
    assert [int(row[0]) for row in states] == [1, 0]
    assert conn.execute("SELECT count(*) FROM readings r JOIN measurement_definitions d ON d.id=r.measurement_id WHERE d.metric='latitude'").fetchone()[0] == 1


def test_catalog_schedule_after_1700_utc():
    assert next_catalog_time(datetime(2026, 10, 6, 8, tzinfo=UTC)) == datetime(2026, 10, 6, 17, 5, tzinfo=UTC)
    assert next_catalog_time(datetime(2026, 10, 6, 18, tzinfo=UTC)) == datetime(2026, 10, 7, 17, 5, tzinfo=UTC)


def test_bulk_refresh_discovers_new_ids_and_persists_both_cooldowns(database, raw):
    conn, _ = database
    stamp = datetime(2019, 12, 9, 18, tzinfo=UTC)
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return stamp
    async def check():
        with patch('collector.datetime', Clock), patch('collector.httpx.AsyncClient') as factory:
            client = factory.return_value.__aenter__.return_value
            client.post = AsyncMock(return_value=httpx.Response(200, request=httpx.Request('POST', 'https://test/login')))
            client.get = AsyncMock(side_effect=[
                httpx.Response(200, json=[raw, {**raw, 'NORAD_CAT_ID': 12345}], request=httpx.Request('GET', 'https://test/gp')),
                httpx.Response(200, json=[{'NORAD_CAT_ID': 25544, 'OBJECT_TYPE': 'PAYLOAD', 'DECAY': None}], request=httpx.Request('GET', 'https://test/catalog')),
            ])
            assert await refresh(conn, None, 'account', 'secret')
            assert not await refresh(conn, None, 'account', 'secret')
            assert client.get.call_count == 2
            assert '/class/gp/OBJECT_TYPE/PAYLOAD/' in client.get.call_args_list[0].args[0]
            assert '/class/satcat/OBJECT_TYPE/PAYLOAD/' in client.get.call_args_list[1].args[0]
    asyncio.run(check())
    metadata = conn.execute("SELECT metadata FROM entities WHERE id='satellite:feed'").fetchone()[0]
    assert metadata['scope'] == 'all' and metadata['count'] == 2
    assert metadata['next_catalog_attempt'].startswith('2019-12-10T17:05')


def test_api_has_no_500_catalog_cap_and_shares_regional_snapshot(database, raw):
    _, schema = database
    stamp = datetime(2019, 12, 9, 21, tzinfo=UTC)
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return stamp
    rows = [{'id': f'satellite:{n}', 'name': str(n), 'provenance': {'omm': {**raw, 'NORAD_CAT_ID': n}}} for n in range(1, 602)]
    def regional(orbit, at):
        if orbit[0] != 601:
            return None
        return {**position(raw, at), 'norad_id': 601, 'latitude': 49.65, 'longitude': 8.45}
    async def check():
        async with psycopg_pool.AsyncConnectionPool(os.environ['SATELLITE_TEST_DATABASE_URL'], kwargs={'options': f'-c search_path={schema},public', 'row_factory': dict_row}, open=False) as pool:
            with patch('endpoints.satellite_tracking.elements', AsyncMock(return_value=rows)) as loader, patch('endpoints.satellite_tracking.datetime', Clock), patch('endpoints.satellite_tracking.regional_position', side_effect=regional) as propagate:
                first = await satellite_tracking.snapshot(pool)
                second = await satellite_tracking.snapshot(pool)
                assert first is second
                assert first['catalog_count'] == first['valid_orbit_count'] == 601
                assert first['status'] == 'ready'
                assert [p['norad_id'] for p in first['positions']] == [601]
                assert loader.await_count == 1 and propagate.call_count == 601
    asyncio.run(check())
