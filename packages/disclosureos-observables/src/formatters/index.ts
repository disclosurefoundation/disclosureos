import type { AssessmentLevel } from '../assessment/types';
import type { TechnologyObservableId } from '../technology/types';
import type { BiologicsObservableId } from '../biologics/types';
import { ASSESSMENT_LEVEL_LABELS, TECHNOLOGY_OBSERVABLE_LABELS, BIOLOGICS_OBSERVABLE_LABELS } from '../labels';
import { TECHNOLOGY_OBSERVABLES } from '../technology/constants';
import { BIOLOGICS_OBSERVABLES } from '../biologics/constants';
import { isTechnologyObservableId, isBiologicsObservableId } from '../guards';

export function formatAssessmentLevel(level: AssessmentLevel): string {
  return ASSESSMENT_LEVEL_LABELS[level];
}

export function formatTechnologyObservable(id: TechnologyObservableId): string {
  return TECHNOLOGY_OBSERVABLE_LABELS[id];
}

export function formatBiologicsObservable(id: BiologicsObservableId): string {
  return BIOLOGICS_OBSERVABLE_LABELS[id];
}

export function formatObservableCode(id: TechnologyObservableId | BiologicsObservableId): string {
  if (isTechnologyObservableId(id)) return TECHNOLOGY_OBSERVABLES[id].code;
  if (isBiologicsObservableId(id)) return BIOLOGICS_OBSERVABLES[id].code;
  return id;
}

export function formatObservable(id: TechnologyObservableId | BiologicsObservableId): string {
  if (isTechnologyObservableId(id)) return TECHNOLOGY_OBSERVABLE_LABELS[id];
  if (isBiologicsObservableId(id)) return BIOLOGICS_OBSERVABLE_LABELS[id];
  return id;
}
