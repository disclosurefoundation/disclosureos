import { z } from 'zod';

export const AAROCategorySchema = z
  .enum([
    'airborne_clutter',
    'natural_atmospheric',
    'usg_industry',
    'foreign_adversary',
    'other_scientific_discovery',
  ])
  .describe('AARO resolution category.');

export type AAROCategory = z.infer<typeof AAROCategorySchema>;

export const AAROClassificationSchema = z
  .object({
    category: AAROCategorySchema,
    label: z.string(),
    description: z.string(),
  })
  .meta({ id: 'AAROClassification' })
  .describe('A single entry in the AARO classification system.');

export type AAROClassification = z.infer<typeof AAROClassificationSchema>;

export const AARO_SYSTEM: Record<AAROCategory, AAROClassification> = {
  airborne_clutter: {
    category: 'airborne_clutter',
    label: 'Airborne Clutter',
    description: 'Birds, balloons, recreational UAVs, or airborne debris such as plastic bags.',
  },
  natural_atmospheric: {
    category: 'natural_atmospheric',
    label: 'Natural Atmospheric Phenomena',
    description: 'Ice crystals, moisture, thermal fluctuations, or other atmospheric effects.',
  },
  usg_industry: {
    category: 'usg_industry',
    label: 'USG or Industry Developmental Programs',
    description: 'Classified or unclassified U.S. government or industry programs.',
  },
  foreign_adversary: {
    category: 'foreign_adversary',
    label: 'Foreign Adversary Systems',
    description: 'Technologies deployed by China, Russia, another nation, or non-governmental entity.',
  },
  other_scientific_discovery: {
    category: 'other_scientific_discovery',
    label: 'Other / Scientific Discovery',
    description: 'Observations that require further scientific study and may represent genuine anomalies.',
  },
};

export const AARO_CATEGORIES = AAROCategorySchema.options;
