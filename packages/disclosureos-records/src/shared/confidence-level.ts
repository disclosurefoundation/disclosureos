import { z } from 'zod';

/**
 * The single qualitative confidence magnitude for the ecosystem.
 * Merges the former `ConfidenceLevel` (investigation) and `CredibilityRating`
 * (testimony) — which were byte-identical — plus the inline high/medium/low
 * scales in `provenance/digital`.
 *
 * Distinct from `SourceCredibility` (trust tier), `TemporalCertainty` (time
 * precision), and `AssessmentLevel` (evidentiary tier) — those are the other
 * three orthogonal axes and are intentionally NOT merged here.
 */
export const ConfidenceLevelSchema = z
  .enum(['very_high', 'high', 'moderate', 'low', 'very_low', 'unassessed'])
  .describe('Qualitative confidence magnitude.');

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const CONFIDENCE_LEVELS = ConfidenceLevelSchema.options;

export function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return ConfidenceLevelSchema.safeParse(value).success;
}
