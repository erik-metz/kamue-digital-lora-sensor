import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import yazl from 'yazl';

export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use YYYY-MM');
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export function csvCell(value) {
  if (typeof value === 'number') return String(value);
  let text = value == null ? '' : String(value);
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const header = '\uFEFFtimestamp,sensor_id,metric,value,unit\r\n';
const readme = `Open Ried Sens / KAMÜ Kulturzentrum Bürstadt

Public measurement snapshot. Licence: CC BY 4.0
https://creativecommons.org/licenses/by/4.0/
Attribution: Daten: Open Ried Sens / KAMÜ Kulturzentrum Bürstadt

measurements.csv: UTF-8 (BOM), comma delimiter, decimal point.
Columns: timestamp (UTC ISO-8601), sensor_id, metric, value, unit.
One row per reading. Multiple metrics can share a timestamp; do not
remove them as duplicates. Missing readings are absent, not zero.
Text beginning with a spreadsheet formula character is prefixed with
an apostrophe. Numeric negative values are unchanged.

stations.json: station metadata at export time (not historical locations).
manifest.json: month, part, reading count, snapshot time and coverage.
All ZIP parts of a month are needed for the complete monthly snapshot.
There is no API row limit. Late arrivals/corrections after snapshot time
require a refreshed export. Current-month snapshots are incomplete.
Measurements are community sensor observations, not certified reference
measurements; sensor availability, calibration and data quality may vary.
Public API and documentation: https://open-ried-sens.duckdns.org/docs
`;

/** Stream rows to bounded CSV parts on disk, then compress each part. */
export async function buildArchives(rows, stations, directory, month, generatedAt, partBytes = 64 * 1024 * 1024) {
  const files = [];
  let output;
  let completion;
  let csvPath;
  let bytes = 0;
  let count = 0;
  let total = 0;
  let first = null;
  let last = null;
  const { start, end } = monthRange(month);
  async function finish() {
    if (!output) return;
    output.end();
    await completion;
    const filename = `open-ried-sens-${month}-part-${String(files.length + 1).padStart(4, '0')}.zip`;
    const zipPath = path.join(directory, filename);
    const zip = new yazl.ZipFile();
    const saving = pipeline(zip.outputStream, createWriteStream(zipPath));
    // Fixed ZIP entry dates make retry content deterministic for a given snapshot.
    const options = { mtime: start };
    zip.addFile(csvPath, 'measurements.csv', options);
    zip.addBuffer(Buffer.from(JSON.stringify(stations, null, 2)), 'stations.json', options);
    zip.addBuffer(Buffer.from(readme), 'README.txt', options);
    zip.addBuffer(Buffer.from(JSON.stringify({ month, part: files.length + 1, reading_count: count, generated_at: generatedAt, start: start.toISOString(), end_exclusive: end.toISOString(), first_reading: first, last_reading: last }, null, 2)), 'manifest.json', options);
    zip.end();
    await saving;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(zipPath)) hash.update(chunk);
    files.push({ filename, path: zipPath, size_bytes: (await stat(zipPath)).size, reading_count: count, sha256: hash.digest('hex') });
    output = undefined;
  }
  try {
    for await (const row of rows) {
      const timestamp = row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp;
      const line = [timestamp, row.sensor_id, row.metric, row.value, row.unit].map(csvCell).join(',') + '\r\n';
      const size = Buffer.byteLength(line);
      if (output && bytes + size > partBytes && count) await finish();
      if (!output) {
        csvPath = path.join(directory, `part-${files.length + 1}.csv`);
        output = createWriteStream(csvPath);
        completion = once(output, 'finish');
        // Observe errors immediately, including errors while consuming the DB cursor.
        completion.catch(() => {});
        output.write(header);
        bytes = Buffer.byteLength(header);
        count = 0;
        first = timestamp;
      }
      if (!output.write(line)) await once(output, 'drain');
      bytes += size;
      count++;
      total++;
      last = timestamp;
    }
    await finish();
    return { files, reading_count: total };
  } catch (error) {
    output?.destroy();
    throw error;
  }
}
