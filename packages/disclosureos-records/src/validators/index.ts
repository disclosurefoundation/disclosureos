import { ObservationSchema } from '../observation/types';
import { validateWith } from '../shared';
import type { ValidationIssue } from '../shared';

export type { ValidationIssue } from '../shared';

export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && lng >= -180 && lng <= 180;
}

export function isValidISODate(date: string): boolean {
  if (typeof date !== 'string') return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validate an observation against the single source of truth ({@link ObservationSchema}).
 * Returns a flat list of issues (empty when valid). Satellite slots
 * (`observableAssessments`, `origin`, …) are not part of the core schema and are
 * validated by their owning packages; they are ignored here, not rejected.
 */
export function validateObservation(obs: unknown): ValidationIssue[] {
  return validateWith(ObservationSchema, obs);
}
