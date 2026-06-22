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
  const anomalous = obs({
    observableAssessments: {
      technology: { antigravity_lift: [{ level: 'measured', confidence: 0.8 }] },
      biologics: {},
    },
    origin: [{ primaryHypothesis: '1.1.3', confidence: 0.6 }],
  });

  const prosaic = obs({
    observableAssessments: { technology: { antigravity_lift: [{ level: 'not_indicated' }] }, biologics: {} },
    origin: [{ primaryHypothesis: '1.1.1.2.1', confidence: 0.9 }],
  });

  it('scores an anomalous case higher than a prosaic one', () => {
    expect(score(anomalous).score).toBeGreaterThan(score(prosaic).score);
  });

  it('treats a confident prosaic origin as no origin signal', () => {
    expect(score(prosaic).components.origin).toBe(0);
  });

  it('stamps the methodology version and default weights', () => {
    const result = score(anomalous);
    expect(result.scoringVersion).toBe('2.0.0');
    expect(result.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('honors overridden weights', () => {
    const onlyOrigin = score(anomalous, { weights: { technology: 0, biologics: 0, origin: 1 } });
    expect(onlyOrigin.score).toBe(0.6);
  });

  it('returns 0 for an empty case, not contested, with a zero range', () => {
    const result = score(obs({}));
    expect(result.score).toBe(0);
    expect(result.contested).toBe(false);
    expect(result.range).toEqual({ low: 0, high: 0 });
  });

  it('is not contested when a single evaluator asserts an anomaly', () => {
    const result = score(anomalous);
    expect(result.contested).toBe(false);
    expect(result.range.low).toBe(result.range.high);
  });

  it('flags contestedness when claims disagree on direction (low < high)', () => {
    const contested = obs({
      observableAssessments: {
        technology: {
          antigravity_lift: [
            { level: 'measured', confidence: 0.9, evaluatedBy: 'academic' },
            { level: 'not_indicated', confidence: 0.1, evaluatedBy: 'AARO' },
          ],
        },
      },
    });
    const result = score(contested);
    expect(result.contested).toBe(true);
    expect(result.range.low).toBeLessThan(result.range.high);
  });

  it('applies evaluatorWeight to the consensus point but not the range', () => {
    const contested = obs({
      observableAssessments: {
        technology: {
          antigravity_lift: [
            { level: 'confirmed', confidence: 1, evaluatedBy: 'academic' },
            { level: 'not_indicated', confidence: 1, evaluatedBy: 'AARO' },
          ],
        },
      },
    });
    const trustAcademic = score(contested, {
      evaluatorWeight: (c) => (c.evaluatedBy === 'academic' ? 10 : 1),
    });
    const uniform = score(contested);
    // Trusting the academic pulls the consensus toward the anomaly...
    expect(trustAcademic.components.technology).toBeGreaterThan(uniform.components.technology);
    // ...but the honest spread (range) is identical.
    expect(trustAcademic.range).toEqual(uniform.range);
  });
});

describe('rankByCompellingness', () => {
  it('sorts most-compelling first', () => {
    const weak = obs({ origin: [{ primaryHypothesis: '1.1.3', confidence: 0.1 }] });
    const strong = obs({
      observableAssessments: { technology: { antigravity_lift: [{ level: 'confirmed', confidence: 1 }] } },
      origin: [{ primaryHypothesis: '1.1.3', confidence: 0.9 }],
    });
    const ranked = rankByCompellingness([weak, strong]);
    expect(ranked[0]?.observation).toBe(strong);
    expect(ranked[0]!.result.score).toBeGreaterThan(ranked[1]!.result.score);
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
