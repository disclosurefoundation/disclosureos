import { describe, expect, it } from 'vitest';
import { EventTimeSchema, PositionSchema, parsePrimitiveRecord } from '../experimental/v2';

const knownPosition = { state: 'known', value: { latitude: 0, longitude: 0, datum: 'WGS84' }, sourceRefs: ['source:original'] };
const base = () => ({ id: 'synthetic', eventTime: { state: 'unknown', reason: 'not_recorded' }, position: knownPosition });

describe('experimental v2 values', () => {
  it('preserves zero coordinates and source references exactly', () => {
    const input = base();
    const result = parsePrimitiveRecord(input);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid primitive record');
    expect(result.data).toEqual(input);
    expect(result.uncheckedRefs).toEqual(['source:original']);
  });

  it.each(['not_recorded', 'not_collected', 'unavailable'])('preserves unknown reason %s', reason => {
    expect(EventTimeSchema.parse({ state: 'unknown', reason })).toEqual({ state: 'unknown', reason });
  });

  it.each([
    { state: 'unknown', reason: 'not_recorded', value: '1900-01-01' },
    { state: 'redacted', reason: 'publication_policy', sortingAnchor: 0 },
    { state: 'not_applicable', reason: 'no data' },
    { state: 'redacted', reason: '   ' },
  ])('rejects hidden values, unlicensed inapplicability, and empty reasons', input => {
    expect(EventTimeSchema.safeParse(input).success).toBe(false);
  });

  it('requires provenance and explicit precision for approximate values', () => {
    const input = { state: 'approximate', value: { kind: 'year', value: '1947' }, sourceRefs: ['source:archive'] };
    expect(EventTimeSchema.safeParse(input).success).toBe(false);
    expect(EventTimeSchema.parse({ ...input, precision: 'Year only in source' })).toEqual({ ...input, precision: 'Year only in source' });
    expect(PositionSchema.safeParse({ ...knownPosition, sourceRefs: [] }).success).toBe(false);
  });

  it.each(['2025-02-29', '2026-99-99'])('rejects impossible calendar date %s', value => {
    expect(EventTimeSchema.safeParse({ state: 'known', value: { kind: 'date', value }, sourceRefs: ['source:archive'] }).success).toBe(false);
  });

  it('preserves fractional timestamp precision and explicit offsets', () => {
    const input = { state: 'known', value: { kind: 'instant', value: '2026-07-01T15:03:20.249770-07:00', timeScale: 'UTC' }, sourceRefs: ['product:capture'] };
    expect(EventTimeSchema.parse(input)).toEqual(input);
    expect(EventTimeSchema.safeParse({ ...input, value: { ...input.value, value: '2026-07-01T15:03:20' } }).success).toBe(false);
  });

  it('preserves contradictory assertions without selecting or averaging them', () => {
    const input = { ...base(), assertions: [
      { id: 'a', field: 'eventTime', value: { kind: 'date', value: '1947-07-08' }, provenance: { sourceRef: 'source:first', attributedTo: 'person:first' } },
      { id: 'b', field: 'eventTime', value: { kind: 'date', value: '1947-07-09' }, provenance: { sourceRef: 'source:second', extractedBy: 'agent:extractor' } },
    ] };
    const result = parsePrimitiveRecord(input);
    if (!result.success) throw new Error('Expected competing assertions to remain valid');
    expect(result.data).toEqual(input);
  });

  it('checks local assertion IDs and field compatibility without claiming external resolution', () => {
    const assertion = { id: 'a', field: 'eventTime', value: { kind: 'year', value: '1947' }, provenance: { sourceRef: 'source:archive' } };
    const input = { ...base(), position: { ...knownPosition, sourceRefs: ['assertion:a', 'assertion:missing'] }, assertions: [assertion, assertion] };
    const result = parsePrimitiveRecord(input);
    expect(result.success).toBe(false);
    expect(result.issues.map(i => i.code)).toEqual(expect.arrayContaining(['REF.UNIQUE_ID', 'REF.FIELD_MISMATCH', 'REF.LOCAL_RESOLUTION']));
    expect(result.issues.find(i => i.code === 'REF.LOCAL_RESOLUTION')?.pointer).toBe('/position/sourceRefs/1');
  });

  it('rejects private notes and nested unknown keys rather than stripping them', () => {
    const input = { ...base(), position: { ...knownPosition, value: { ...knownPosition.value, latitdue: 3 } }, privateNotes: 'not public' };
    const before = structuredClone(input);
    expect(parsePrimitiveRecord(input).success).toBe(false);
    expect(input).toEqual(before);
  });
});
