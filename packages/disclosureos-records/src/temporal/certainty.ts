import { z } from 'zod';

/**
 * How confident we are in a date or time value.
 *
 * The single certainty scale for all temporal values in the model —
 * `TemporalData.date`/`time`, `FuzzyDate`, `DateRange` bounds, and testimony
 * dates all use it.
 */
export const TemporalCertaintySchema = z
  .enum(['exact', 'approximate', 'estimated', 'unknown'])
  .describe('Confidence in a date or time value — the single certainty scale for all temporal values.');

export type TemporalCertainty = z.infer<typeof TemporalCertaintySchema>;
