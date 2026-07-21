import { z } from 'zod';
import { jsonSchemaEnvelope, schemaId } from './shared';
import { ObservationSchema } from './observation/types';

/**
 * Version of the emitted JSON Schema artifact. Bump on any intentional change to
 * the records schema shape; the committed `schema/records.schema.json` and the
 * drift test (`src/__tests__/schema.test.ts`) keep this honest.
 */
export const RECORDS_SCHEMA_VERSION = '1.1.0';

export const RECORDS_SCHEMA_ID = schemaId('records', 'observation', RECORDS_SCHEMA_VERSION);

/**
 * Emit the canonical JSON Schema (draft 2020-12) for the core {@link ObservationSchema}.
 * This is the interop artifact consumed by non-TS toolchains (Pydantic / R) and
 * the docs pipeline. Satellite slots (`observableAssessments`, `origin`, …) are
 * NOT included — they compose in at the all-packages bundling step.
 */
export function recordsJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ObservationSchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;

  // The Observation root is intentionally OPEN: satellite slots
  // (`observableAssessments`, `origin`, …) and the `extensions` bag attach via
  // augmentation and compose in at the all-packages bundling step. Nested domain
  // objects stay closed (additionalProperties:false) for strictness.
  const defs = schema.$defs as Record<string, Record<string, unknown>> | undefined;
  if (defs?.['Observation']) {
    defs['Observation']['additionalProperties'] = true;
  }

  return jsonSchemaEnvelope(schema, { id: RECORDS_SCHEMA_ID, version: RECORDS_SCHEMA_VERSION });
}
