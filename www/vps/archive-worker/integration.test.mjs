import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { runArchives } from './worker.mjs';

// Uses a dedicated temporary PostgreSQL instance, never the production database.
test('database export, publication, retry, replacement and visibility', { skip: !process.env.ARCHIVE_TEST_SOCKET && !process.env.ARCHIVE_TEST_DATABASE_URL }, async () => {
  const dbConfig = process.env.ARCHIVE_TEST_DATABASE_URL ? { connectionString: process.env.ARCHIVE_TEST_DATABASE_URL } : { host: process.env.ARCHIVE_TEST_SOCKET, port: 55439, database: 'postgres', user: process.env.USER };
  const client = new pg.Client(dbConfig);
  await client.connect();
  const schema = `archive_test_${process.pid}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  dbConfig.options = `-c search_path=${schema}`;
  await client.query(`SET search_path TO ${schema}`);
  try {
    await client.query(`CREATE TABLE sensor_metadata (id text PRIMARY KEY, friendly_name text, latitude float, longitude float, description text, is_hidden bool NOT NULL DEFAULT FALSE);
      CREATE TABLE sensor_data (timestamp timestamptz, sensor_id text, metric text, value float, unit text);
      INSERT INTO sensor_metadata (id, friendly_name, is_hidden) VALUES ('public', 'Public', false), ('hidden', 'Private', true);
      INSERT INTO sensor_data SELECT '2025-01-01T00:00:00Z'::timestamptz + i * interval '1 second', 'public', 'temperature', i, 'C' FROM generate_series(1,6001) i;
      INSERT INTO sensor_data VALUES ('2025-01-01T00:00:00Z', 'hidden', 'temperature', 99, 'C'), ('2025-02-01T00:00:00Z', 'public', 'temperature', 100, 'C');`);
    const sql = await readFile(new URL('../api/v1/schema.sql', import.meta.url), 'utf8');
    await client.query(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS data_archives')));
    let sequence = 0;
    let failAt = Infinity;
    const removed = [];
    const storage = {
      async upload() { if (++sequence === failAt) throw new Error('upload failed'); return { key: `key-${sequence}`, url: `https://test.ufs.sh/f/${sequence}` }; },
      async remove(keys) { removed.push(...keys); },
    };
    const run = (extra = {}) => runArchives({ storage, dbConfig, requestedMonth: '2025-01', partBytes: 4096, ...extra });
    failAt = 2;
    await assert.rejects(run(), /upload failed/);
    assert.equal((await client.query('SELECT * FROM data_archives')).rowCount, 0);
    assert.deepEqual(removed, ['key-1']);
    failAt = Infinity;
    await run();
    let row = (await client.query('SELECT * FROM data_archives')).rows[0];
    assert.equal(Number(row.reading_count), 6001);
    assert.equal(row.is_complete, true);
    assert.deepEqual(row.station_ids, ['public']);
    const previousKeys = row.files.map(file => file.key);
    const beforeSkip = sequence;
    await run();
    assert.equal(sequence, beforeSkip);
    await run({ refresh: true });
    assert.ok(previousKeys.every(key => removed.includes(key)));
    // Automatic discovery: SQL must backfill February and skip existing January.
    await run({ requestedMonth: null });
    row = (await client.query("SELECT * FROM data_archives WHERE month='2025-02'")).rows[0];
    assert.equal(Number(row.reading_count), 1);
    await client.query("UPDATE sensor_metadata SET is_hidden=true WHERE id='public'");
    await run();
    row = (await client.query("SELECT * FROM data_archives WHERE month='2025-01'")).rows[0];
    assert.equal(Number(row.reading_count), 0);
    assert.equal(row.files.length, 0);
  } finally { await client.query(`DROP SCHEMA ${schema} CASCADE`); await client.end(); }
});
