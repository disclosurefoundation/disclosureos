import { describe, expect, it } from 'vitest';
import { parsePrimitiveRecord } from '../experimental/v2';

const point = (value: string) => ({ kind: 'instant', value, timeScale: 'UTC' });
const record = () => ({ id: 'synthetic',
  eventTime: { state: 'unknown', reason: 'not_recorded' },
  position: { state: 'unknown', reason: 'not_recorded' },
});
const intervalRecord = (start: unknown, end: unknown) => ({ ...record(), eventTime: {
  state: 'approximate', value: { kind: 'interval', start, end },
  precision: 'Source bounded estimate', sourceRefs: ['source:original'],
} });

describe('time interval estimates', () => {
  it('preserves a partial-date interval without inventing endpoints', () => {
    const input = intervalRecord({ kind: 'year', value: '1947' }, { kind: 'year', value: '1948' });
    const result = parsePrimitiveRecord(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
  });

  it('orders instants by offset while preserving their source strings', () => {
    const input = intervalRecord(point('2026-07-01T15:00:00-07:00'), point('2026-07-01T22:00:00Z'));
    const result = parsePrimitiveRecord(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
  });

  it.each([
    ['2026-07-01T22:00:00.000002Z', '2026-07-01T22:00:00.000001Z'],
    ['2026-07-01T22:00:00.1001Z', '2026-07-01T22:00:00.1Z'],
    ['2026-07-01T15:00:00-07:00', '2026-07-01T21:59:59Z'],
  ])('rejects reversed instants %s > %s without millisecond rounding', (start, end) => {
    const result = parsePrimitiveRecord(intervalRecord(point(start), point(end)));
    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'TIME.INTERVAL', pointer: '/eventTime/value/end' }));
  });

  it('rejects instants without seconds consistently with JSON Schema', () => {
    const result = parsePrimitiveRecord(intervalRecord(point('2026-07-01T22:00Z'), point('2026-07-01T22:00:00Z')));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'STRUCT.VALUE' }));
  });

  it('treats trailing fractional zeroes as equal', () => {
    expect(parsePrimitiveRecord(intervalRecord(point('2026-07-01T22:00:00.1000Z'), point('2026-07-01T22:00:00.1Z'))).success).toBe(true);
  });

  it('rejects mixed endpoint precision instead of guessing calendar anchors', () => {
    const result = parsePrimitiveRecord(intervalRecord({ kind: 'year', value: '1947' }, { kind: 'date', value: '1947-07-08' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'TIME.PRECISION_MISMATCH' }));
  });

  it('also checks intervals inside source assertions', () => {
    const result = parsePrimitiveRecord({ ...record(), assertions: [{ id: 'a', field: 'eventTime',
      value: { kind: 'interval', start: { kind: 'month', value: '1947-08' }, end: { kind: 'month', value: '1947-07' } },
      provenance: { sourceRef: 'source:original' },
    }] });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'TIME.INTERVAL', pointer: '/assertions/0/value/end' }));
  });
});

const selectedRecord = () => {
  const value = { latitude: 0, longitude: 0, datum: 'WGS84' };
  return { ...record(), position: { state: 'known', value, sourceRefs: ['assertion:a'], selection: {
    assertionRef: 'assertion:a', consideredAssertionRefs: ['assertion:a', 'assertion:b'],
    methodRef: 'method:source-priority', methodVersion: '1.0.0',
    evaluatedBy: 'person:curator', evaluatedAt: '2026-09-07T12:00:00Z', rationale: 'Synthetic selection rationale',
  } }, assertions: [
    { id: 'a', field: 'position', value, provenance: { sourceRef: 'source:first' } },
    { id: 'b', field: 'position', value: { ...value, latitude: 1 }, provenance: { sourceRef: 'source:second' } },
  ] };
};

describe('auditable source-value selection', () => {
  it('preserves the selected value and both competing assertions', () => {
    const input = selectedRecord();
    const result = parsePrimitiveRecord(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
    expect(result.uncheckedRefs).toContain('method:source-priority');
  });

  it('rejects a selected value that differs from its cited assertion', () => {
    const input = selectedRecord();
    input.position.value = { ...input.position.value, latitude: 20 };
    expect(parsePrimitiveRecord(input).issues).toContainEqual(expect.objectContaining({ code: 'SELECTION.VALUE_MISMATCH' }));
  });

  it('requires the selected assertion in the considered inputs and field references', () => {
    const input = selectedRecord();
    input.position.selection.consideredAssertionRefs = ['assertion:b'];
    input.position.sourceRefs = ['source:first'];
    const codes = parsePrimitiveRecord(input).issues.map(i => i.code);
    expect(codes).toContain('SELECTION.INPUTS');
    expect(codes).toContain('SELECTION.SOURCE_REF');
  });

  it('rejects duplicate and dangling considered inputs', () => {
    const input = selectedRecord();
    input.position.selection.consideredAssertionRefs = ['assertion:a', 'assertion:a', 'assertion:missing'];
    const codes = parsePrimitiveRecord(input).issues.map(i => i.code);
    expect(codes).toContain('REF.UNIQUE_ID');
    expect(codes).toContain('REF.LOCAL_RESOLUTION');
  });

  it('does not permit selection metadata on a redacted value', () => {
    const input = selectedRecord();
    expect(parsePrimitiveRecord({ ...input, position: { state: 'redacted', reason: 'policy', selection: input.position.selection } }).success).toBe(false);
  });
});
