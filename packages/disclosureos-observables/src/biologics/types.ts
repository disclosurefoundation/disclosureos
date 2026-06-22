import { z } from 'zod';
import { ObservableBaseSchema, ObservableAssessmentSchema } from '../assessment/types';

export const BiologicsObservableIdSchema = z
  .enum([
    'molecular_complexity',
    'isotopic_provenance',
    'non_standard_biochemistry',
    'non_phylogenetic_genetics',
    'anomalous_morphology',
    'anomalous_bio_interaction',
  ])
  .describe('Identifier of a Biologics observable.');

export type BiologicsObservableId = z.infer<typeof BiologicsObservableIdSchema>;

export const BiologicsObservableSchema = ObservableBaseSchema.extend({
  id: BiologicsObservableIdSchema,
  references: z.array(z.string()),
})
  .meta({ id: 'BiologicsObservable' })
  .describe('Definition of a Biologics observable.');

export type BiologicsObservable = z.infer<typeof BiologicsObservableSchema>;

export const BiologicsAssessmentSchema = ObservableAssessmentSchema.extend({
  observableId: BiologicsObservableIdSchema,
})
  .meta({ id: 'BiologicsAssessment' })
  .describe('An assessment of a Biologics observable.');

export type BiologicsAssessment = z.infer<typeof BiologicsAssessmentSchema>;
