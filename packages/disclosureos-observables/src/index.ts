// Side-effect import: registers the `observableAssessments` slot on
// `Observation` via module augmentation (see ./augmentation).
import './augmentation';

// === Assessment (shared) ===
export {
  AssessmentLevelSchema,
  ObservableCategorySchema,
  ObservableBaseSchema,
  ObservableDefinitionSchema,
  ObservableAssessmentSchema,
  ObservableClaimSchema,
} from './assessment';
export type {
  AssessmentLevel,
  ObservableCategory,
  ObservableBase,
  ObservableDefinition,
  ObservableAssessment,
  ObservableClaim,
} from './assessment';

// === Technology Observables ===
export {
  TechnologyObservableIdSchema,
  TechnologyObservableSchema,
  TechnologyAssessmentSchema,
} from './technology';
export type {
  TechnologyObservableId,
  TechnologyObservable,
  TechnologyAssessment,
} from './technology';
export { TECHNOLOGY_OBSERVABLES } from './technology';

// === Biologics Observables ===
export {
  BiologicsObservableIdSchema,
  BiologicsObservableSchema,
  BiologicsAssessmentSchema,
} from './biologics';
export type {
  BiologicsObservableId,
  BiologicsObservable,
  BiologicsAssessment,
} from './biologics';
export { BIOLOGICS_OBSERVABLES } from './biologics';

// === Constants ===
export {
  ASSESSMENT_LEVELS,
  OBSERVABLE_CATEGORIES,
  TECHNOLOGY_OBSERVABLE_IDS,
  BIOLOGICS_OBSERVABLE_IDS,
  ALL_OBSERVABLE_IDS,
  ALL_OBSERVABLES,
  ObservableAssessmentMapSchema,
} from './constants';
export type { ObservableId, ObservableAssessmentMap } from './constants';

// === JSON Schema + validation ===
export {
  observablesJsonSchema,
  validateObservableAssessments,
  OBSERVABLES_SCHEMA_VERSION,
  OBSERVABLES_SCHEMA_ID,
} from './schema';

// === Labels ===
export {
  ASSESSMENT_LEVEL_LABELS,
  ASSESSMENT_LEVEL_DESCRIPTIONS,
  OBSERVABLE_CATEGORY_LABELS,
  TECHNOLOGY_OBSERVABLE_LABELS,
  BIOLOGICS_OBSERVABLE_LABELS,
} from './labels';

// === Guards ===
export {
  isAssessmentLevel,
  isObservableCategory,
  isTechnologyObservableId,
  isBiologicsObservableId,
  isObservableId,
} from './guards';

// === Factories ===
export type { AssessmentOptions } from './factories';
export { createObservableClaim } from './factories';

// === Formatters ===
export {
  formatAssessmentLevel,
  formatTechnologyObservable,
  formatBiologicsObservable,
  formatObservableCode,
  formatObservable,
} from './formatters';
