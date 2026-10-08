"""Privacy-aware current snapshot reads; no provider requests or stale positions."""

import json
from datetime import UTC, datetime

from fastapi import Response


async def inaturalist_data(pool, limit=100, offset=0, include_duplicates=False):
    async with pool.connection() as conn:
        row = await (await conn.execute("SELECT data,expires_at FROM collected_datasets WHERE dataset='environment/inaturalist/observations'")).fetchone()
        attempt = await (await conn.execute("SELECT status FROM collection_attempts WHERE source_id='inaturalist-ried' ORDER BY id DESC LIMIT 1")).fetchone()
    status = 'not_collected'
    if attempt and attempt['status'] == 'failed':
        status = 'failed'
    if not row or row['expires_at'] <= datetime.now(UTC) or status == 'failed':
        if row and status != 'failed':
            status = 'stale'
        return {'status': status, 'observations': [], 'count': 0, 'has_more': False}
    data = dict(row['data'])
    records = [r for r in data.pop('observations') if include_duplicates or not r['gbif_ids']]
    data.update(observations=records[offset:offset + limit], filtered_count=len(records),
                offset=offset, limit=limit, include_duplicates=include_duplicates,
                has_more=offset + limit < len(records))
    return data


def inaturalist_response(data, download=False):
    headers = {'Cache-Control': 'no-store'}
    if download:
        headers['Content-Disposition'] = 'attachment; filename="inaturalist-ried-observations.json"'
    return Response(json.dumps(data, ensure_ascii=False, allow_nan=False), media_type='application/json', headers=headers)
