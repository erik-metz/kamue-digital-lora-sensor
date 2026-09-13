import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildArchives, csvCell, monthRange } from './archive.mjs';

test('month boundaries include leap February and December rollover', () => {
  assert.equal(monthRange('2024-02').end.toISOString(), '2024-03-01T00:00:00.000Z');
  assert.equal(monthRange('2026-12').end.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.throws(() => monthRange('2026-13'));
});

test('CSV preserves negatives and escapes spreadsheet formulas and quotes', () => {
  assert.equal(csvCell(-2.5), '-2.5');
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('a,"b\nc'), '"a,""b\nc"');
});

test('partitioned export preserves every row and supplies matching checksums', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archive-test-'));
  try {
    async function* rows() {
      for (let i = 0; i < 6001; i++) yield { timestamp: '2026-09-01T00:00:00.123456Z', sensor_id: 'station', metric: 'temperature', value: i, unit: 'C' };
    }
    const result = await buildArchives(rows(), [{ id: 'station' }], directory, '2026-09', '2026-10-01T00:00:00Z', 4096);
    assert.equal(result.reading_count, 6001);
    assert.ok(result.files.length > 1);
    assert.equal(result.files.reduce((sum, file) => sum + file.reading_count, 0), 6001);
    let count = 0;
    for (const [index, file] of result.files.entries()) {
      const data = await readFile(file.path);
      assert.equal(data.length, file.size_bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
      const csv = await readFile(path.join(directory, `part-${index + 1}.csv`), 'utf8');
      count += csv.split('\r\n').length - 2;
      assert.ok(csv.includes('2026-09-01T00:00:00.123456Z'));
      assert.ok(data.includes(Buffer.from('README.txt')));
      assert.ok(data.includes(Buffer.from('stations.json')));
      assert.ok(data.includes(Buffer.from('manifest.json')));
    }
    assert.equal(count, 6001);
    const empty = await buildArchives([], [], directory, '2026-09', '2026-10-01T00:00:00Z');
    assert.deepEqual(empty, { files: [], reading_count: 0 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('source failure rejects the export instead of publishing a partial month', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archive-test-'));
  try {
    async function* rows() {
      yield { timestamp: new Date(), sensor_id: 'a', metric: 'x', value: 1, unit: 'C' };
      throw new Error('database disconnected');
    }
    await assert.rejects(buildArchives(rows(), [], directory, '2026-09', '2026-10-01T00:00:00Z'), /disconnected/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
