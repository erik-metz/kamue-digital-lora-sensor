"""Atomically mirror accepted observations into the existing telemetry table."""

from collections import Counter

from psycopg.rows import dict_row


async def ingest(conn, observations):
    counts = Counter(inserted=0, duplicate=0, revised=0, superseded=0)
    if not observations:
        return counts
    async with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        await cur.execute("SET LOCAL statement_timeout = '30s'")
        await cur.execute("SET LOCAL lock_timeout = '10s'")
        # Serialize this collector's transactions, including concurrent initial
        # inserts. The lock is released on commit/rollback, not process lifetime.
        await cur.execute("SELECT pg_advisory_xact_lock(734219, 1)")
        for item in observations:
            sid = item.sensor_id
            await cur.execute(
                """INSERT INTO sensor_metadata
                   (id, friendly_name, latitude, longitude, description)
                   VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                (
                    sid,
                    item.name,
                    item.latitude,
                    item.longitude,
                    (
                        f"Smart City {item.tenant}; {item.entity_id}; {item.source_url}. "
                        "Polled source observations; timestamps reflect measurement time. "
                        "Parking counts may describe a group; temperature may include soil sensors."
                    ),
                ),
            )
            # Repair previously missing source positions, but preserve existing admin values.
            if item.latitude is not None and item.longitude is not None:
                await cur.execute(
                    """UPDATE sensor_metadata SET latitude=%s, longitude=%s
                       WHERE id=%s AND latitude IS NULL AND longitude IS NULL""",
                    (item.latitude, item.longitude, sid),
                )
            # Never reset visibility or overwrite names/coordinates edited by admins.
            await cur.execute(
                """INSERT INTO smartcity_sources
                   (sensor_id, tenant, entity_id, entity_type, source_url, source_name, last_fetched_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (sensor_id) DO UPDATE SET
                     source_url = EXCLUDED.source_url, source_name = EXCLUDED.source_name,
                     last_fetched_at = EXCLUDED.last_fetched_at
                   WHERE smartcity_sources.last_fetched_at <= EXCLUDED.last_fetched_at""",
                (
                    sid,
                    item.tenant,
                    item.entity_id,
                    item.entity_type,
                    item.source_url,
                    item.name,
                    item.fetched_at,
                ),
            )
            await cur.execute(
                """INSERT INTO smartcity_metrics (sensor_id,metric,attribute,unit)
                   VALUES (%s,%s,%s,%s) ON CONFLICT (sensor_id,metric) DO NOTHING""",
                (sid, item.metric, item.attribute, item.unit),
            )
            await cur.execute(
                "SELECT attribute,unit FROM smartcity_metrics WHERE sensor_id=%s AND metric=%s",
                (sid, item.metric),
            )
            mapping = await cur.fetchone()
            if mapping != {"attribute": item.attribute, "unit": item.unit}:
                raise ValueError(
                    f"Metric mapping changed for {sid}/{item.metric}; migration required"
                )
            key = (sid, item.metric, item.observed_at)
            await cur.execute(
                """SELECT * FROM smartcity_observations
                   WHERE sensor_id=%s AND metric=%s AND observed_at=%s FOR UPDATE""",
                key,
            )
            old = await cur.fetchone()
            if old:
                stale_version = old["source_updated_at"] and (
                    item.source_updated_at is None
                    or item.source_updated_at < old["source_updated_at"]
                )
                if item.fetched_at < old["last_fetched_at"] or stale_version:
                    counts["superseded"] += 1
                    continue
                revision = old["revision"]
                if old["payload_hash"] != item.payload_hash:
                    revision += 1
                    await cur.execute(
                        """INSERT INTO smartcity_revisions
                           (sensor_id,metric,observed_at,revision,previous_value,previous_payload_hash,revised_at)
                           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                        (
                            *key,
                            revision,
                            old["value"],
                            old["payload_hash"],
                            item.fetched_at,
                        ),
                    )
                    await cur.execute(
                        """UPDATE sensor_data SET value=%s
                           WHERE sensor_id=%s AND metric=%s AND timestamp=%s AND unit=%s""",
                        (item.value, *key, item.unit),
                    )
                    if cur.rowcount != 1:
                        raise RuntimeError(
                            "Smart City ledger/telemetry mismatch; repair before retrying"
                        )
                    counts["revised"] += 1
                else:
                    counts["duplicate"] += 1
                await cur.execute(
                    """UPDATE smartcity_observations SET value=%s,payload_hash=%s,
                       last_fetched_at=%s,source_updated_at=%s,query_ids=%s,revision=%s
                       WHERE sensor_id=%s AND metric=%s AND observed_at=%s""",
                    (
                        item.value,
                        item.payload_hash,
                        item.fetched_at,
                        item.source_updated_at,
                        sorted(set(old["query_ids"]) | item.query_ids),
                        revision,
                        *key,
                    ),
                )
            else:
                await cur.execute(
                    """INSERT INTO smartcity_observations
                       (sensor_id,metric,observed_at,value,payload_hash,first_fetched_at,
                        last_fetched_at,source_updated_at,query_ids)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        *key,
                        item.value,
                        item.payload_hash,
                        item.fetched_at,
                        item.fetched_at,
                        item.source_updated_at,
                        sorted(item.query_ids),
                    ),
                )
                await cur.execute(
                    """INSERT INTO sensor_data (sensor_id,metric,timestamp,value,unit)
                       VALUES (%s,%s,%s,%s,%s)""",
                    (*key, item.value, item.unit),
                )
                counts["inserted"] += 1
    return counts
