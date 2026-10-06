"""Five-minute, normal headed Chromium acquisition for the authorized Rhine map."""
import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from collector import persist_sample
from map_protocol import SOURCE, map_vessels, position
from playwright.async_api import Error as BrowserError
from playwright.async_api import async_playwright

MAP_PROVIDER = os.environ['RHINE_MAP_PROVIDER']
BASE = f'https://www.{MAP_PROVIDER}.com/'
LOG = logging.getLogger('rhein-map')


class MissingVessel(Exception):
    """A marker may outlive its public ship detail page."""



async def checked(response):
    if response.status == 404:
        raise MissingVessel
    if response.status != 200:
        raise RuntimeError(f'HTTP {response.status}')
    body = await response.body()
    if len(body) > 2_000_000:
        raise ValueError('Oversized response')
    return body


async def acquire(conn=None):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        try:
            context = await browser.new_context(viewport={'width': 1280, 'height': 900},
                storage_state={'cookies': [], 'origins': [{'origin': BASE.rstrip('/'),
                    'localStorage': [{'name': f'{MAP_PROVIDER}-mapPosition', 'value': '10,8.425,49.645'}]}]})
            page = await context.new_page()
            async with page.expect_response(lambda r: urlsplit(r.url).path == '/api/pub/mp2', timeout=45000) as listing:
                document = await page.goto(BASE, wait_until='domcontentloaded', timeout=45000)
                if document.status != 200:
                    raise RuntimeError(f'HTTP {document.status}')
            discovery = await checked(await listing.value)
            vessels = map_vessels(discovery)
            if len(vessels) > 80:
                raise ValueError('Unexpected vessel count')
            accepted = 0
            for vessel in vessels:
                mmsi = vessel['mmsi']
                if vessel['age_code'] > 10 or (vessel['age_code'] < 0 and vessel['age_code'] & 127):
                    continue
                try:
                    async with page.expect_response(lambda r, identity=mmsi: urlsplit(r.url).path == '/api/pub/ml/'+identity, timeout=30000) as loc, \
                               page.expect_response(lambda r, identity=mmsi: urlsplit(r.url).path == '/api/pub/click/'+identity, timeout=30000) as detail:
                        document = await page.goto(BASE+'?mmsi='+mmsi, wait_until='domcontentloaded', timeout=30000)
                        if document.status == 404:
                            raise MissingVessel
                        if document.status != 200:
                            raise RuntimeError(f'HTTP {document.status}')
                    location_body = await checked(await loc.value)
                    detail_body = await checked(await detail.value)
                except MissingVessel:
                    LOG.info('Map marker %s has no current public detail', mmsi)
                    continue
                try:
                    sample = position(location_body, detail_body, mmsi)
                except (ValueError, TypeError, KeyError, OverflowError):
                    LOG.warning('Rejected incompatible map observation')
                    continue
                if sample:
                    if conn:
                        # Archive the paired provider bodies; no cookies or browser state.
                        raw = json.dumps({'location_hex': location_body.hex(),
                                          'details': json.loads(detail_body)}, separators=(',', ':')).encode()
                        await persist_sample(conn, sample, raw, SOURCE)
                    accepted += 1
                    LOG.info('Fresh map ship %s at %s', mmsi, sample['timestamp'].isoformat())
            return len(vessels), accepted
        finally:
            await browser.close()


async def run(once=False, probe=False):
    interval = max(300, int(os.getenv('RHINE_MAP_INTERVAL_SECONDS', '300')))
    db = {'host': os.getenv('DB_HOST', 'timescaledb'), 'port': int(os.getenv('DB_PORT', '5432')),
          'dbname': os.getenv('DB_NAME', 'mydatabase'), 'user': os.getenv('DB_USER', 'postgres'),
          'password': os.getenv('DB_PASSWORD', ''), 'connect_timeout': 10,
          'options': os.getenv('DB_OPTIONS', '')}
    while True:
        start = asyncio.get_running_loop().time()
        try:
            if probe:
                counts = await asyncio.wait_for(acquire(), timeout=240)
            else:
                async with await psycopg.AsyncConnection.connect(**db, autocommit=True) as conn:
                    ready = await (await conn.execute("SELECT to_regclass('ais_vessels'),to_regprocedure('write_movement_position(jsonb,boolean)')")).fetchone()
                    if not all(ready):
                        raise RuntimeError('Missing AIS schema')
                    counts = await asyncio.wait_for(acquire(conn), timeout=240)
                    await conn.execute("INSERT INTO collection_attempts(source_id,status) VALUES (%s,'success')", (SOURCE,))
                    Path('/tmp/rhein-map-heartbeat').touch()
            LOG.info('Rhine map cycle: discovered=%s fresh=%s', *counts)
        except (BrowserError, psycopg.Error, OSError, RuntimeError, ValueError, TimeoutError) as exc:
            LOG.warning('Rhine map acquisition failed: %s', type(exc).__name__)
            if not probe:
                try:
                    async with await psycopg.AsyncConnection.connect(**db, autocommit=True) as conn:
                        await conn.execute("INSERT INTO collection_attempts(source_id,status,error) VALUES (%s,'failed',%s)", (SOURCE, type(exc).__name__))
                except (psycopg.Error, OSError):
                    LOG.warning('Cannot record map failure')
            if once:
                raise
        if once:
            return
        await asyncio.sleep(max(0, interval-(asyncio.get_running_loop().time()-start)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--probe', action='store_true', help='No database access or writes')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    asyncio.run(run(args.once, args.probe))
