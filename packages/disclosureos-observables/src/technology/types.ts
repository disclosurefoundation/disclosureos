import { z } from 'zod';
import { ObservableBaseSchema, ObservableAssessmentSchema } from '../assessment/types';

export const TechnologyObservableIdSchema = z
  .enum([
    'apparent_hover',
    'abrupt_motion',
    'hypersonic_signature_discrepancy',
    'sensor_detection_discrepancy',
    'apparent_medium_transition',
    'event_associated_biological_changes',
  ])
  .describe('Identifier of a technology-related characteristic in the DisclosureOS vocabulary. No mechanism or origin is established by the category.');

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
