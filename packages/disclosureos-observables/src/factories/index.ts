import { ObservableClaimSchema } from '../assessment/types';
import type { AssessmentLevel, ObservableClaim } from '../assessment/types';

export interface AssessmentOptions {
  /**
   * Confidence in the assessment, between 0 and 1 inclusive.
   * Values outside this range throw (validated by the schema).
   */
  confidence?: number;
  /** Why this assessment was made (shared `Attribution`). */
  rationale?: string;
  /** Who made the assessment (shared `Attribution`). */
  evaluatedBy?: string;
  /** Override the auto-generated timestamp (useful for historical imports and testing). */
  evaluatedAt?: string;
  /** Refs to in-record evidence justifying this claim, e.g. `"media:<id>"` (shared `Claim`). */
  evidenceRefs?: string[];
}

function buildEntryInput(level: AssessmentLevel, options: AssessmentOptions | undefined) {
  const { confidence, rationale, evaluatedBy, evaluatedAt, evidenceRefs } = options ?? {};
  return {
    level,
    evaluatedAt: evaluatedAt ?? new Date().toISOString(),
    ...(confidence !== undefined && { confidence }),
    ...(rationale !== undefined && { rationale }),
    ...(evaluatedBy !== undefined && { evaluatedBy }),
    ...(evidenceRefs !== undefined && { evidenceRefs }),
  };
}

/**
 * Build one map-ready observable claim (no `observableId` — the key supplies
 * it). The slot value is an array of these; push the result into it. Parses
 * against the schema, so an out-of-range confidence throws.
 */
export function createObservableClaim(
  level: AssessmentLevel,
  options?: AssessmentOptions,
): ObservableClaim {
  return ObservableClaimSchema.parse(buildEntryInput(level, options));
}
