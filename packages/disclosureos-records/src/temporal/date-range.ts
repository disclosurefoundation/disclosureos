import { z } from 'zod';
import { TemporalCertaintySchema } from './certainty';

export const DateGranularitySchema = z
  .enum(['exact', 'month', 'quarter', 'year', 'decade', 'century', 'unknown'])
  .describe('Precision of a date value, from calendar-day (`exact`) to `century`.');

export type DateGranularity = z.infer<typeof DateGranularitySchema>;

export const DateRangeTypeSchema = z
  .enum(['span', 'uncertainty', 'active_period', 'investigation_period', 'observation_window'])
  .describe('What a DateRange represents (a true span vs. an uncertainty window, etc.).');

export type DateRangeType = z.infer<typeof DateRangeTypeSchema>;

/**
 * A single date whose precision is coarser than a calendar day (e.g. "summer 1947").
 * Used as the bounds of a {@link DateRange}; for a top-level observation date,
 * prefer `TemporalData.date` + `dateGranularity` (the flattened form).
 */
export const FuzzyDateSchema = z
  .object({
    value: z
      .string()
      .describe('Machine-comparable anchor (ISO-like, as precise as known, e.g. `1947`, `1947-07`).'),
    granularity: DateGranularitySchema,
    certainty: TemporalCertaintySchema,
    quarter: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe('Calendar quarter (1–4) when granularity is `quarter`.'),
    display: z.string().optional().describe('Human display override, e.g. "Summer 1947".'),
    notes: z.string().optional().describe('Free-text caveats about how this date was determined.'),
  })
  .meta({ id: 'FuzzyDate' })
  .describe('A date whose precision is coarser than a calendar day (e.g. "summer 1947").');

export type FuzzyDate = z.infer<typeof FuzzyDateSchema>;

export const DateRangeSchema = z
  .object({
    start: FuzzyDateSchema,
    end: FuzzyDateSchema,
    type: DateRangeTypeSchema,
    display: z.string().optional().describe('Human display override, e.g. "July–August 1952".'),
    inclusive: z.boolean().optional().describe('Whether the end date is included in the range. Defaults to true.'),
  })
  .meta({ id: 'DateRange' })
  .describe('A period or uncertainty window bounded by two FuzzyDates.');

export type DateRange = z.infer<typeof DateRangeSchema>;

export const RelativeDateSchema = z
  .object({
    referenceEvent: z.string().describe('The event this date is anchored to (e.g. "the crash").'),
    referenceDate: FuzzyDateSchema.optional(),
    relation: z
      .enum(['before', 'after', 'during', 'around'])
      .describe('How this date relates to the reference event.'),
    offset: z
      .object({
        value: z.number(),
        unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months', 'years']),
        approximate: z.boolean().optional(),
      })
      .optional()
      .describe('Distance from the reference event (e.g. value 3, unit "days").'),
    display: z.string().optional().describe('Human display override, e.g. "three days after the crash".'),
  })
  .meta({ id: 'RelativeDate' })
  .describe('A date known only relative to another event (e.g. "3 days after the crash").');

export type RelativeDate = z.infer<typeof RelativeDateSchema>;
