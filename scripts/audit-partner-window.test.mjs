import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditWindow } from './audit-partner-window.mjs';

test('timestamps, rather than coherence labels, determine window membership', () => {
  const input = { window: { start: '2026-07-01T00:00:00Z', end: '2026-07-01T00:02:00Z' },
    records_by_modality: { synthetic: { count: 5, coherence: 'in_window', records: [
      { timestamp: 1782864000 }, { timestamp: '2026-07-01T00:02:00Z' },
      { timestamp: '2026-07-01T00:02:01Z' }, { timestamp: null },
    ] } } };
  const original = structuredClone(input);
  const [result] = auditWindow(input);
  assert.equal(result.outsideWindow, 1);
  assert.equal(result.boundaryPrecision, 2);
  assert.equal(result.unknownTimestamp, 1);
  assert.equal(result.countMatches, false);
  assert.deepEqual(input, original);
});

test('invalid windows and missing arrays fail explicitly', () => {
  assert.throws(() => auditWindow({ window: { start: 'invalid' } }), /Invalid declared window/);
  assert.throws(() => auditWindow({ window: { start: 2, end: 1 } }), /Invalid declared window/);
  assert.throws(() => auditWindow({ window: { start: 1, end: 2 }, records_by_modality: { x: {} } }), /Missing records/);
});
