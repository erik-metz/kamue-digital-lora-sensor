"""Acquire and archive source responses before parsing, including failed HTTP responses."""

import hashlib


async def fetch(client, settings, conn=None):
    payload = {}
    endpoints: list[tuple[str, str, bool]] = [
        ("pegel", settings.pegelonline_url, True),
        ("weather", settings.weather_url, True),
    ]
    if getattr(settings, "enable_radolan", False) and getattr(settings, "radolan_url", None):
        endpoints.append(("radolan", settings.radolan_url, False))
    if getattr(settings, "enable_mosmix", False) and getattr(settings, "mosmix_url", None):
        endpoints.append(("mosmix", settings.mosmix_url, False))

    for name, url, required in endpoints:
        try:
            response = await client.get(url, timeout=settings.request_timeout)
        except Exception as exc:
            if conn:
                await conn.execute(
                    "INSERT INTO collection_attempts(source_id,status,error) VALUES (%s,'failed',%s)",
                    ("environment-" + name, type(exc).__name__),
                )
                await conn.commit()
            if required:
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
                """INSERT INTO collection_attempts(source_id,http_status,payload_sha256,status)
                VALUES (%s,%s,%s,%s) RETURNING id""",
                (
                    "environment-" + name,
                    response.status_code,
                    digest,
                    "received" if response.is_success else "failed",
                ),
            )
            payload[name + "_attempt_id"] = (await receipt.fetchone())[0]
            await conn.commit()

        if not response.is_success:
            if required:
                response.raise_for_status()
            continue

        if name in ("radolan", "mosmix"):
            payload[name] = response.content
        else:
            payload[name] = response.json()
        payload[name + "_sha256"] = digest
    return payload
