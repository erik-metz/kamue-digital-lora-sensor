"""Replace only validated, complete regional snapshots transactionally."""
from psycopg.types.json import Jsonb


async def persist(conn, stations, now, settings):
    async with conn.transaction():
        await conn.execute("SET LOCAL statement_timeout = '10s'")
        await conn.execute("SET LOCAL lock_timeout = '5s'")
        await conn.execute("""INSERT INTO fuel_snapshot (id, fetched_at, data)
            VALUES (1, %s, %s) ON CONFLICT (id) DO UPDATE
            SET fetched_at=EXCLUDED.fetched_at, data=EXCLUDED.data
            WHERE fuel_snapshot.fetched_at < EXCLUDED.fetched_at""", (now, Jsonb({
                "stations": stations, "center": [settings.latitude, settings.longitude],
                "radius_km": settings.radius,
            })))
    return {"stations": len(stations)}
