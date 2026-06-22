import type { TechnologyObservableId } from '../technology/types';
import type { BiologicsObservableId } from '../biologics/types';
import type { AssessmentLevel, ObservableCategory } from '../assessment/types';
import { TECHNOLOGY_OBSERVABLES } from '../technology/constants';
import { BIOLOGICS_OBSERVABLES } from '../biologics/constants';

export const ASSESSMENT_LEVEL_LABELS: Record<AssessmentLevel, string> = {
  not_indicated: 'Not Indicated',
  reported: 'Reported',
  documented: 'Documented',
  measured: 'Measured',
  confirmed: 'Confirmed',
};

/** What qualifies evidence for each tier of the assessment ladder. */
export const ASSESSMENT_LEVEL_DESCRIPTIONS: Record<AssessmentLevel, string> = {
  not_indicated: 'Nothing in the record indicates this observable was present.',
  reported: 'Witness testimony or claims describe the signal, with no supporting documentation.',
  documented: 'Written records, photographs, or contemporaneous documentation of the signal exist.',
  measured: 'Quantitative instrument data captured the signal — radar, FLIR, or other sensors.',
  confirmed: 'Peer-reviewed analysis with independent verification establishes the signal.',
};

export const OBSERVABLE_CATEGORY_LABELS: Record<ObservableCategory, string> = {
  technology: 'Technology Observable',
  biologics: 'Biologics Observable',
};

export const TECHNOLOGY_OBSERVABLE_LABELS: Record<TechnologyObservableId, string> =
  Object.fromEntries(
    Object.entries(TECHNOLOGY_OBSERVABLES).map(([id, obs]) => [id, obs.label]),
  ) as Record<TechnologyObservableId, string>;

export const BIOLOGICS_OBSERVABLE_LABELS: Record<BiologicsObservableId, string> =
  Object.fromEntries(
    Object.entries(BIOLOGICS_OBSERVABLES).map(([id, obs]) => [id, obs.label]),
  ) as Record<BiologicsObservableId, string>;
