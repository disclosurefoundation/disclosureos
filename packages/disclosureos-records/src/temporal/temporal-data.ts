import { z } from 'zod';
import { TemporalCertaintySchema } from './certainty';
import { TimeOfDaySchema } from './time-of-day';
import { DateGranularitySchema, DateRangeSchema, RelativeDateSchema } from './date-range';

export const TemporalDataSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid ISO date (YYYY-MM-DD)')
      .describe(
        'Canonical, machine-sortable date anchor in ISO YYYY-MM-DD form. ALWAYS present, even when the true date is fuzzy or a range — set it to the best single representative. Express nuance via dateGranularity, dateRange, or relativeDate.',
      ),
    dateCertainty: TemporalCertaintySchema,
    dateGranularity: DateGranularitySchema.optional().describe(
      'Precision of `date`. Defaults to day-level when omitted (e.g. "July 1947" → date "1947-07-01", dateGranularity "month").',
    ),
    time: z.string().optional().describe('Local clock time of the observation (HH:MM or HH:MM:SS, 24-hour).'),
    timezone: z.string().optional().describe('IANA timezone of the local time (e.g. "America/Los_Angeles").'),
    utcTime: z.string().optional().describe('Observation time converted to UTC, when known.'),
    timeCertainty: TemporalCertaintySchema.optional(),
    durationSeconds: z.number().optional().describe('How long the observation lasted, in seconds.'),
    durationDescription: z
      .string()
      .optional()
      .describe('Duration as reported when not precisely known (e.g. "several minutes").'),
    timeOfDay: TimeOfDaySchema.optional(),
    isDaylightSaving: z
      .boolean()
      .optional()
      .describe('Whether daylight saving time was in effect at the local time.'),
    moonPhase: z
      .number()
      .optional()
      .describe('Moon phase at the time of observation (0 = new moon, 0.5 = full, 1 = new).'),
    moonIllumination: z
      .number()
      .optional()
      .describe('Fraction of the moon illuminated at the time of observation (0–1).'),
    dateRange: DateRangeSchema.optional().describe(
      'For events spanning a period or with a genuine uncertainty window. `date` should still anchor within/at the range.',
    ),
    relativeDate: RelativeDateSchema.optional().describe(
      'For dates known only relative to another event (e.g. "3 days after the crash").',
    ),
  })
  .meta({ id: 'TemporalData' })
  .describe('When an observation occurred — a sortable anchor date plus optional fuzzy/range/relative nuance.');

export type TemporalData = z.infer<typeof TemporalDataSchema>;
