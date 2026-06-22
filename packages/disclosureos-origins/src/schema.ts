import { z } from 'zod';
import { jsonSchemaEnvelope, schemaId, validateWith } from '@disclosureos/records/shared';
import type { ValidationIssue } from '@disclosureos/records/shared';
import { OriginClaimSchema } from './classification/types';
import { getNode } from './taxonomy/traversal';

export const ORIGINS_SCHEMA_VERSION = '2.0.0';

export const ORIGINS_SCHEMA_ID = schemaId(
  'origins',
  'origin-classification',
  ORIGINS_SCHEMA_VERSION,
);

/** The `Observation.origin` slot: a list of competing {@link OriginClaimSchema}s. */
const OriginSlotSchema = z
  .array(OriginClaimSchema)
  .describe('Competing origin claims for an observation (one per evaluator/verdict).');

/**
 * Emit the JSON Schema (draft 2020-12) for the `origin` slot payload — an array
 * of {@link OriginClaimSchema}.
 */
export function originsJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(OriginSlotSchema, {
    target: 'draft-2020-12',
  }) as Record<string, unknown>;
  return jsonSchemaEnvelope(schema, { id: ORIGINS_SCHEMA_ID, version: ORIGINS_SCHEMA_VERSION });
}

function checkClaimNodes(claim: unknown, prefix: string, issues: ValidationIssue[]): void {
  const c = claim as { primaryHypothesis?: unknown; alternativeHypotheses?: unknown };
  if (typeof c.primaryHypothesis === 'string' && !getNode(c.primaryHypothesis)) {
    issues.push({
      path: `${prefix}primaryHypothesis`,
      message: `unknown OCS node id: ${c.primaryHypothesis}`,
    });
  }
  if (Array.isArray(c.alternativeHypotheses)) {
    c.alternativeHypotheses.forEach((alt, i) => {
      const nodeId = (alt as { nodeId?: unknown } | undefined)?.nodeId;
      if (typeof nodeId === 'string' && !getNode(nodeId)) {
        issues.push({
          path: `${prefix}alternativeHypotheses.${i}.nodeId`,
          message: `unknown OCS node id: ${nodeId}`,
        });
      }
    });
  }
}

/**
 * Validate an `origin` slot value (a list of {@link OriginClaimSchema}) against
 * the schema, then verify that every referenced OCS node actually exists in the
 * taxonomy.
 *
 * The node-existence check lives HERE (not as a schema `.refine`) so the emitted
 * JSON Schema stays clean/serializable, while the validator, the
 * `createOriginClaim` factory, and the CLI all enforce the same "is this a real
 * OCS node?" rule — one answer to "is this origin valid?".
 */
export function validateOriginClassification(value: unknown): ValidationIssue[] {
  const structural = validateWith(OriginSlotSchema, value);
  if (structural.length > 0) return structural;

  const issues: ValidationIssue[] = [];
  (value as unknown[]).forEach((claim, i) => {
    checkClaimNodes(claim, `${i}.`, issues);
  });
  return issues;
}
