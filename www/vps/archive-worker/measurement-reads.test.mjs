import assert from 'node:assert/strict';
import test from 'node:test';
import { measurementReadSql } from './measurement-reads.mjs';

test('archive reads can use canonical measurements without changing ingestion or visibility locks', () => {
  const sql = 'SELECT d.value FROM sensor_data d JOIN sensor_metadata s ON s.id=d.sensor_id';
  assert.equal(measurementReadSql(sql, 'legacy'), sql);
  assert.equal(measurementReadSql(sql, 'core'), 'SELECT d.value FROM core_sensor_data d JOIN core_sensor_metadata s ON s.id=d.sensor_id');
  assert.equal(measurementReadSql(sql, 'core_current'), 'SELECT d.value FROM sensor_data d JOIN core_sensor_metadata s ON s.id=d.sensor_id');
  assert.throws(() => measurementReadSql(sql, 'bad'), /must be legacy, core_current or core/);
  assert.throws(() => measurementReadSql('DELETE FROM sensor_data', 'core'), /read statement/);
});
