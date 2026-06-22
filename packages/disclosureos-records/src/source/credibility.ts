import { z } from 'zod';

export const SourceCredibilitySchema = z
  .enum(['official', 'verified', 'credible', 'unverified', 'questionable', 'disputed', 'unknown'])
  .describe('Trust tier of a source — an orthogonal axis to confidence and temporal certainty.');

export type SourceCredibility = z.infer<typeof SourceCredibilitySchema>;
