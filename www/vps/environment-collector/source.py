"""Acquire and archive source responses before parsing, including failed HTTP responses."""

import hashlib


async def fetch(client, settings, conn=None):
    payload = {}
    for name, url in [
        ("pegel", settings.pegelonline_url),
        ("weather", settings.weather_url),
    ]:
        try:
            response = await client.get(url, timeout=settings.request_timeout)
        except Exception as exc:
            if conn:
                await conn.execute(
                    "INSERT INTO collection_attempts(source_id,status,error) VALUES (%s,'failed',%s)",
                    ("environment-" + name, type(exc).__name__),
                )
                await conn.commit()
            raise
        digest = hashlib.sha256(response.content).hexdigest()
        if conn:
            await conn.execute(
                """INSERT INTO collected_payloads(sha256,body,content_type) VALUES (%s,%s,%s)
                ON CONFLICT DO NOTHING""",
                (
                    digest,
                    response.content,
                    response.headers.get("content-type", "application/json"),
                ),
            )
            await conn.execute(
                """INSERT INTO collection_attempts(source_id,http_status,payload_sha256,status)
                VALUES (%s,%s,%s,%s)""",
                (
                    "environment-" + name,
                    response.status_code,
                    digest,
                    "received" if response.is_success else "failed",
                ),
            )
            await conn.commit()
        response.raise_for_status()
        payload[name] = response.json()
        payload[name + "_sha256"] = digest
    return payload
