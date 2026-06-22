import { z } from 'zod';
import { ClaimSchema, ConfidenceSchema } from '@disclosureos/records/shared';

/**
 * A weighted origin hypothesis: an OCS node id plus the confidence assigned to it.
 */
export const HypothesisWeightSchema = z
  .object({
    nodeId: z.string().min(1).describe('OCS node id (e.g., "1.1.3").'),
    confidence: ConfidenceSchema,
    label: z.string().optional(),
  })
  .meta({ id: 'HypothesisWeight' })
  .describe('A weighted origin hypothesis (OCS node + confidence).');

export type HypothesisWeight = z.infer<typeof HypothesisWeightSchema>;

/**
 * A single attributed origin claim — one evaluator's verdict on what an
 * observation is: a primary OCS hypothesis with its confidence, optional
 * `alternativeHypotheses` (the intra-claim axis), and the shared {@link ClaimSchema}
 * envelope (`evaluatedAt` / `evaluatedBy` / `rationale` + `evidenceRefs`).
 *
 * The `Observation.origin` slot is a *list* of these (the inter-claim axis), so
 * competing classifications from different evaluators coexist without one being
 * privileged — endorsement is a scoring concern, not a records one.
 */
export const OriginClaimSchema = ClaimSchema.extend({
  primaryHypothesis: z.string().min(1).describe('OCS node id of the primary hypothesis.'),
  confidence: ConfidenceSchema.describe('Confidence in the primary hypothesis, in [0,1].'),
  alternativeHypotheses: z
    .array(HypothesisWeightSchema)
    .optional()
    .describe(
      'Other OCS hypotheses this same evaluator weighs as possible, each with its own confidence — the intra-claim uncertainty axis.',
    ),
})
  .meta({ id: 'OriginClaim' })
  .describe('An attributed origin-hypothesis classification for an observation.');

export type OriginClaim = z.infer<typeof OriginClaimSchema>;

/**
 * A full distribution of confidence across hypotheses, with `unresolved` holding
 * the remaining confidence not assigned to any hypothesis.
 */
export const ConfidenceDistributionSchema = z
  .object({
    hypotheses: z.array(HypothesisWeightSchema),
    unresolved: ConfidenceSchema.describe('Remaining confidence not assigned to any hypothesis.'),
    evaluatedAt: z.iso.datetime(),
  })
  .meta({ id: 'ConfidenceDistribution' })
  .describe('Confidence distribution across origin hypotheses.');

export type ConfidenceDistribution = z.infer<typeof ConfidenceDistributionSchema>;

/**
 * Simplified category-level confidence distribution for quick classification.
 * Each key maps to a broad OCS category. Values are confidence levels (0-1) that should sum to ~1.0.
 *
 * - `conventional` → OCS 1.1.1 (Prosaic explanations)
 * - `cryptoterrestrial` → OCS 1.1.2 (Hidden Earth-based entities)
 * - `extraterrestrial` → OCS 1.1.3 (Off-world visitors)
 * - `extradimensional` → OCS 1.2 (Other dimensions)
 * - `interdimensional` → OCS 1.3 (Dimension-traversing)
 * - `psychosocial` → OCS 2.0 (Perceptual/social factors)
 * - `metaphysical` → OCS 3.0 (Beyond conventional science)
 * - `insufficientData` → Cannot classify due to lack of information
 */
export const CategoryConfidenceSchema = z
  .object({
    conventional: ConfidenceSchema,
    cryptoterrestrial: ConfidenceSchema,
    extraterrestrial: ConfidenceSchema,
    extradimensional: ConfidenceSchema,
    interdimensional: ConfidenceSchema,
    psychosocial: ConfidenceSchema,
    metaphysical: ConfidenceSchema,
    insufficientData: ConfidenceSchema,
  })
  .meta({ id: 'CategoryConfidence' })
  .describe('Quick category-level confidence distribution across broad OCS categories.');

export type CategoryConfidence = z.infer<typeof CategoryConfidenceSchema>;
