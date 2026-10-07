import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildArchives, tableLine, csvCell, monthRange, periodRange } from './archive.mjs';

test('month, quarter, and year boundaries calculate correct UTC intervals', () => {
  assert.equal(monthRange('2024-02').end.toISOString(), '2024-03-01T00:00:00.000Z');
  assert.equal(monthRange('2026-12').end.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.throws(() => monthRange('2026-13'));

  // Quarters
  const q1 = periodRange('2026-Q1');
  assert.equal(q1.start.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(q1.end.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(q1.type, 'quarter');

  const q4 = periodRange('2026-Q4');
  assert.equal(q4.start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(q4.end.toISOString(), '2027-01-01T00:00:00.000Z');

  // Year
  const yr = periodRange('2026');
  assert.equal(yr.start.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(yr.end.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(yr.type, 'year');
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
      for (let i = 0; i < 6001; i++) yield { entity: { id: 'station', name: '=Station', entity_type: 'sensor', metadata: {} }, definition: { id: '1', entity_id: 'station', metric: 'temperature', unit: 'C', source_id: 'test', basis: 'observed', dimensions: {}, semantics: 'instantaneous' }, reading: { measurement_id: '1', observed_at: '2026-09-01T00:00:00.123456Z', value: String(i), quality: 'valid', provenance: {}, revision: 0 } };
    }
    const result = await buildArchives(rows(), directory, '2026-09', '2026-10-01T00:00:00Z', 4096);
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
      assert.ok(data.includes(Buffer.from('entities.csv')));
      assert.ok(data.includes(Buffer.from('manifest.json')));
    }
    assert.equal(count, 6001);
    execFileSync('python3', ['-c', `
import csv,io,json,zipfile,sys
for filename in sys.argv[1:]:
    with zipfile.ZipFile(filename) as z:
        assert set(z.namelist()) == {'entities.csv','measurement_definitions.csv','readings.csv','manifest.json','README.txt'}
        tables = {n:list(csv.DictReader(io.StringIO(z.read(n+'.csv').decode('utf-8-sig')))) for n in ('entities','measurement_definitions','readings')}
        entities = {r['id'] for r in tables['entities']}
        definitions = {r['id'] for r in tables['measurement_definitions']}
        assert all(r['entity_id'] in entities for r in tables['measurement_definitions'])
        assert all(r['measurement_id'] in definitions for r in tables['readings'])
        m=json.loads(z.read('manifest.json'))
        assert m['format_version']==2 and m['complete']
        assert m['tables']=={n:len(rows) for n,rows in tables.items()}
`, ...result.files.map(file => file.path)]);
    const empty = await buildArchives([], directory, '2026-09', '2026-10-01T00:00:00Z');
    assert.deepEqual(empty, { files: [], reading_count: 0, entity_ids: [] });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('source failure rejects the export instead of publishing a partial month', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archive-test-'));
  try {
    async function* rows() {
      yield { entity: { id: 'a' }, definition: { id: '1', entity_id: 'a' }, reading: { measurement_id: '1', observed_at: '2026-09-01T00:00:00Z', value: '1' } };
      throw new Error('database disconnected');
    }
    await assert.rejects(buildArchives(rows(), directory, '2026-09', '2026-10-01T00:00:00Z'), /disconnected/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('canonical numeric strings retain exact negative decimals and large IDs', () => {
  const line = tableLine('readings', { measurement_id: '9007199254740993', value: '-1.234567890123456789', provenance: { label: 'a,b' } });
  assert.ok(line.startsWith('9007199254740993,"",-1.234567890123456789,'));
  assert.throws(() => tableLine('readings', { value: '=BAD()' }));
});
