"""Acknowledged writes with transactionally stored replay receipts."""

import hashlib
import json
from datetime import datetime

import httpx
import psycopg


def payload_hash(readings):
    return hashlib.sha256(
        json.dumps(readings, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class Writer:
    def __init__(self, settings):
        self.settings = settings
        self.conn = None
        self.client = httpx.AsyncClient(timeout=30)
        self.registered = False

    async def close(self):
        if self.conn:
            await self.conn.close()
        await self.client.aclose()

    async def connection(self):
        if self.conn is None or self.conn.closed:
            self.conn = await psycopg.AsyncConnection.connect(
                **self.settings.db, autocommit=True
            )
        return self.conn

    async def persist(self, batch):
        config = self.settings
        if config.INGEST_MODE == "api":
            if not self.registered:
                if not config.ADMIN_API_KEY or config.ADMIN_API_KEY == config.API_KEY:
                    raise ValueError("API mode requires a distinct admin key")
                response = await self.client.post(
                    f"{config.API_URL}/admin/sensors",
                    headers={"Authorization": f"Bearer {config.ADMIN_API_KEY}"},
                    json={
                        "sensor_id": config.SENSOR_ID,
                        "friendly_name": config.SENSOR_NAME,
                        "latitude": config.LATITUDE,
                        "longitude": config.LONGITUDE,
                        "description": config.SENSOR_DESCRIPTION,
                        "preserve_existing": True,
                    },
                )
                if response.status_code != 409:
                    response.raise_for_status()
                self.registered = (
                    config.LATITUDE is not None and config.LONGITUDE is not None
                )
            response = await self.client.post(
                f"{config.API_URL}/telemetry/batch",
                headers={"Authorization": f"Bearer {config.API_KEY}"},
                json={"readings": batch["readings"], "batch_id": batch["batch_id"]},
            )
            response.raise_for_status()
            if response.json().get("batch_id") != batch["batch_id"]:
                raise RuntimeError(
                    "API must support replay receipts before running Shake"
                )
            return response.json()
        try:
            conn = await self.connection()
            async with conn.transaction(), conn.cursor() as cur:
                await cur.execute("SET LOCAL statement_timeout = '30s'")
                await cur.execute("SET LOCAL lock_timeout = '10s'")
                digest = payload_hash(batch["readings"])
                await cur.execute(
                    """INSERT INTO telemetry_ingest_batches(batch_id, payload_hash)
                                     VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING batch_id""",
                    (batch["batch_id"], digest),
                )
                if await cur.fetchone() is None:
                    await cur.execute(
                        "SELECT payload_hash FROM telemetry_ingest_batches WHERE batch_id=%s",
                        (batch["batch_id"],),
                    )
                    if (await cur.fetchone())[0] != digest:
                        raise ValueError(
                            "Batch identity reused with different readings"
                        )
                    return {"inserted": 0, "duplicate": len(batch["readings"])}
                await cur.execute(
                    """INSERT INTO sensor_metadata(id,friendly_name,latitude,longitude,description)
                    VALUES (%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET
                    latitude=COALESCE(sensor_metadata.latitude, EXCLUDED.latitude),
                    longitude=COALESCE(sensor_metadata.longitude, EXCLUDED.longitude)""",
                    (
                        config.SENSOR_ID,
                        config.SENSOR_NAME,
                        config.LATITUDE,
                        config.LONGITUDE,
                        config.SENSOR_DESCRIPTION,
                    ),
                )
                await cur.executemany(
                    """INSERT INTO sensor_data(timestamp,sensor_id,metric,value,unit)
                    VALUES (%s,%s,%s,%s,%s)""",
                    [
                        (
                            datetime.fromisoformat(r["timestamp"]),
                            r["sensor_id"],
                            r["metric"],
                            r["value"],
                            r["unit"],
                        )
                        for r in batch["readings"]
                    ],
                )
            return {"inserted": len(batch["readings"]), "duplicate": 0}
        except psycopg.Error:
            if self.conn:
                await self.conn.close()
                self.conn = None
            raise
