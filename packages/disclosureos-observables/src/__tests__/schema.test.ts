import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  observablesJsonSchema,
  validateObservableAssessments,
  OBSERVABLES_SCHEMA_VERSION,
} from '../schema';

const committedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../schema/observables.schema.json',
);
const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

describe('observables JSON Schema artifact', () => {
  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(observablesJsonSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(OBSERVABLES_SCHEMA_VERSION);
  });
});

describe('validateObservableAssessments', () => {
  it('accepts a valid assessment map (claim lists)', () => {
    const value = {
      technology: {
        antigravity_lift: [
          { level: 'documented', confidence: 0.7, evaluatedAt: '2020-01-01T00:00:00Z' },
        ],
      },
      biologics: {},
    };
    expect(validateObservableAssessments(value)).toEqual([]);
  });

  it('accepts multiple competing claims for one observable', () => {
    const value = {
      technology: {
        antigravity_lift: [
          { level: 'measured', confidence: 0.8, evaluatedBy: 'academic' },
          { level: 'not_indicated', confidence: 0.1, evaluatedBy: 'AARO' },
        ],
      },
    };
    expect(validateObservableAssessments(value)).toEqual([]);
  });

  it('accepts claims carrying evidence refs', () => {
    const value = {
      technology: {
        antigravity_lift: [{ level: 'documented', evidenceRefs: ['sensor:r1', 'media:m1'] }],
      },
    };
    expect(validateObservableAssessments(value)).toEqual([]);
  });

  it('rejects a non-array claim value', () => {
    const value = { technology: { antigravity_lift: { level: 'documented' } } };
    expect(validateObservableAssessments(value).length).toBeGreaterThan(0);
  });

  it('rejects an unknown observable id', () => {
    const value = { technology: { not_a_real_id: [{ level: 'documented' }] } };
    expect(validateObservableAssessments(value).length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range confidence', () => {
    const value = {
      technology: { antigravity_lift: [{ level: 'documented', confidence: 5 }] },
    };
    expect(validateObservableAssessments(value).length).toBeGreaterThan(0);
  });

  it('rejects an invalid level', () => {
    const value = { biologics: { molecular_complexity: [{ level: 'super_confirmed' }] } };
    expect(validateObservableAssessments(value).length).toBeGreaterThan(0);
  });
});
