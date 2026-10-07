import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
    await client.query(await readFile(new URL('../api/v1/migrations/20260930_measurements.sql', import.meta.url), 'utf8'));
    const sql = await readFile(new URL('../api/v1/schema.sql', import.meta.url), 'utf8');
    // Archive tests use plain PostgreSQL. Load only their actual tables, not
    // every later schema section (which also creates Timescale hypertables).
    for (const table of ['data_archives', 'archive_cleanup']) {
      const statement = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
      assert.ok(statement, `Missing schema definition for ${table}`);
      await client.query(statement[0]);
    }
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
    // Failed cleanup must neither invalidate publication nor lose old keys.
    const remove = storage.remove;
    storage.remove = async () => { throw new Error('temporary cleanup failure'); };
    await run({ refresh: true });
    assert.ok((await client.query('SELECT * FROM archive_cleanup')).rowCount > 0);
    const afterRefresh = sequence;
    storage.remove = remove;
    await run();
    assert.equal(sequence, afterRefresh);
    assert.equal((await client.query('SELECT * FROM archive_cleanup')).rowCount, 0);
    // Existing format-1 catalogues are automatically upgraded, even if marked complete.
    await client.query("UPDATE data_archives SET format_version=1 WHERE month='2025-01'");
    await run();
    assert.equal((await client.query('SELECT format_version FROM data_archives')).rows[0].format_version, 2);
    // Automatic discovery: SQL must backfill February and skip existing January.
    await run({ requestedMonth: null });
    row = (await client.query("SELECT * FROM data_archives WHERE month='2025-02'")).rows[0];
    assert.equal(Number(row.reading_count), 1);
    // A conflicting legacy duplicate stops the period before any publication.
    await client.query("INSERT INTO sensor_data VALUES ('2025-02-01T00:00:00Z','public','temperature',999,'C')");
    await assert.rejects(run({ requestedMonth: '2025-02', refresh: true }), /Conflicting legacy/);
    assert.equal(Number((await client.query("SELECT reading_count FROM data_archives WHERE month='2025-02'")).rows[0].reading_count), 1);
    await client.query("DELETE FROM sensor_data WHERE value=999 AND timestamp='2025-02-01T00:00:00Z'");
    await client.query("UPDATE sensor_metadata SET is_hidden=true WHERE id='public'");
    await run();
    row = (await client.query("SELECT * FROM data_archives WHERE month='2025-01'")).rows[0];
    assert.equal(Number(row.reading_count), 0);
    assert.equal(row.files.length, 0);
  } finally { await client.query(`DROP SCHEMA ${schema} CASCADE`); await client.end(); }
});

test('core export reads canonical values and still honours station visibility', { skip: !process.env.ARCHIVE_TEST_SOCKET && !process.env.ARCHIVE_TEST_DATABASE_URL }, async () => {
  const dbConfig = process.env.ARCHIVE_TEST_DATABASE_URL ? { connectionString: process.env.ARCHIVE_TEST_DATABASE_URL } : { host: process.env.ARCHIVE_TEST_SOCKET, port: 55439, database: 'postgres', user: process.env.USER };
  const client = new pg.Client(dbConfig);
  await client.connect();
  const schema = `archive_core_test_${process.pid}`;
  const previousMode = process.env.MEASUREMENT_READ_MODE;
  await client.query(`CREATE SCHEMA ${schema}`);
  dbConfig.options = `-c search_path=${schema},public`;
  await client.query(`SET search_path TO ${schema},public`);
  try {
    await client.query(`CREATE TABLE sensor_metadata(id text PRIMARY KEY,is_hidden boolean NOT NULL DEFAULT false, friendly_name text DEFAULT 'Station', latitude float, longitude float, description text);
      INSERT INTO sensor_metadata(id,is_hidden) VALUES ('public',false);
      CREATE TABLE sensor_data(timestamp timestamptz,sensor_id text,metric text,value float,unit text);
      INSERT INTO sensor_data VALUES ('2025-01-01T00:00:00Z','public','temperature',9999,'C');
      CREATE TABLE movement_latest(entity_id text,basis text,timestamp timestamptz,valid_until timestamptz,data jsonb);`);
    for (const migration of ['20260930_measurements.sql', '20261001_read_models.sql']) {
      await client.query(await readFile(new URL(`../api/v1/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const sql = await readFile(new URL('../api/v1/schema.sql', import.meta.url), 'utf8');
    for (const table of ['data_archives', 'archive_cleanup']) {
      const statement = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
      assert.ok(statement);
      await client.query(statement[0]);
    }
    await client.query(`INSERT INTO entities(id,name,entity_type) VALUES('sensor:public','Canonical station','sensor');
      SELECT write_measurement('sensor:public','temperature','C','legacy-sensor:public','unknown','{}',
        '2025-01-01T00:00:00Z',20.125,'2025-01-01T00:01:00Z','{}', 'valid', NULL, NULL, 'unknown');`);
    let csv = '';
    const storage = {
      async upload(file) {
        csv = await readFile(path.join(path.dirname(file.path), 'part-1.csv'), 'utf8');
        return { key: 'canonical-key', url: 'https://test.ufs.sh/f/canonical' };
      },
      async remove() {},
    };
    process.env.MEASUREMENT_READ_MODE = 'core';
    await runArchives({ storage, dbConfig, requestedMonth: '2025-01' });
    assert.match(csv, /,20\.125,/);
    assert.doesNotMatch(csv, /9999/);
    assert.equal(Number((await client.query('SELECT reading_count FROM data_archives')).rows[0].reading_count), 1);
    await client.query(`INSERT INTO entities(id,name,entity_type) VALUES('model:test','Model','model');
      SELECT write_measurement('model:test','temperature','C','canonical-test','model','{}',
        '2025-01-02T00:00:00.123456Z',-1.234567890123456789,'2025-01-02','{}');`);
    await runArchives({ storage, dbConfig, requestedMonth: '2025-01', refresh: true });
    assert.match(csv, /-1\.234567890123456789/);
    assert.match(csv, /00:00:00\.123456Z/);
    assert.equal(Number((await client.query('SELECT reading_count FROM data_archives')).rows[0].reading_count), 2);
    await client.query("UPDATE entities SET is_hidden=true WHERE id='model:test'");
    // A now-hidden canonical-only entity must invalidate the completed archive.
    await runArchives({ storage, dbConfig, requestedMonth: '2025-01' });
    assert.equal(Number((await client.query('SELECT reading_count FROM data_archives')).rows[0].reading_count), 1);
    await client.query("UPDATE sensor_metadata SET is_hidden=true; UPDATE entities SET is_hidden=true WHERE id='sensor:public'");
    await runArchives({ storage, dbConfig, requestedMonth: '2025-01' });
    assert.equal(Number((await client.query('SELECT reading_count FROM data_archives')).rows[0].reading_count), 0);
  } finally {
    if (previousMode === undefined) delete process.env.MEASUREMENT_READ_MODE;
    else process.env.MEASUREMENT_READ_MODE = previousMode;
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
