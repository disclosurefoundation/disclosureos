import { z } from 'zod';

/**
 * Shared "who evaluated this, when, and why" mixin.
 *
 * Replaces the divergent metadata that observables (`assessedAt`/`assessedBy`/
 * `notes`) and origins (`assignedAt`/`assignedBy`/`reasoning`) each invented.
 * Any human/agent judgement surface composes these fields rather than
 * re-declaring its own.
 */
export const AttributionSchema = z
  .object({
    evaluatedAt: z.iso
      .datetime()
      .optional()
      .describe('When this judgement was made (ISO 8601 datetime).'),
    evaluatedBy: z
      .string()
      .optional()
      .describe('Who made this judgement — a person, agency, or agent identifier.'),
    rationale: z
      .string()
      .optional()
      .describe("Why this judgement was reached — the evaluator's stated reasoning."),
  })
  .describe('Who evaluated this, when, and why.');

export type Attribution = z.infer<typeof AttributionSchema>;
