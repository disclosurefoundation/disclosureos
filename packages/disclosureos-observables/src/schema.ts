import { z } from 'zod';
import { jsonSchemaEnvelope, schemaId, validateWith } from '@disclosureos/records/shared';
import type { ValidationIssue } from '@disclosureos/records/shared';
import { ObservableAssessmentMapSchema } from './constants';

export const OBSERVABLES_SCHEMA_VERSION = '2.0.0';

export const OBSERVABLES_SCHEMA_ID = schemaId(
  'observables',
  'observable-assessments',
  OBSERVABLES_SCHEMA_VERSION,
);

/**
 * Emit the JSON Schema (draft 2020-12) for the `observableAssessments` slot
 * payload ({@link ObservableAssessmentMapSchema}).
 */
export function observablesJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ObservableAssessmentMapSchema, {
    target: 'draft-2020-12',
  }) as Record<string, unknown>;
  return jsonSchemaEnvelope(schema, {
    id: OBSERVABLES_SCHEMA_ID,
    version: OBSERVABLES_SCHEMA_VERSION,
  });
}

/**
 * Validate an `observableAssessments` slot value against the schema. Returns a
 * flat list of issues (empty when valid) — the package's single validation contract.
 */
export function validateObservableAssessments(value: unknown): ValidationIssue[] {
  return validateWith(ObservableAssessmentMapSchema, value);
}
