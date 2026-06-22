import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  originsJsonSchema,
  validateOriginClassification,
  ORIGINS_SCHEMA_VERSION,
} from '../schema';

const committedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../schema/origins.schema.json',
);
const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

describe('origins JSON Schema artifact', () => {
  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(originsJsonSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(ORIGINS_SCHEMA_VERSION);
  });
});

describe('validateOriginClassification', () => {
  it('accepts a valid list of claims', () => {
    const value = [
      {
        primaryHypothesis: '1.1.3',
        confidence: 0.6,
        evaluatedAt: '2020-01-01T00:00:00Z',
        alternativeHypotheses: [{ nodeId: '1.1.1', confidence: 0.3 }],
      },
    ];
    expect(validateOriginClassification(value)).toEqual([]);
  });

  it('accepts multiple competing claims', () => {
    const value = [
      { primaryHypothesis: '1.1.3', confidence: 0.6 },
      { primaryHypothesis: '1.1.1', confidence: 0.7, evaluatedBy: 'AARO' },
    ];
    expect(validateOriginClassification(value)).toEqual([]);
  });

  it('rejects a non-array origin slot', () => {
    const value = { primaryHypothesis: '1.1.3', confidence: 0.6 };
    expect(validateOriginClassification(value).length).toBeGreaterThan(0);
  });

  it('rejects a missing primary hypothesis', () => {
    const value = [{ confidence: 0.6 }];
    expect(validateOriginClassification(value).length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range confidence', () => {
    const value = [{ primaryHypothesis: '1.1.3', confidence: 2 }];
    expect(validateOriginClassification(value).length).toBeGreaterThan(0);
  });

  it('rejects an unknown OCS node id', () => {
    const value = [{ primaryHypothesis: '9.9.9', confidence: 0.6 }];
    expect(validateOriginClassification(value).length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range alternative confidence', () => {
    const value = [
      {
        primaryHypothesis: '1.1.3',
        confidence: 0.6,
        alternativeHypotheses: [{ nodeId: '1.1.1', confidence: 5 }],
      },
    ];
    expect(validateOriginClassification(value).length).toBeGreaterThan(0);
  });
});
