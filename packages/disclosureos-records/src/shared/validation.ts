import type { ZodError } from 'zod';

/**
 * A single, flat validation problem. Shared by the hand-rolled
 * `validateObservation` and the schema-driven path so every package speaks one
 * issue shape (`{ path, message }`).
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Map a `ZodError` into the ecosystem's flat issue shape. Lets schema-based
 * validation and the legacy hand-rolled validator return identical structures.
 */
export function issuesFrom(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/**
 * Validate a value against any Zod schema and return the flat issue list (empty
 * when valid) — the ecosystem's single validation contract, so the per-package
 * `validateX` functions don't each re-write `safeParse` + `issuesFrom`.
 *
 * Typed STRUCTURALLY (just needs `.safeParse`) so it stays free of Zod's
 * cross-package version brand when called from `observables`/`origins`.
 */
export function validateWith(
  schema: { safeParse(value: unknown): { success: true } | { success: false; error: ZodError } },
  value: unknown,
): ValidationIssue[] {
  const result = schema.safeParse(value);
  return result.success ? [] : issuesFrom(result.error);
}
