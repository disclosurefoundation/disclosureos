import { z } from 'zod';
import { jsonSchemaEnvelope, schemaId } from '@disclosureos/records/shared';
import { SensorManifestSchema } from './manifest/types';

/**
 * Version of the emitted JSON Schema artifact. Bump on any intentional change
 * to the manifest shape; the committed `schema/sensor-manifest.schema.json` and
 * the drift test (`src/__tests__/schema.test.ts`) keep this honest.
 */
export const INSTRUMENTS_SCHEMA_VERSION = '1.0.0';

export const INSTRUMENTS_SCHEMA_ID = schemaId(
  'instruments',
  'sensor-manifest',
  INSTRUMENTS_SCHEMA_VERSION,
);

/**
 * Emit the canonical JSON Schema (draft 2020-12) for {@link SensorManifestSchema}.
 * Unlike the satellite slot schemas, this is a standalone document schema — a
 * manifest is published on its own, not composed into `Observation`.
 */
export function instrumentsJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SensorManifestSchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
  return jsonSchemaEnvelope(schema, {
    id: INSTRUMENTS_SCHEMA_ID,
    version: INSTRUMENTS_SCHEMA_VERSION,
  });
}
