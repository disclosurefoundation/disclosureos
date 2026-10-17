import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Observation } from '@disclosureos/records';
import { getCompleteness, deriveFieldPaths } from '../completeness';
import { score, rankByCompellingness, DEFAULT_WEIGHTS } from '../compellingness';
import { scoringJsonSchema, SCORING_SCHEMA_VERSION } from '../schema';

function obs(extra: Record<string, unknown>): Observation & Record<string, unknown> {
  return {
    id: 'x',
    temporal: { date: '2004-11-14', dateCertainty: 'exact' },
    location: { id: 'l', name: 'Pacific', country: 'US', longitude: -117, latitude: 32, siteType: 'ocean' },
    status: 'published',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    ...extra,
  } as unknown as Observation & Record<string, unknown>;
}

describe('deriveFieldPaths', () => {
  const paths = deriveFieldPaths();

  it('derives a non-trivial set of leaf paths from the records schema', () => {
    expect(paths.length).toBeGreaterThan(20);
  });

  it('includes core and nested + extension-slot paths', () => {
    const set = new Set(paths.map((p) => p.path));
    expect(set.has('id')).toBe(true);
    expect(set.has('location.latitude')).toBe(true);
    expect(set.has('provenance.custodyStatus')).toBe(true);
  });

  it('marks required-everywhere paths as required', () => {
    const id = paths.find((p) => p.path === 'id');
    const summary = paths.find((p) => p.path === 'summary');
    expect(id?.required).toBe(true);
    expect(summary?.required).toBe(false);
  });
});

describe('getCompleteness', () => {
  it('reports full required coverage for a record with all required fields', () => {
    const result = getCompleteness(obs({}));
    expect(result.requiredPresent).toBe(result.requiredTotal);
    expect(result.requiredPercentage).toBe(100);
    expect(result.percentage).toBeLessThan(100);
  });

  it('flags missing required fields', () => {
    const { id: _omit, ...withoutId } = obs({});
    const result = getCompleteness(withoutId);
    expect(result.missing).toContain('id');
    expect(result.requiredPresent).toBeLessThan(result.requiredTotal);
  });
});

describe('score', () => {
  const unexplainedOrigin = obs({ origin: [{ primaryHypothesis: '1.1.3', confidence: 0.6 }] });
  const prosaicOrigin = obs({ origin: [{ primaryHypothesis: '1.1.1.2.1', confidence: 0.9 }] });

  it.each(['not_indicated', 'reported', 'documented', 'measured', 'confirmed'])('rejects %s descriptive support rather than inventing anomaly strength', (level) => {
    const descriptive = obs({ observableAssessments: { technology: { apparent_hover: [{ level, confidence: 1 }] } } });
    expect(() => score(descriptive)).toThrow('Descriptive observable assessments cannot produce anomaly strength');
    expect(() => score(descriptive, { weights: { technology: 0, biologics: 0, origin: 1 } })).toThrow('not a zero or absent result');
  });

  it('rejects biologics descriptions even when competing claims disagree', () => {
    const descriptive = obs({ observableAssessments: { biologics: { molecular_complexity_pattern: [{ level: 'measured' }, { level: 'not_indicated' }] } } });
    expect(() => score(descriptive)).toThrow('Use V2 attributed assessments and profile evaluation');
  });

  it('preserves origin-only evaluation without interpreting descriptive terms', () => {
    expect(score(unexplainedOrigin).score).toBeGreaterThan(score(prosaicOrigin).score);
    expect(score(prosaicOrigin).components.origin).toBe(0);
    expect(score(unexplainedOrigin).components.technology).toBe(0);
    expect(score(unexplainedOrigin).components.biologics).toBe(0);
  });

  it('stamps the methodology version and default weights', () => {
    const result = score(unexplainedOrigin);
    expect(result.scoringVersion).toBe('2.0.0');
    expect(result.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('honors overridden origin weights', () => {
    expect(score(unexplainedOrigin, { weights: { technology: 0, biologics: 0, origin: 1 } }).score).toBe(0.6);
  });

  it('accepts missing or empty descriptive claim lists', () => {
    for (const observation of [obs({}), obs({ observableAssessments: { technology: { apparent_hover: [] }, biologics: {} } })]) {
      const result = score(observation);
      expect(result.score).toBe(0);
      expect(result.contested).toBe(false);
      expect(result.range).toEqual({ low: 0, high: 0 });
    }
  });

  it('reports competing origin claims and applies evaluator trust without concealing their spread', () => {
    const contested = obs({ origin: [
      { primaryHypothesis: '1.1.3', confidence: 1, evaluatedBy: 'reviewer-a' },
      { primaryHypothesis: '1.1.1.2.1', confidence: 1, evaluatedBy: 'reviewer-b' },
    ] });
    const uniform = score(contested);
    const trusted = score(contested, { evaluatorWeight: (c) => c.evaluatedBy === 'reviewer-a' ? 10 : 1 });
    expect(uniform.contested).toBe(true);
    expect(uniform.range.low).toBeLessThan(uniform.range.high);
    expect(trusted.components.origin).toBeGreaterThan(uniform.components.origin);
    expect(trusted.range).toEqual(uniform.range);
  });
});

describe('rankByCompellingness', () => {
  it('orders origin-only results', () => {
    const weak = obs({ origin: [{ primaryHypothesis: '1.1.3', confidence: 0.1 }] });
    const strong = obs({ origin: [{ primaryHypothesis: '1.1.3', confidence: 0.9 }] });
    const ranked = rankByCompellingness([weak, strong]);
    expect(ranked[0]?.observation).toBe(strong);
  });

  it('rejects a batch containing descriptive claims instead of silently ranking it', () => {
    expect(() => rankByCompellingness([obs({}), obs({ observableAssessments: { technology: { apparent_hover: [{ level: 'confirmed' }] } } })])).toThrow('cannot produce anomaly strength');
  });
});

describe('scoring JSON Schema artifact', () => {
  const committedPath = join(dirname(fileURLToPath(import.meta.url)), '../../schema/scoring.schema.json');
  const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(scoringJsonSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(SCORING_SCHEMA_VERSION);
  });
});
