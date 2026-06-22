import { z } from 'zod';
import { AssessmentLevelSchema, ObservableCategorySchema } from '../assessment/types';
import { ObservableClaimSchema } from '../assessment/types';
import type { ObservableDefinition } from '../assessment/types';
import { TechnologyObservableIdSchema } from '../technology/types';
import type { TechnologyObservableId } from '../technology/types';
import { BiologicsObservableIdSchema } from '../biologics/types';
import type { BiologicsObservableId } from '../biologics/types';
import { TECHNOLOGY_OBSERVABLES } from '../technology/constants';
import { BIOLOGICS_OBSERVABLES } from '../biologics/constants';

export const ASSESSMENT_LEVELS = AssessmentLevelSchema.options;
export const OBSERVABLE_CATEGORIES = ObservableCategorySchema.options;
export const TECHNOLOGY_OBSERVABLE_IDS = TechnologyObservableIdSchema.options;
export const BIOLOGICS_OBSERVABLE_IDS = BiologicsObservableIdSchema.options;

export const ALL_OBSERVABLE_IDS: readonly (TechnologyObservableId | BiologicsObservableId)[] = [
  ...TECHNOLOGY_OBSERVABLE_IDS,
  ...BIOLOGICS_OBSERVABLE_IDS,
] as const;

export type ObservableId = TechnologyObservableId | BiologicsObservableId;

export const ALL_OBSERVABLES: ObservableDefinition[] = [
  ...Object.values(TECHNOLOGY_OBSERVABLES).map((o) => ({ ...o, category: 'technology' as const })),
  ...Object.values(BIOLOGICS_OBSERVABLES).map((o) => ({ ...o, category: 'biologics' as const })),
];

/**
 * Canonical shape for the `Observation.observableAssessments` slot, registered
 * on `Observation` via module augmentation when this package is imported.
 *
 * Each observable is identified by its map key, and maps to a *list* of
 * {@link ObservableClaimSchema}s — competing verdicts from different evaluators
 * coexist (the inter-claim axis). Endorsement is a scoring concern, not here.
 */
export const ObservableAssessmentMapSchema = z
  .object({
    technology: z
      .partialRecord(TechnologyObservableIdSchema, z.array(ObservableClaimSchema))
      .optional(),
    biologics: z
      .partialRecord(BiologicsObservableIdSchema, z.array(ObservableClaimSchema))
      .optional(),
  })
  .meta({ id: 'ObservableAssessmentMap' })
  .describe('Per-observable claim lists (Technology + Biologics) for an observation.');

export type ObservableAssessmentMap = z.infer<typeof ObservableAssessmentMapSchema>;
