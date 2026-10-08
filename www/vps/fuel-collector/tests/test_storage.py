"""Real PostgreSQL contracts for atomic snapshots and shared fuel telemetry."""
import asyncio
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.rows import dict_row
from storage import persist

DSN = os.getenv("FUEL_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="Set FUEL_TEST_DATABASE_URL")


async def exercise():
    schema = "fuel_test_" + uuid4().hex
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True, row_factory=dict_row) as conn:
        await conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            await conn.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
            await conn.execute((Path(__file__).parents[2]/"api/v1/migrations/20261007_fuel.sql").read_text())
            await conn.execute("""CREATE TABLE sensor_metadata(id text PRIMARY KEY,friendly_name text,
                latitude float8,longitude float8,description text);
                CREATE TABLE sensor_data(sensor_id text REFERENCES sensor_metadata(id),metric text,unit text,
                timestamp timestamptz,value float8 CHECK(value>0),PRIMARY KEY(sensor_id,metric,unit,timestamp));
                CREATE TABLE sensor_latest(sensor_id text,metric text,unit text,timestamp timestamptz,value float8,
                PRIMARY KEY(sensor_id,metric,unit));
                CREATE FUNCTION latest() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
                INSERT INTO sensor_latest VALUES(NEW.sensor_id,NEW.metric,NEW.unit,NEW.timestamp,NEW.value)
                ON CONFLICT(sensor_id,metric,unit) DO UPDATE SET timestamp=EXCLUDED.timestamp,value=EXCLUDED.value;
                RETURN NEW; END $$;
                CREATE TRIGGER keep_latest AFTER INSERT ON sensor_data FOR EACH ROW EXECUTE FUNCTION latest();""")
            station = {"id":str(uuid4()),"name":"Tankstelle","latitude":49.6,"longitude":8.5,
                "street":"Teststraße","houseNumber":"1","postCode":"68623","place":"Lampertheim",
                "e5":1789,"e10":None,"diesel":1659}
            settings = SimpleNamespace(latitude=49.62,longitude=8.46,radius=25)
            now = datetime.now(UTC)
            result = await persist(conn,[station],now,settings)
            assert result["observations"] == 2
            rows = await (await conn.execute("SELECT metric,unit,value FROM sensor_data ORDER BY metric")).fetchall()
            assert [(r["metric"],r["unit"],r["value"]) for r in rows] == [("fuel_diesel","€/l",1.659),("fuel_e5","€/l",1.789)]
            assert (await persist(conn,[station],now,settings))["observations"] == 0
            assert (await persist(conn,[station],now-timedelta(minutes=1),settings))["observations"] == 0
            assert (await persist(conn,[station],now+timedelta(minutes=5),settings))["observations"] == 0
            await conn.execute("UPDATE sensor_metadata SET friendly_name='Adminname'")
            assert (await persist(conn,[station],now+timedelta(minutes=15),settings))["observations"] == 2
            changed = {**station,"e5":1799}
            assert (await persist(conn,[changed],now+timedelta(minutes=20),settings))["observations"] == 1
            assert (await (await conn.execute("SELECT friendly_name FROM sensor_metadata")).fetchone())["friendly_name"] == "Adminname"
            # Force an SQL rejection after the snapshot update: neither snapshot
            # nor measurements from this failed batch may commit.
            with pytest.raises(psycopg.errors.CheckViolation):
                await persist(conn,[{**changed,"e5":0}],now+timedelta(minutes=25),settings)
            current = await (await conn.execute("SELECT fetched_at FROM fuel_snapshot")).fetchone()
            assert current["fetched_at"] == now+timedelta(minutes=20)
            assert (await (await conn.execute("SELECT count(*) AS n FROM sensor_data")).fetchone())["n"] == 5
        finally:
            await conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def test_atomic_history_replay_change_heartbeat_and_admin_metadata():
    asyncio.run(exercise())
