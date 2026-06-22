/**
 * `parseEnrichedObservation()` — the non-stripping validation entry point.
 *
 * The records core `ObservationSchema` does not know about the satellite slots, so
 * a raw `ObservationSchema.parse(record)` SILENTLY DROPS `observableAssessments` and
 * `origin` (the A1 "strip hazard"). This function closes that hazard at the
 * integration layer: it validates the core and each present slot with the SAME
 * canonical validators each package ships, rejects unknown top-level keys, and
 * returns the caller's object untouched on success — slots intact.
 *
 * It composes by delegation (not by re-parsing through one mega-Zod-object), so it
 * is brand-free: each package validates its own slot with its own Zod instance,
 * exactly as the CLI does.
 */
import { validateObservation } from '@disclosureos/records';
import type { Observation } from '@disclosureos/records';
import type { ValidationIssue } from '@disclosureos/records/shared';
import { composeObservationSchema } from './compose';
import { defaultRegistry } from './registry';

/**
 * A complete observation: the records core plus the satellite slots. Because both
 * satellite packages augment `Observation`, the slots are already part of the
 * `Observation` type wherever `@disclosureos/schema` (which imports both) is loaded;
 * this alias names that enriched shape explicitly as the public contract type.
 */
export type EnrichedObservation = Observation;

/** Outcome of {@link parseEnrichedObservation}: issues are empty iff `success`. */
export interface EnrichedParseResult {
  success: boolean;
  /** The validated record (reference-equal to the input) when `success`. */
  data?: EnrichedObservation;
  /** Flat list of validation issues (empty when valid). */
  issues: ValidationIssue[];
}

/** Prefix slot-local issue paths with the slot name so errors point at the right field. */
function underSlot(slot: string, issues: ValidationIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path ? `${slot}.${issue.path}` : slot,
    message: issue.message,
  }));
}

// The composed schema is the single source of truth for which top-level keys are
// allowed (records core properties + every registered slot). Computed once.
let allowedTopLevelKeys: Set<string> | undefined;
function getAllowedTopLevelKeys(): Set<string> {
  if (!allowedTopLevelKeys) {
    const composed = composeObservationSchema();
    const observation = (composed.$defs as Record<string, Record<string, unknown>>)['Observation'];
    const properties = (observation?.['properties'] as Record<string, unknown>) ?? {};
    allowedTopLevelKeys = new Set(Object.keys(properties));
  }
  return allowedTopLevelKeys;
}

/**
 * Validate an enriched observation (records core + `observableAssessments` + `origin`)
 * in one call, WITHOUT stripping the satellite slots.
 *
 * Returns `{ success: true, data }` (where `data` is the same object you passed in)
 * when valid, or `{ success: false, issues }` with a flat list of path-tagged issues.
 * Unknown top-level keys are rejected; arbitrary data still belongs under `extensions`.
 */
export function parseEnrichedObservation(value: unknown): EnrichedParseResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { success: false, issues: [{ path: '', message: 'expected an observation object' }] };
  }

  const record = value as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  issues.push(...validateObservation(record));

  // Validate every present slot with its owner's validator — driven by the registry,
  // so a newly registered slot is validated here without editing this function.
  for (const registration of defaultRegistry.list()) {
    const slotValue = record[registration.slot];
    if (slotValue !== undefined) {
      issues.push(...underSlot(registration.slot, registration.validate(slotValue)));
    }
  }

  const allowed = getAllowedTopLevelKeys();
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      issues.push({
        path: key,
        message: `unknown top-level key "${key}" — third-party data belongs under "extensions".`,
      });
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }
  return { success: true, data: record as unknown as EnrichedObservation, issues: [] };
}
