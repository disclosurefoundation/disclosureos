/**
 * `@disclosureos/schema` — the DisclosureOS portable contract.
 *
 * Composes the records core, observable assessments, and origin classification into
 * one enriched `Observation` — as a TypeScript type ({@link EnrichedObservation}), a
 * JSON Schema ({@link composeObservationSchema}), and a non-stripping validator
 * ({@link parseEnrichedObservation}). Importing this package also registers the
 * first-party slots on the runtime {@link defaultRegistry}.
 */

// === Runtime registry (mirror of the TS augmentation) ===
export { ExtensionRegistry, defaultRegistry } from './registry';
export type { SlotRegistration } from './registry';

// === Composed JSON Schema artifact ===
export {
  composeObservationSchema,
  ENRICHED_OBSERVATION_SCHEMA_VERSION,
  ENRICHED_OBSERVATION_SCHEMA_ID,
} from './compose';

// === Non-stripping parse + the enriched type ===
export { parseEnrichedObservation } from './parse';
export type { EnrichedObservation, EnrichedParseResult } from './parse';
