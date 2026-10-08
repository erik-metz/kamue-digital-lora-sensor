"""Current snapshot and shared telemetry history commit atomically."""
from decimal import Decimal

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


async def persist(conn, stations, now, settings):
    inserted = 0
    async with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        await cur.execute("SET LOCAL statement_timeout = '10s'")
        await cur.execute("SET LOCAL lock_timeout = '5s'")
        # Serialize the snapshot and measurements; reject replayed/older batches.
        await cur.execute("SELECT pg_advisory_xact_lock(734220, 7)")
        await cur.execute("""INSERT INTO fuel_snapshot (id, fetched_at, data)
            VALUES (1, %s, %s) ON CONFLICT (id) DO UPDATE
            SET fetched_at=EXCLUDED.fetched_at, data=EXCLUDED.data
            WHERE fuel_snapshot.fetched_at < EXCLUDED.fetched_at RETURNING id""", (now, Jsonb({
                "stations": stations, "center": [settings.latitude, settings.longitude],
                "radius_km": settings.radius,
            })))
        if await cur.fetchone() is None:
            return {"stations": 0, "observations": 0}
        ids = ["fuel-" + s["id"] for s in stations]
        await cur.execute("""SELECT sensor_id,metric,value,timestamp FROM sensor_latest
            WHERE sensor_id=ANY(%s) AND metric IN ('fuel_e5','fuel_e10','fuel_diesel')
                AND unit='€/l'""", (ids,))
        previous = {(r["sensor_id"], r["metric"]): r for r in await cur.fetchall()}
        for station in stations:
            sid = "fuel-" + station["id"]
            description = f"Tankerkönig / MTS-K · CC BY 4.0 · {station['street']} {station['houseNumber']}, {station['postCode']} {station['place']} · Preiszeitpunkt = Abrufzeit"
            # Existing metadata/admin edits survive polling. When configured,
            # shadow triggers also project writes into the measurement core.
            await cur.execute("""INSERT INTO sensor_metadata
                (id,friendly_name,latitude,longitude,description) VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO NOTHING""", (sid,station["name"],station["latitude"],station["longitude"],description))
            for fuel in ("e5", "e10", "diesel"):
                value = station[fuel]
                if value is None:
                    continue  # No invented zero price for unavailable fuel.
                metric = "fuel_" + fuel
                old = previous.get((sid,metric))
                if old and (now <= old["timestamp"] or (
                    Decimal(str(old["value"])) == Decimal(value)/1000
                    and (now-old["timestamp"]).total_seconds() < 900
                )):
                    continue
                await cur.execute("""INSERT INTO sensor_data(sensor_id,metric,unit,timestamp,value)
                    VALUES (%s,%s,'€/l',%s,%s) ON CONFLICT DO NOTHING""", (sid,metric,now,Decimal(value)/1000))
                inserted += 1
    return {"stations": len(stations), "observations": inserted}
