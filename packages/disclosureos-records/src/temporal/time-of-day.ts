import { z } from 'zod';

/** Twilight-aware time-of-day bucket for an observation. */
export const TimeOfDaySchema = z
  .enum([
    'astronomical_dawn',
    'nautical_dawn',
    'civil_dawn',
    'sunrise',
    'morning',
    'noon',
    'afternoon',
    'sunset',
    'civil_dusk',
    'nautical_dusk',
    'astronomical_dusk',
    'night',
    'unknown',
  ])
  .describe('Twilight-aware time-of-day bucket for an observation.');

export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;
