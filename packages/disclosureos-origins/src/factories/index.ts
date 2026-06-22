import {
  OriginClaimSchema,
  ConfidenceDistributionSchema,
} from '../classification/types';
import type {
  OriginClaim,
  ConfidenceDistribution,
  HypothesisWeight,
} from '../classification/types';
import { getNode } from '../taxonomy/traversal';

export interface ClassificationOptions {
  alternativeHypotheses?: HypothesisWeight[];
  /** Why this classification was assigned (shared `Attribution`). */
  rationale?: string;
  /** Who assigned the classification (shared `Attribution`). */
  evaluatedBy?: string;
  /** Override the auto-generated timestamp (shared `Attribution`). */
  evaluatedAt?: string;
  /** Refs to in-record evidence justifying this claim, e.g. `"sensor:<id>"` (shared `Claim`). */
  evidenceRefs?: string[];
}

function assertKnownNode(nodeId: string, label: string): void {
  if (!getNode(nodeId)) {
    throw new Error(`Unknown OCS node ID in ${label}: "${nodeId}"`);
  }
}

/**
 * Build one {@link OriginClaim} (a single evaluator's verdict). The
 * `Observation.origin` slot holds an array of these — push the result into it,
 * or build several to represent competing classifications.
 */
export function createOriginClaim(
  primaryHypothesis: string,
  confidence: number,
  options?: ClassificationOptions,
): OriginClaim {
  assertKnownNode(primaryHypothesis, 'primaryHypothesis');
  const { alternativeHypotheses, rationale, evaluatedBy, evaluatedAt, evidenceRefs } = options ?? {};
  for (const alt of alternativeHypotheses ?? []) {
    assertKnownNode(alt.nodeId, 'alternativeHypothesis');
  }
  // `.parse()` validates structure + confidence ranges (incl. alternatives).
  return OriginClaimSchema.parse({
    primaryHypothesis,
    confidence,
    evaluatedAt: evaluatedAt ?? new Date().toISOString(),
    ...(alternativeHypotheses !== undefined && { alternativeHypotheses }),
    ...(rationale !== undefined && { rationale }),
    ...(evaluatedBy !== undefined && { evaluatedBy }),
    ...(evidenceRefs !== undefined && { evidenceRefs }),
  });
}

export function createConfidenceDistribution(
  hypotheses: HypothesisWeight[],
  options?: { evaluatedAt?: string },
): ConfidenceDistribution {
  for (const h of hypotheses) {
    assertKnownNode(h.nodeId, 'hypothesis');
  }
  const total = hypotheses.reduce((sum, h) => sum + h.confidence, 0);
  if (total > 1 + 1e-9) {
    throw new RangeError(`hypothesis confidences sum to ${total}, exceeding 1.0`);
  }
  return ConfidenceDistributionSchema.parse({
    hypotheses,
    unresolved: Math.max(0, 1 - total),
    evaluatedAt: options?.evaluatedAt ?? new Date().toISOString(),
  });
}
