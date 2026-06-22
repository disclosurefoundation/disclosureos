import { z } from 'zod';
import { jsonSchemaEnvelope, schemaId } from '@disclosureos/records/shared';
import { CompletenessResultSchema } from './completeness';
import { ScoreResultSchema, CompellingnessWeightsSchema } from './compellingness';

export const SCORING_SCHEMA_VERSION = '2.0.0';

export const SCORING_SCHEMA_ID = schemaId('scoring', 'scoring', SCORING_SCHEMA_VERSION);

/**
 * Emit the JSON Schema (draft 2020-12) for the scoring output shapes
 * ({@link CompletenessResultSchema}, {@link ScoreResultSchema}) so downstream
 * consumers (and other languages) can validate stored scores.
 */
export function scoringJsonSchema(): Record<string, unknown> {
  const bundle = z.toJSONSchema(
    z.object({
      completeness: CompletenessResultSchema,
      compellingness: ScoreResultSchema,
      weights: CompellingnessWeightsSchema,
    }),
    { target: 'draft-2020-12' },
  ) as Record<string, unknown>;
  return jsonSchemaEnvelope(bundle, { id: SCORING_SCHEMA_ID, version: SCORING_SCHEMA_VERSION });
}
