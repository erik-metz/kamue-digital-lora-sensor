"""Acquire and archive source responses before parsing, including failed HTTP responses."""

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit, urlunsplit


async def fetch(client, settings, conn=None):
    payload = {}
    endpoints = [
        ('pegel', settings.pegelonline_url, True, True),
        ('weather', settings.weather_url, True, True),
        ('radolan', getattr(settings, 'radolan_url', None), False, getattr(settings, 'enable_radolan', False)),
        ('mosmix', getattr(settings, 'mosmix_url', None), False, getattr(settings, 'enable_mosmix', False)),
        ('blitzortung', getattr(settings, 'blitzortung_url', None), False, getattr(settings, 'enable_blitzortung', False)),
    ]
    endpoints.append(('xweather', 'https://data.api.xweather.com/lightning/closest', False, getattr(settings, 'enable_xweather', False)))
    if conn:
        for name, url, _, enabled in endpoints:
            parts = urlsplit(url or '')
            public_url = urlunsplit((parts.scheme, parts.hostname or '', parts.path, '', ''))
            await conn.execute(
                """INSERT INTO collection_sources(id,source_url,adapter,enabled,interval_seconds)
                VALUES (%s,%s,'environment',%s,%s) ON CONFLICT(id) DO UPDATE SET
                source_url=EXCLUDED.source_url,enabled=EXCLUDED.enabled,
                interval_seconds=EXCLUDED.interval_seconds,updated_at=NOW()""",
                ('environment-' + name, public_url, bool(enabled and url), settings.poll_seconds),
            )
        await conn.commit()

    for name, url, required, enabled in endpoints:
        if not enabled or not url:
            continue
        try:
            params = None
            if name == 'xweather':
                logging.getLogger('httpx').setLevel(logging.WARNING)
                if not settings.xweather_client_id or not settings.xweather_client_secret:
                    raise ValueError('Missing Xweather credentials')
                window_end = datetime.now(UTC).replace(microsecond=0)
                window_start = window_end - timedelta(minutes=5)
                params = {'client_id': settings.xweather_client_id, 'client_secret': settings.xweather_client_secret,
                          'p': f'{settings.ried_lat},{settings.ried_lon}', 'radius': f'{settings.blitzortung_radius_km}km',
                          'from': int(window_start.timestamp()), 'to': int(window_end.timestamp()), 'limit': 1000}
            response = await client.get(url, params=params, timeout=settings.request_timeout)
        except Exception as exc:
            if conn:
                await conn.execute(
                    "INSERT INTO collection_attempts(source_id,status,error,error_stage) VALUES (%s,'failed',%s,'acquisition')",
                    ("environment-" + name, type(exc).__name__),
                )
                await conn.commit()
            if required:
                await interrupt_receipts(conn, payload)
                raise
            continue

        body = response.content
        if name == 'xweather':
            for secret in (settings.xweather_client_id, settings.xweather_client_secret):
                body = body.replace(secret.encode(), b'[redacted]')
        digest = hashlib.sha256(body).hexdigest()
        content_type = response.headers.get(
            "content-type",
            "application/octet-stream" if name in ("radolan", "mosmix") else "application/json",
        )
        if conn:
            await conn.execute(
                """INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,%s)
                ON CONFLICT DO NOTHING""",
                (
                    digest,
                    body,
                    content_type,
                ),
            )
            receipt = await conn.execute(
                """INSERT INTO collection_attempts(source_id,http_status,payload_sha256,status,error,error_stage)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (
                    "environment-" + name,
                    response.status_code,
                    digest,
                    "received" if response.is_success else "failed",
                    None if response.is_success else f"HTTP {response.status_code}",
                    None if response.is_success else "acquisition",
                ),
            )
            payload[name + "_attempt_id"] = (await receipt.fetchone())[0]
            await conn.commit()

        if not response.is_success:
            if required:
                await interrupt_receipts(conn, payload)
                response.raise_for_status()
            continue

        try:
            if name in ("radolan", "mosmix"):
                payload[name] = response.content
            elif name == "blitzortung":
                payload[name] = response.text
            else:
                payload[name] = json.loads(body)
                if name == 'xweather':
                    from xweather import validate_response
                    validate_response(payload[name])
                    payload['xweather_window_end'] = window_end.isoformat()
        except ValueError as exc:
            payload.pop(name, None)
            if conn:
                await conn.execute(
                    """UPDATE collection_attempts SET status='failed',error=%s,error_stage='processing'
                    WHERE id=%s""", (type(exc).__name__, payload[name + '_attempt_id']),
                )
                await conn.commit()
            if required:
                await interrupt_receipts(conn, payload)
                raise
            continue
        payload[name + "_sha256"] = digest
    return payload


async def interrupt_receipts(conn, payload):
    """A required acquisition failure prevents processing previously downloaded siblings."""
    if conn:
        ids = [value for key, value in payload.items() if key.endswith('_attempt_id')]
        if ids:
            await conn.execute(
                """UPDATE collection_attempts SET status='failed',error_stage='acquisition',
                error='Cycle interrupted by required source failure'
                WHERE id=ANY(%s) AND status='received'""", (ids,),
            )
            await conn.commit()
