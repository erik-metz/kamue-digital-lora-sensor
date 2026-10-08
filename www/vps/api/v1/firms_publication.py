"""FIRMS API reads only archived publications, with explicit availability states."""

import json
from datetime import UTC, datetime, timedelta

from fastapi import Response


async def firms_data(pool, days):
    async with pool.connection() as conn:
        row = await (await conn.execute("SELECT data,expires_at FROM collected_datasets WHERE dataset='environment/firms/anomalies'")).fetchone()
        attempt = await (await conn.execute("SELECT status FROM collection_attempts WHERE source_id='nasa-firms' ORDER BY id DESC LIMIT 1")).fetchone()
    if not row:
        return {'status': 'not_collected', 'detections': [], 'count': 0, 'product': 'VIIRS_NOAA20_NRT'}
    data = dict(row['data'])
    now = datetime.now(UTC)
    if attempt and attempt['status'] == 'failed':
        data['status'] = 'failed'
    elif row['expires_at'] <= now:
        data['status'] = 'stale'
    cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    data['detections'] = [r for r in data['detections'] if datetime.fromisoformat(r['acquired_at']) >= cutoff]
    data['count'] = len(data['detections'])
    data['display_days'] = days
    # An old successful snapshot can be inspected but must never look like a new empty result.
    data['last_successful_fetch_at'] = row['data'].get('fetched_at') if row['data']['status'] == 'success' else None
    return data


def firms_response(data, download=False):
    headers = {'Cache-Control': 'public, max-age=30' if data['status'] == 'success' else 'no-store'}
    if download:
        headers['Content-Disposition'] = 'attachment; filename="firms-ried-anomalies.json"'
    return Response(json.dumps(data, ensure_ascii=False, allow_nan=False), media_type='application/json', headers=headers)
