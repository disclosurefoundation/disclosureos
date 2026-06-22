import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordsJsonSchema, RECORDS_SCHEMA_VERSION } from '../schema';
import { ObservationSchema } from '../observation/types';

const committedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../schema/records.schema.json',
);
const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

const VALID = {
  id: 'obs-1',
  temporal: { date: '1947-07-08', dateCertainty: 'estimated' },
  location: {
    id: 'loc-1',
    name: 'Roswell',
    country: 'United States',
    longitude: -104.5,
    latitude: 33.4,
    siteType: 'other',
  },
  status: 'published',
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
} as const;

describe('records JSON Schema artifact', () => {
  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(recordsJsonSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(RECORDS_SCHEMA_VERSION);
  });

  it('leaves the Observation root open for satellite slots', () => {
    const defs = committed['$defs'] as Record<string, Record<string, unknown>>;
    expect(defs['Observation']?.['additionalProperties']).toBe(true);
  });
});

describe('ObservationSchema validation', () => {
  it('accepts a minimal valid observation', () => {
    expect(ObservationSchema.safeParse(VALID).success).toBe(true);
  });

  it('ignores (does not reject) cross-package satellite slots', () => {
    const withSlots = { ...VALID, observableAssessments: { technology: {} }, origin: {} };
    expect(ObservationSchema.safeParse(withSlots).success).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    const bad = { ...VALID, location: { ...VALID.location, latitude: 999 } };
    expect(ObservationSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-ISO date', () => {
    const bad = { ...VALID, temporal: { date: 'July 1947', dateCertainty: 'estimated' } };
    expect(ObservationSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { status: _status, ...missing } = VALID;
    expect(ObservationSchema.safeParse(missing).success).toBe(false);
  });
});
