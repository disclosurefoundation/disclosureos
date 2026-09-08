import { z } from 'zod';
import type { Observation } from '@disclosureos/records';
import { deriveFieldPaths } from './field-paths';
import type { FieldPath } from './field-paths';

export type { FieldPath } from './field-paths';
export { deriveFieldPaths } from './field-paths';

export const CompletenessResultSchema = z
  .object({
    total: z.number().int().describe('Total leaf field paths defined by the records schema.'),
    present: z.number().int().describe('How many of those paths carry a value.'),
    percentage: z.number().int().describe('present / total, as a 0–100 integer.'),
    missing: z.array(z.string()).describe('Paths that are absent or empty.'),
    requiredTotal: z.number().int().describe('Count of schema-required leaf paths.'),
    requiredPresent: z.number().int().describe('How many required paths carry a value.'),
    requiredPercentage: z
      .number()
      .int()
      .describe('requiredPresent / requiredTotal, as a 0–100 integer.'),
  })
  .meta({ id: 'CompletenessResult' })
  .describe('How fully an observation populates the records schema.');

export type CompletenessResult = z.infer<typeof CompletenessResultSchema>;

export interface CompletenessOptions {
  /** Override the derived field-path set (defaults to the records schema). */
  paths?: FieldPath[];
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const part of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

// Field paths are stable for a given schema version, so derive once and reuse.
let cachedPaths: FieldPath[] | null = null;
function defaultPaths(): FieldPath[] {
  return (cachedPaths ??= deriveFieldPaths());
}

function pct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

/**
 * Count populated legacy schema field paths. A present value is not necessarily
 * valid, documented, applicable or independently analyzable. Prefer the public
 * getPopulationCoverage name for new callers; legacy behavior remains unchanged.
 */
export function getCompleteness(
  observation: Observation | Record<string, unknown>,
  options?: CompletenessOptions,
): CompletenessResult {
  const record = observation as Record<string, unknown>;
  const paths = options?.paths ?? defaultPaths();
  const missing: string[] = [];
  let present = 0;
  let requiredTotal = 0;
  let requiredPresent = 0;

  for (const field of paths) {
    const ok = isPresent(getNested(record, field.path));
    if (ok) present++;
    else missing.push(field.path);
    if (field.required) {
      requiredTotal++;
      if (ok) requiredPresent++;
    }
  }

  return {
    total: paths.length,
    present,
    percentage: pct(present, paths.length),
    missing,
    requiredTotal,
    requiredPresent,
    requiredPercentage: pct(requiredPresent, requiredTotal),
  };
}
