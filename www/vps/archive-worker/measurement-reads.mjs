/** Only fixed, internal SELECT templates pass through this read-model selector. */
export function measurementReadSql(statement, mode = process.env.MEASUREMENT_READ_MODE || 'legacy') {
  if (!['legacy', 'core'].includes(mode)) throw new Error('MEASUREMENT_READ_MODE must be legacy or core');
  if (!/^\s*(SELECT|WITH)\b/i.test(statement)) throw new Error('Expected a read statement');
  if (mode === 'legacy') return statement;
  return statement.replace(/\b(sensor_data|sensor_metadata)\b/g, name => `core_${name}`);
}
