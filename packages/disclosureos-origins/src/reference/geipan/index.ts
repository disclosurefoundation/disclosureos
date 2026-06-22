import { z } from 'zod';

export const GEIPANCategorySchema = z
  .enum(['A', 'B', 'C', 'D1', 'D2'])
  .describe('GEIPAN classification category.');

export type GEIPANCategory = z.infer<typeof GEIPANCategorySchema>;

export const GEIPANClassificationSchema = z
  .object({
    category: GEIPANCategorySchema,
    label: z.string(),
    description: z.string(),
    strangeness: z.enum(['low', 'high']),
    consistency: z.enum(['low', 'high']),
  })
  .meta({ id: 'GEIPANClassification' })
  .describe('A single entry in the GEIPAN classification system.');

export type GEIPANClassification = z.infer<typeof GEIPANClassificationSchema>;

export const GEIPAN_SYSTEM: Record<GEIPANCategory, GEIPANClassification> = {
  A: {
    category: 'A',
    label: 'Identified',
    description: 'Phenomenon fully identified with certainty.',
    strangeness: 'low',
    consistency: 'high',
  },
  B: {
    category: 'B',
    label: 'Probably Identified',
    description: 'Phenomenon likely identified but lacking certainty due to insufficient data.',
    strangeness: 'low',
    consistency: 'low',
  },
  C: {
    category: 'C',
    label: 'Unidentifiable (Insufficient Data)',
    description: 'Cannot be identified due to poor quality or quantity of data.',
    strangeness: 'high',
    consistency: 'low',
  },
  D1: {
    category: 'D1',
    label: 'Unidentified (Strange)',
    description: 'Unidentified despite sufficient data; witnesses credible but description matches known phenomena poorly.',
    strangeness: 'high',
    consistency: 'high',
  },
  D2: {
    category: 'D2',
    label: 'Unidentified (Very Strange)',
    description: 'Unidentified with high-quality data and high strangeness; resists all conventional explanation.',
    strangeness: 'high',
    consistency: 'high',
  },
};

export const GEIPAN_CATEGORIES = GEIPANCategorySchema.options;
