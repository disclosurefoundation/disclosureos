import { describe, expect, it } from 'vitest';
import { parseExperimentalObservation } from '../experimental/v2';

const minimal = () => ({
  kind: 'observation', schemaVersion: '0.1.0', id: 'synthetic', status: 'draft',
  createdAt: '2026-09-07T12:00:00Z', updatedAt: '2026-09-07T12:00:00Z',
  eventTime: { state: 'unknown', reason: 'not_recorded' },
  position: { state: 'unknown', reason: 'not_collected' },
  sources: [], products: [], methods: [], frames: [], assertions: [], measurements: [], processing: [],
});

const quantified = () => ({ ...minimal(),
  sources: [{ id: 's', kind: 'instrument_data', access: 'unknown' }],
  frames: [{ id: 'f', kind: 'cartesian', definition: { state: 'described', description: 'Synthetic local frame; no transform asserted' }, unit: 'm' }],
  measurements: [{ id: 'm', quantity: 'signed displacement', frameRef: 'frame:f', sourceRefs: ['source:s'],
    value: { value: -2, unit: 'm', uncertainty: { kind: 'standard', magnitude: 0.1, unit: 'm', sourceRefs: ['source:s'] } },
  }],
});

describe('experimental Observation contract', () => {
  it('preserves a complete but explicitly incomplete archival record', () => {
    const input = minimal();
    const result = parseExperimentalObservation(input);
    expect(result.success).toBe(true);
    expect(result.checks).toEqual({ structural: 'passed', semantic: 'passed', profile: 'not_checked', external: 'not_checked' });
    if (result.success) expect(result.data).toEqual(input);
  });

  it('accepts signed measurements with nonnegative uncertainty and resolves local metadata', () => {
    const input = quantified();
    const result = parseExperimentalObservation(input);
    expect(result.success).toBe(true);
    expect(result.uncheckedRefs).toContain('source:s');
    expect(result.uncheckedRefs).toContain('frame:f');
    if (result.success) expect(result.data).toEqual(input);
  });

  it('rejects negative uncertainty without banning signed physical values', () => {
    const input = quantified();
    input.measurements[0]!.value.uncertainty.magnitude = -1;
    expect(parseExperimentalObservation(input).checks.structural).toBe('failed');
  });

  it('reports unit mismatch at the uncertainty rather than converting it', () => {
    const input = quantified();
    input.measurements[0]!.value.uncertainty.unit = 's';
    expect(parseExperimentalObservation(input).issues).toContainEqual(expect.objectContaining({ code: 'UNIT.MISMATCH', pointer: '/measurements/0/value/uncertainty/unit' }));
  });

  it('rejects undeclared frame references', () => {
    const input = quantified();
    input.measurements[0]!.frameRef = 'frame:missing';
    expect(parseExperimentalObservation(input).issues).toContainEqual(expect.objectContaining({ code: 'REF.LOCAL_RESOLUTION', pointer: '/measurements/0/frameRef' }));
  });

  it('compares record timestamps without losing fractional precision', () => {
    const input = minimal();
    input.createdAt = '2026-09-07T12:00:00.000002Z';
    input.updatedAt = '2026-09-07T12:00:00.000001Z';
    expect(parseExperimentalObservation(input).issues).toContainEqual(expect.objectContaining({ code: 'TIME.RECORD_ORDER' }));
  });

  it('preserves namespaced JSON extensions and rejects private top-level notes', () => {
    const input = { ...minimal(), extensions: { 'org.example.sensor': { absent: null, zero: 0, enabled: false } } };
    const result = parseExperimentalObservation(input);
    if (!result.success) throw new Error('Expected extension preservation');
    expect(result.data).toEqual(input);
    expect(parseExperimentalObservation({ ...input, privateNotes: 'must not be silently exported' }).success).toBe(false);
  });
});
