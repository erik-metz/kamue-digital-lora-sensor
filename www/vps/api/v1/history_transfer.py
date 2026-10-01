"""Resume production history transfer in bounded windows, without deleting data."""

import json
import os
import shutil
import time
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg import sql


def transfer(conn, family, cutoff):
    table = {'sensors':'sensor_data', 'movements':'movement_positions'}[family]
    saved = conn.execute('SELECT state FROM measurement_migration_state WHERE name=%s',
                         ('window:'+family,)).fetchone()
    cursor = datetime.fromisoformat(saved[0]['through']) if saved else datetime.min.replace(tzinfo=UTC)
    chunks = conn.execute("""SELECT chunk_schema,chunk_name,range_start,range_end
        FROM timescaledb_information.chunks WHERE hypertable_name=%s
        ORDER BY range_start""", (table,)).fetchall()
    processed = 0
    for schema, name, start, end in chunks:
        if end <= cursor or start >= cutoff:
            continue
        while True:
            # The API container writable layer shares the VPS root filesystem.
            if shutil.disk_usage('/').free < 1536*1024**2:
                raise RuntimeError('History transfer paused at the 1.5 GiB disk reserve')
            row = conn.execute(sql.SQL('SELECT min(timestamp) FROM {} WHERE timestamp >= %s AND timestamp < %s')
                               .format(sql.Identifier(schema,name)), (max(start,cursor),min(end,cutoff))).fetchone()
            if row[0] is None:
                break
            through = min(row[0]+timedelta(minutes=30),end,cutoff)
            for attempt in range(5):
                try:
                    count = conn.execute('SELECT backfill_measurement_window(%s,%s,%s)',
                                         (family,row[0],through)).fetchone()[0]
                    break
                except (psycopg.errors.DeadlockDetected,psycopg.errors.LockNotAvailable):
                    if attempt == 4:
                        raise
                    time.sleep(attempt+1)
            processed += count
            cursor = through
            print(json.dumps({'family':family,'through':through.isoformat(),
                              'window_samples':count,'processed_this_run':processed}),flush=True)
        # Completed old chunks can be compressed without removing any readings.
        for (target,) in conn.execute("""SELECT format('%%I.%%I',chunk_schema,chunk_name)
            FROM timescaledb_information.chunks WHERE hypertable_name='readings'
                AND range_end <= %s AND NOT is_compressed ORDER BY range_start""", (min(end,cutoff),)).fetchall():
            conn.execute('SELECT compress_chunk(%s::regclass,if_not_compressed=>TRUE)',(target,))
            print('Compressed canonical history '+target,flush=True)
    return processed


if __name__ == '__main__':
    with psycopg.connect(host=os.environ['DB_HOST'],port=os.getenv('DB_PORT','5432'),
                        dbname=os.environ['DB_NAME'],user=os.environ['DB_USER'],
                        password=os.environ['DB_PASSWORD'],autocommit=True,
                        application_name='measurement_history_transfer') as connection:
        connection.execute("SET statement_timeout='5min'")
        connection.execute("SET lock_timeout='10s'")
        horizon = datetime.now(UTC)
        for name in ('sensors','movements'):
            transfer(connection,name,horizon)
        print('Historical transfer reached '+horizon.isoformat(),flush=True)
