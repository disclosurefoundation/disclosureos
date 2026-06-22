/**
 * Nominal "branded" types — TS-only ergonomics that never touch the emitted
 * JSON Schema (Phase 0 confirmed brands are safe but we keep them out of the
 * schema layer for composition clarity). A branded value is the base type at
 * runtime; the brand only constrains assignment at compile time.
 */

declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Validated UUID/identifier for an `Observation`. */
export type ObservationId = Brand<string, 'ObservationId'>;

export function asObservationId(value: string): ObservationId {
  return value as ObservationId;
}
