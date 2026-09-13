import pg from 'pg';
import QueryStream from 'pg-query-stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { buildArchives, monthRange } from './archive.mjs';
import { uploadThingStorage } from './storage.mjs';

export async function runArchives({ storage, dbConfig, requestedMonth = null, refresh = false, partBytes = 64 * 1024 * 1024 }) {
  const client = new pg.Client(dbConfig);
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(72819401) AS locked');
    if (!lock.rows[0].locked) { console.log('Another archive export is running'); return; }
    // The API migration creates the catalogue. Fail clearly if not deployed yet.
    await client.query('SELECT month FROM data_archives LIMIT 0');
    // Withdraw snapshots when any included station is now hidden or deleted.
    const stale = await client.query(`SELECT month, files FROM data_archives a WHERE EXISTS (
      SELECT 1 FROM unnest(a.station_ids) AS included(station_id) WHERE NOT EXISTS
      (SELECT 1 FROM sensor_metadata s WHERE s.id = included.station_id AND NOT s.is_hidden))`);
    for (const archive of stale.rows) {
      await storage.remove(archive.files.map(file => file.key));
      await client.query('DELETE FROM data_archives WHERE month = $1', [archive.month]);
    }
    const months = requestedMonth ? [requestedMonth] : (await client.query(`
      SELECT to_char(months.month_start, 'YYYY-MM') AS month FROM generate_series(
        date_trunc('month', (SELECT min(timestamp) FROM sensor_data d JOIN sensor_metadata s ON s.id=d.sensor_id WHERE NOT s.is_hidden) AT TIME ZONE 'UTC'),
        date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month', interval '1 month') AS months(month_start)
      WHERE NOT EXISTS (SELECT 1 FROM data_archives a WHERE a.month = to_char(months.month_start, 'YYYY-MM') AND a.is_complete) ORDER BY month`)).rows.map(row => row.month);
    for (const month of months) {
      const { start, end } = monthRange(month);
      if (start > new Date()) throw new Error('Cannot export a future month');
      const previous = (await client.query('SELECT * FROM data_archives WHERE month=$1', [month])).rows[0];
      if (previous?.is_complete && !refresh) continue;
      const directory = await mkdtemp(path.join(tmpdir(), 'ried-archive-'));
      const uploaded = [];
      let published = false;
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        const generatedAt = (await client.query('SELECT transaction_timestamp() AS time')).rows[0].time.toISOString();
        const stations = (await client.query(`SELECT id, friendly_name, latitude, longitude, description FROM sensor_metadata s
          WHERE NOT is_hidden AND EXISTS (SELECT 1 FROM sensor_data d WHERE d.sensor_id=s.id AND d.timestamp >= $1 AND d.timestamp < $2) ORDER BY id`, [start, end])).rows;
        const stream = client.query(new QueryStream(`SELECT to_char(d.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS timestamp,
          d.sensor_id, d.metric, d.value, d.unit FROM sensor_data d
          JOIN sensor_metadata s ON s.id=d.sensor_id WHERE NOT s.is_hidden AND d.timestamp >= $1 AND d.timestamp < $2
          ORDER BY d.timestamp, d.sensor_id, d.metric, d.unit, d.value`, [start, end], { batchSize: 2000 }));
        let archive;
        try { archive = await buildArchives(stream, stations, directory, month, generatedAt, partBytes); }
        finally { stream.destroy(); }
        await client.query('COMMIT');
        for (const file of archive.files) {
          const remote = await storage.upload(file);
          uploaded.push({ filename: file.filename, size_bytes: file.size_bytes, reading_count: file.reading_count, sha256: file.sha256, ...remote });
        }
        // Lock station visibility until publication; downloads also filter current visibility.
        await client.query('BEGIN');
        const ids = stations.map(station => station.id);
        const visible = await client.query('SELECT id FROM sensor_metadata WHERE id = ANY($1::text[]) AND NOT is_hidden FOR SHARE', [ids]);
        if (visible.rowCount !== ids.length) throw new Error('Station visibility changed during export; retry');
        await client.query(`INSERT INTO data_archives (month, generated_at, is_complete, reading_count, size_bytes, station_ids, files)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (month) DO UPDATE SET
          generated_at=EXCLUDED.generated_at, is_complete=EXCLUDED.is_complete, reading_count=EXCLUDED.reading_count,
          size_bytes=EXCLUDED.size_bytes, station_ids=EXCLUDED.station_ids, files=EXCLUDED.files`,
          [month, generatedAt, end <= new Date(generatedAt), archive.reading_count, uploaded.reduce((sum, file) => sum + file.size_bytes, 0), ids, JSON.stringify(uploaded)]);
        await client.query('COMMIT');
        published = true;
        if (previous) await storage.remove(previous.files.map(file => file.key));
        console.log(`Published ${month}: ${archive.reading_count} readings in ${uploaded.length} parts`);
      } catch (error) {
        await client.query('ROLLBACK');
        if (!published) await storage.remove(uploaded.map(file => file.key));
        throw error;
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  } finally { await client.end(); }
}

async function main() {
  const args = process.argv.slice(2);
  const monthIndex = args.indexOf('--month');
  const requestedMonth = monthIndex >= 0 ? args[monthIndex + 1] : null;
  if (monthIndex >= 0) monthRange(requestedMonth || '');
  const refresh = args.includes('--refresh');
  if (refresh && !requestedMonth) throw new Error('--refresh requires --month YYYY-MM');
  const partBytes = Number(process.env.ARCHIVE_PART_MB || 64) * 1024 * 1024;
  if (!Number.isFinite(partBytes) || partBytes < 1024 * 1024 || partBytes > 256 * 1024 * 1024) throw new Error('ARCHIVE_PART_MB must be between 1 and 256');
  const storage = uploadThingStorage(process.env.UPLOADTHING_TOKEN);
  const dbConfig = { host: process.env.DB_HOST || 'timescaledb', port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  do {
    try { await runArchives({ storage, dbConfig, requestedMonth, refresh, partBytes }); }
    catch (error) {
      // Do not log connection strings or raw SDK errors.
      console.error('Archive export failed:', error.code || error.name || 'Error');
      if (!args.includes('--watch')) { process.exitCode = 1; break; }
    }
    if (args.includes('--watch')) await delay(24 * 60 * 60 * 1000);
  } while (args.includes('--watch'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Archive worker configuration failed; check README and environment.'); process.exitCode = 1; });
}
