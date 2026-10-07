"""Acquire and archive source responses before parsing, including failed HTTP responses."""

import hashlib
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
            response = await client.get(url, timeout=settings.request_timeout)
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

        digest = hashlib.sha256(response.content).hexdigest()
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
                    response.content,
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
                payload[name] = response.json()
        except ValueError as exc:
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
