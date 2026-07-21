/**
 * `composeObservationSchema()` — fold the records core schema and every registered
 * satellite slot schema into one enriched `Observation` JSON Schema.
 *
 * This is the **portable contract**: the single artifact that means the same thing
 * in TypeScript, JSON Schema, Python, and the docs. The records core schema is
 * deliberately OPEN (`additionalProperties: true`) because its satellite slots
 * attach via augmentation; here we fold those slots back in as real properties and
 * TIGHTEN the root to `additionalProperties: false` — unknown top-level keys are
 * rejected, while the `extensions` bag (a named property) still carries arbitrary
 * third-party data.
 *
 * Composition is a brand-free, plain-data merge: each layer's committed JSON Schema
 * (records + the slots from {@link defaultRegistry}) is merged by `$defs` name. The
 * three layers own disjoint `$defs` (records: `Observation`/`Temporal`/…;
 * observables: `ObservableAssessmentMap`/…; origins: `OriginClaim`/…), so the merge
 * needs no `$ref` rewriting; a collision throws loudly rather than silently winning.
 */
import { recordsJsonSchema } from '@disclosureos/records';
import { schemaId, jsonSchemaEnvelope } from '@disclosureos/records/shared';
import {
  observablesJsonSchema,
  validateObservableAssessments,
  OBSERVABLES_SCHEMA_ID,
  OBSERVABLES_SCHEMA_VERSION,
} from '@disclosureos/observables';
import {
  originsJsonSchema,
  validateOriginClassification,
  ORIGINS_SCHEMA_ID,
  ORIGINS_SCHEMA_VERSION,
} from '@disclosureos/origins';
import { defaultRegistry, ExtensionRegistry } from './registry';

/**
 * Version of the emitted composed-schema artifact. Bump on any intentional change
 * to the enriched shape — note that bumping a *layer* schema can also change this
 * artifact, so the drift test guards both.
 */
export const ENRICHED_OBSERVATION_SCHEMA_VERSION = '1.1.0';

export const ENRICHED_OBSERVATION_SCHEMA_ID = schemaId(
  'schema',
  'enriched-observation',
  ENRICHED_OBSERVATION_SCHEMA_VERSION,
);

// Runtime mirror of the TS augmentation: register the first-party slots once, at
// module load. Importing `@disclosureos/schema` is the runtime counterpart to
// importing both satellite packages for their compile-time augmentation.
defaultRegistry
  .register({
    slot: 'observableAssessments',
    owner: '@disclosureos/observables',
    schemaId: OBSERVABLES_SCHEMA_ID,
    version: OBSERVABLES_SCHEMA_VERSION,
    jsonSchema: observablesJsonSchema,
    validate: validateObservableAssessments,
  })
  .register({
    slot: 'origin',
    owner: '@disclosureos/origins',
    schemaId: ORIGINS_SCHEMA_ID,
    version: ORIGINS_SCHEMA_VERSION,
    jsonSchema: originsJsonSchema,
    validate: validateOriginClassification,
  });

/** Strip the standard envelope (`$schema`/`$id`/`x-schema-version`) and pull `$defs` off a slot schema. */
function splitSlotSchema(schema: Record<string, unknown>): {
  body: Record<string, unknown>;
  defs: Record<string, unknown>;
} {
  const { $schema, $id, 'x-schema-version': _version, $defs, ...body } = schema as Record<
    string,
    unknown
  > & { $defs?: Record<string, unknown> };
  void $schema;
  void $id;
  void _version;
  return { body, defs: $defs ?? {} };
}

/**
 * Compose the enriched `Observation` JSON Schema (draft 2020-12) from the records
 * core plus every slot in `registry` (defaults to the first-party
 * {@link defaultRegistry}).
 *
 * The result is the standard enveloped artifact: a `$ref` to `#/$defs/Observation`,
 * where `Observation` carries the records core properties plus one property per
 * registered slot, and `additionalProperties: false` rejects unknown top-level keys.
 */
export function composeObservationSchema(
  registry: ExtensionRegistry = defaultRegistry,
): Record<string, unknown> {
  const records = recordsJsonSchema();
  const defs = structuredClone(records.$defs ?? {}) as Record<string, Record<string, unknown>>;

  const observation = defs['Observation'];
  if (!observation) {
    throw new Error('records schema is missing the "Observation" $def; cannot compose.');
  }

  const slotProperties: Record<string, unknown> = {};

  for (const registration of registry.list()) {
    const { body, defs: slotDefs } = splitSlotSchema(registration.jsonSchema());

    for (const [name, def] of Object.entries(slotDefs)) {
      if (name in defs) {
        throw new Error(
          `$defs collision composing enriched schema: "${name}" is defined by both `
            + `the records core and ${registration.owner}. Slots must own disjoint $defs.`,
        );
      }
      defs[name] = def as Record<string, unknown>;
    }

    slotProperties[registration.slot] = body;
  }

  // Fold the slots in as real properties and close the root: unknown top-level keys
  // are rejected; the `extensions` bag (a named property) keeps the third-party seam.
  observation['properties'] = {
    ...(observation['properties'] as Record<string, unknown> | undefined),
    ...slotProperties,
  };
  observation['additionalProperties'] = false;

  const composed = {
    description:
      'A complete DisclosureOS observation: the records core enriched with observable '
      + 'assessments and origin classification. The portable contract across TypeScript, '
      + 'JSON Schema, and other languages.',
    $ref: '#/$defs/Observation',
    $defs: defs,
  };

  return jsonSchemaEnvelope(composed, {
    id: ENRICHED_OBSERVATION_SCHEMA_ID,
    version: ENRICHED_OBSERVATION_SCHEMA_VERSION,
  });
}
