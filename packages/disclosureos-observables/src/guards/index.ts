import { createEnumGuard } from '@disclosureos/records/shared';
import { AssessmentLevelSchema, ObservableCategorySchema } from '../assessment/types';
import { TechnologyObservableIdSchema } from '../technology/types';
import { BiologicsObservableIdSchema } from '../biologics/types';
import type { TechnologyObservableId } from '../technology/types';
import type { BiologicsObservableId } from '../biologics/types';

// Enum guards are built from each schema's `.options` (a plain string tuple)
// rather than the Zod schema itself: passing a Zod type across the package
// boundary collides with Zod's internal version brand, whereas the literal
// tuple is brand-free and still schema-derived.
export const isAssessmentLevel = createEnumGuard(AssessmentLevelSchema.options);
export const isObservableCategory = createEnumGuard(ObservableCategorySchema.options);
export const isTechnologyObservableId = createEnumGuard(TechnologyObservableIdSchema.options);
export const isBiologicsObservableId = createEnumGuard(BiologicsObservableIdSchema.options);

export function isObservableId(
  value: unknown,
): value is TechnologyObservableId | BiologicsObservableId {
  return isTechnologyObservableId(value) || isBiologicsObservableId(value);
}
