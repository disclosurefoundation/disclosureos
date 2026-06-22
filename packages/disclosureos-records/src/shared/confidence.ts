import { z } from 'zod';
import type { Brand } from './brands';

/**
 * The single continuous confidence primitive for the whole ecosystem.
 * A normalized probability in [0,1]. Plain number in the schema (serializable);
 * the branded {@link Confidence} alias is the TS-only ergonomic layer.
 *
 * Replaces the independently-defined `confidence: number` + ad-hoc validators
 * in `@disclosureos/observables` and `@disclosureos/origins`.
 */
export const ConfidenceSchema = z
  .number()
  .min(0)
  .max(1)
  .describe('Normalized confidence in [0,1].');

export type Confidence = Brand<number, 'Confidence'>;

export function isConfidence(value: unknown): value is Confidence {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

export function assertConfidence(value: number, label = 'confidence'): asserts value is Confidence {
  if (!(value >= 0 && value <= 1)) {
    throw new RangeError(`${label} must be between 0 and 1, got ${value}`);
  }
}

export function asConfidence(value: number, label = 'confidence'): Confidence {
  assertConfidence(value, label);
  return value as Confidence;
}
