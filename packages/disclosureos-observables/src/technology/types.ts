import { z } from 'zod';
import { ObservableBaseSchema, ObservableAssessmentSchema } from '../assessment/types';

export const TechnologyObservableIdSchema = z
  .enum([
    'antigravity_lift',
    'instantaneous_acceleration',
    'hypersonic_no_signatures',
    'low_observability',
    'transmedium_travel',
    'biological_effects',
  ])
  .describe('Identifier of a Technology observable (the six AATIP-derived characteristics).');

export type TechnologyObservableId = z.infer<typeof TechnologyObservableIdSchema>;

export const TechnologyObservableSchema = ObservableBaseSchema.extend({
  id: TechnologyObservableIdSchema,
  references: z.array(z.string()),
})
  .meta({ id: 'TechnologyObservable' })
  .describe('Definition of a Technology observable.');

export type TechnologyObservable = z.infer<typeof TechnologyObservableSchema>;

export const TechnologyAssessmentSchema = ObservableAssessmentSchema.extend({
  observableId: TechnologyObservableIdSchema,
})
  .meta({ id: 'TechnologyAssessment' })
  .describe('An assessment of a Technology observable.');

export type TechnologyAssessment = z.infer<typeof TechnologyAssessmentSchema>;
