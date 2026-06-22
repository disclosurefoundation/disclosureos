import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  composeObservationSchema,
  ENRICHED_OBSERVATION_SCHEMA_VERSION,
  ENRICHED_OBSERVATION_SCHEMA_ID,
  parseEnrichedObservation,
  defaultRegistry,
  ExtensionRegistry,
} from '../index';
import type { EnrichedObservation } from '../index';

/** A minimal but fully-enriched, valid observation (records core + both slots). */
function enriched(extra: Record<string, unknown> = {}): EnrichedObservation & Record<string, unknown> {
  return {
    id: 'nimitz-2004',
    temporal: { date: '2004-11-14', dateCertainty: 'exact' },
    location: { id: 'l', name: 'Pacific', country: 'US', longitude: -117, latitude: 32, siteType: 'ocean' },
    status: 'published',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    observableAssessments: { technology: { antigravity_lift: [{ level: 'confirmed', confidence: 1 }] } },
    origin: [{ primaryHypothesis: '1.1.3', confidence: 0.9 }],
    ...extra,
  } as unknown as EnrichedObservation & Record<string, unknown>;
}

describe('ExtensionRegistry', () => {
  it('pre-registers the first-party slots', () => {
    expect(defaultRegistry.has('observableAssessments')).toBe(true);
    expect(defaultRegistry.has('origin')).toBe(true);
    expect(defaultRegistry.get('observableAssessments')?.owner).toBe('@disclosureos/observables');
    expect(defaultRegistry.get('origin')?.owner).toBe('@disclosureos/origins');
  });

  it('rejects a duplicate slot registration', () => {
    const r = new ExtensionRegistry();
    r.register({ slot: 's', owner: 'a', schemaId: 'id', version: '1', jsonSchema: () => ({}), validate: () => [] });
    expect(() =>
      r.register({ slot: 's', owner: 'b', schemaId: 'id', version: '1', jsonSchema: () => ({}), validate: () => [] }),
    ).toThrow(/already registered/);
  });

  it('composes only the slots present in a custom registry', () => {
    const composed = composeObservationSchema(new ExtensionRegistry());
    const observation = (composed.$defs as Record<string, Record<string, unknown>>)['Observation']!;
    const props = observation['properties'] as Record<string, unknown>;
    expect(props['observableAssessments']).toBeUndefined();
    expect(props['origin']).toBeUndefined();
    expect(props['id']).toBeDefined();
  });
});

describe('composeObservationSchema', () => {
  const composed = composeObservationSchema();
  const observation = (composed.$defs as Record<string, Record<string, unknown>>)['Observation']!;
  const props = observation['properties'] as Record<string, unknown>;
  const defs = composed.$defs as Record<string, unknown>;

  it('folds the satellite slots in as real properties', () => {
    expect(props['observableAssessments']).toBeDefined();
    expect(props['origin']).toBeDefined();
  });

  it('merges every layer $def (records + observables + origins)', () => {
    expect(defs['Observation']).toBeDefined();
    expect(defs['ObservableAssessmentMap']).toBeDefined();
    expect(defs['ObservableClaim']).toBeDefined();
    expect(defs['OriginClaim']).toBeDefined();
    expect(defs['HypothesisWeight']).toBeDefined();
  });

  it('tightens the root to additionalProperties:false while keeping the extensions bag', () => {
    expect(observation['additionalProperties']).toBe(false);
    expect(props['extensions']).toBeDefined();
  });

  it('uses the os.disclosure.org host and records its version', () => {
    expect(composed['$id']).toBe(ENRICHED_OBSERVATION_SCHEMA_ID);
    expect(ENRICHED_OBSERVATION_SCHEMA_ID).toContain('https://os.disclosure.org/schema/');
    expect(composed['x-schema-version']).toBe(ENRICHED_OBSERVATION_SCHEMA_VERSION);
  });
});

describe('parseEnrichedObservation', () => {
  it('validates an enriched record and returns it WITHOUT stripping the slots', () => {
    const input = enriched();
    const result = parseEnrichedObservation(input);
    expect(result.success).toBe(true);
    expect(result.data).toBe(input);
    expect(result.data?.observableAssessments).toBeDefined();
    expect(result.data?.origin).toBeDefined();
  });

  it('accepts arbitrary data under the extensions bag', () => {
    const result = parseEnrichedObservation(enriched({ extensions: { myVendor: { anything: true } } }));
    expect(result.success).toBe(true);
  });

  it('rejects an unknown top-level key (data belongs under extensions)', () => {
    const result = parseEnrichedObservation(enriched({ bogusTopLevel: 123 }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.path === 'bogusTopLevel')).toBe(true);
  });

  it('flags an invalid slot with a slot-prefixed path', () => {
    const result = parseEnrichedObservation(enriched({ origin: [{ primaryHypothesis: 'not-a-real-node', confidence: 0.5 }] }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.path.startsWith('origin'))).toBe(true);
  });

  it('rejects a non-object input', () => {
    expect(parseEnrichedObservation(null).success).toBe(false);
    expect(parseEnrichedObservation([]).success).toBe(false);
  });
});

describe('enriched-observation JSON Schema artifact', () => {
  const committedPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../schema/enriched-observation.schema.json',
  );
  const committed = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;

  it('committed schema matches the emitted schema (drift guard)', () => {
    expect(composeObservationSchema()).toEqual(committed);
  });

  it('records the current schema version', () => {
    expect(committed['x-schema-version']).toBe(ENRICHED_OBSERVATION_SCHEMA_VERSION);
  });
});
