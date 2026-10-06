"""Hourly Space-Track GP acquisition and ten-second historical positions."""
import argparse
import asyncio
import json
import logging
import os
import random
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import psycopg
from psycopg.types.json import Jsonb
from satellite_orbits import element, position, utc

LOG = logging.getLogger("satellite-collector")
SOURCE = "space-track"
METRICS = {"latitude": "deg", "longitude": "deg", "altitude_km": "km", "speed_km_s": "km/s"}

def identifiers(value):
    if not re.fullmatch(r"[0-9]+(?:,[0-9]+)*", value):
        raise ValueError("SATELLITE_NORAD_IDS must be comma-separated numeric identifiers")
    ids = sorted({int(part) for part in value.split(",")})
    if len(ids) > 500 or any(not 1 <= n <= 999999999 for n in ids):
        raise ValueError("Select between 1 and 500 satellites")
    return ids

def secret(name):
    filename = os.getenv(name + "_FILE")
    return Path(filename).read_text().strip() if filename else os.getenv(name, "").strip()

def connect():
    return psycopg.connect(host=os.getenv("DB_HOST", "timescaledb"), port=os.getenv("DB_PORT", "5432"),
                          dbname=os.environ["DB_NAME"], user=os.environ["DB_USER"],
                          password=os.environ["DB_PASSWORD"], autocommit=True)

def ingest(conn, records, ids, now=None):
    now = now or datetime.now(UTC)
    accepted = 0
    if not isinstance(records, list) or len(records) > 100000:
        raise ValueError("Invalid OMM collection")
    with conn.transaction():
        for raw in records:
            norad, epoch, _, version = element(raw)
            if norad not in ids:
                continue
            published = utc(raw.get("CREATION_DATE", raw["EPOCH"]))
            if epoch > now + timedelta(days=1) or published > now + timedelta(minutes=5):
                raise ValueError("Future element publication")
            key = f"satellite:{norad}"
            conn.execute("""INSERT INTO entities(id,name,entity_type,metadata)
                VALUES (%s,%s,'satellite',%s) ON CONFLICT(id) DO UPDATE SET
                name=EXCLUDED.name, metadata=entities.metadata||EXCLUDED.metadata, updated_at=NOW()""",
                (key, str(raw.get("OBJECT_NAME") or norad)[:120], Jsonb({"norad_id": norad,
                 "international_designator": raw.get("OBJECT_ID"), "source": SOURCE})))
            # Publication time plus immutable source/version distinguishes same-epoch element sets.
            conn.execute("SELECT write_measurement(%s,'orbital_elements','rev/day',%s,'reported','{}',%s,%s::numeric,%s,%s)",
                         (key, SOURCE, published, float(raw["MEAN_MOTION"]), now,
                          Jsonb({"omm": raw, "element_version": version, "element_epoch": epoch.isoformat()})))
            accepted += 1
    return accepted

def store_positions(conn, now):
    with conn.transaction():
        rows = conn.execute("""SELECT d.entity_id,r.provenance FROM measurement_definitions d
            JOIN latest_readings r ON r.measurement_id=d.id
            WHERE d.metric='orbital_elements' AND d.source_id='space-track'""").fetchall()
        for key, provenance in rows:
            sample = position(provenance["omm"], now)
            if sample is None:
                continue
            for metric, unit in METRICS.items():
                conn.execute("SELECT write_measurement(%s,%s,%s,%s,'model','{}',%s,%s::numeric,%s,%s)",
                             (key, metric, unit, SOURCE, now, sample[metric], now,
                              Jsonb({"element_version": sample["element_version"],
                                     "element_epoch": sample["element_epoch"], "propagator": "sgp4-2.25"})))

async def refresh(conn, ids, identity, password):
    now = datetime.now(UTC)
    # Persistent cooldown survives restarts and failed requests. One collector owns acquisition.
    with conn.transaction():
        row = conn.execute("SELECT metadata FROM entities WHERE id='satellite:feed' FOR UPDATE").fetchone()
        metadata = row[0] if row else {}
        if metadata.get("next_attempt") and utc(metadata["next_attempt"]) > now:
            return
        conn.execute("""INSERT INTO entities(id,name,entity_type,metadata)
            VALUES ('satellite:feed','Space-Track collector','data_source',%s)
            ON CONFLICT(id) DO UPDATE SET metadata=entities.metadata||EXCLUDED.metadata""",
            (Jsonb({"next_attempt": (now + timedelta(seconds=3600+random.randint(1, 120))).isoformat()}),))
    async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
        login = await client.post("https://www.space-track.org/ajaxauth/login",
                                  data={"identity": identity, "password": password})
        login.raise_for_status()
        query = "https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/" + ",".join(map(str, ids)) + "/DECAY_DATE/null-val/EPOCH/%3Enow-10/format/json"
        response = await client.get(query)
        response.raise_for_status()
        count = ingest(conn, response.json(), ids, now)
        conn.execute("UPDATE entities SET metadata=metadata||%s,updated_at=NOW() WHERE id='satellite:feed'",
                     (Jsonb({"last_success": now.isoformat(), "count": count}),))
        LOG.info("Imported %s orbital element sets", count)

async def run(args):
    ids = identifiers(os.getenv("SATELLITE_NORAD_IDS", "25544"))
    identity, password = secret("SPACE_TRACK_IDENTITY"), secret("SPACE_TRACK_PASSWORD")
    if not args.history_file and (not identity or not password):
        raise ValueError("Configure Space-Track server secrets before enabling the collector")
    with connect() as conn:
        locked = conn.execute("SELECT pg_try_advisory_lock(20261007,1)").fetchone()[0]
        if not locked:
            raise RuntimeError("A satellite collector is already running")
        if args.history_file:
            records = json.loads(Path(args.history_file).read_text())
            # Historical imports are ordered; latest_readings cannot regress.
            records.sort(key=lambda r: utc(r.get("CREATION_DATE", r["EPOCH"])))
            LOG.info("Imported %s historical elements", ingest(conn, records, ids))
            return
        while True:
            try:
                await refresh(conn, ids, identity, password)
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                LOG.warning("Space-Track import failed; retaining previous elements, retry after cooldown")
            now = datetime.now(UTC).replace(microsecond=0)
            store_positions(conn, now)
            await asyncio.sleep(10)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--history-file", help="Import locally downloaded Space-Track GP_HISTORY OMM JSON")
    asyncio.run(run(parser.parse_args()))
