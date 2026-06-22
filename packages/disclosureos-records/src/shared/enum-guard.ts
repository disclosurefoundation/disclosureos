/**
 * One canonical enum-guard factory for the whole ecosystem.
 *
 * Replaces the three byte-identical private copies that lived in
 * `records/guards`, `observables/guards`, and `origins/guards`.
 */
export function createEnumGuard<T extends string>(values: readonly T[]) {
  const set = new Set<string>(values);
  return (value: unknown): value is T => typeof value === 'string' && set.has(value);
}

import type { ZodType } from 'zod';

/**
 * Schema-derived type guard. Replaces hand-maintained `createEnumGuard(ARRAY)`
 * calls once a Zod schema is the source of truth — `makeGuard(XSchema)` narrows
 * to the schema's inferred type with no parallel value array to drift.
 */
export function makeGuard<T>(schema: ZodType<T>) {
  return (value: unknown): value is T => schema.safeParse(value).success;
}
