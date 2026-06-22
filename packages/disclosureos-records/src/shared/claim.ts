import { z } from 'zod';
import { AttributionSchema } from './attribution';

/**
 * Kinds of in-record evidence an `evidenceRef` can point at. Each maps to a
 * collection on the `Observation`:
 *   - `media`     → `Observation.media[].id` / `featuredMedia.id`
 *   - `sensor`    → `Observation.sensorEvidence.sensors[].id`
 *   - `physical`  → `Observation.physicalEvidence[].id`  (extension slot)
 *   - `testimony` → `Observation.testimony[].statementId` (extension slot)
 */
export const EVIDENCE_REF_KINDS = ['media', 'sensor', 'physical', 'testimony'] as const;
export type EvidenceRefKind = (typeof EVIDENCE_REF_KINDS)[number];

const EVIDENCE_REF_PATTERN = new RegExp(`^(${EVIDENCE_REF_KINDS.join('|')}):.+$`);

/**
 * Build a typed evidence reference string, e.g. `evidenceRef('media', 'm1')`
 * → `"media:m1"`. Keep refs as plain strings in the schema so they remain
 * portable to JSON Schema; the `<kind>:<id>` convention is enforced by
 * {@link isEvidenceRef} and produced by this helper.
 */
export function evidenceRef(kind: EvidenceRefKind, id: string): string {
  return `${kind}:${id}`;
}

/** True if `value` matches the `<kind>:<id>` evidence-ref convention. */
export function isEvidenceRef(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_REF_PATTERN.test(value);
}

/** Split an evidence ref into its `{ kind, id }` parts, or `null` if malformed. */
export function parseEvidenceRef(value: string): { kind: EvidenceRefKind; id: string } | null {
  if (!isEvidenceRef(value)) return null;
  const idx = value.indexOf(':');
  return { kind: value.slice(0, idx) as EvidenceRefKind, id: value.slice(idx + 1) };
}

/**
 * A `Claim` is the teachable unit of judgement in DisclosureOS: an
 * {@link AttributionSchema | Attribution} (who evaluated this, when, why) plus
 * the in-record evidence that justifies it. Every evaluative slot
 * (`observableAssessments`, `origin`) is a *list* of claims so the framework can
 * represent the contested verdicts that define UAP data. Opinion/endorsement
 * lives in the scoring layer, never here.
 */
export const ClaimSchema = AttributionSchema.extend({
  evidenceRefs: z
    .array(z.string().min(1))
    .optional()
    .describe('Refs to in-record evidence justifying this claim, e.g. "media:<id>", "sensor:<id>".'),
}).describe('An attributed, evidence-backed assertion (Attribution + the evidence that justifies it).');

export type Claim = z.infer<typeof ClaimSchema>;
