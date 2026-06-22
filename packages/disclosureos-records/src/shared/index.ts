/**
 * `@disclosureos/records/shared` — the cross-package substrate.
 *
 * Primitives every DisclosureOS package depends on, defined once here so that
 * `observables`, `origins`, and `scoring` type-depend on `records` rather than
 * re-inventing confidence scales, attribution metadata, and enum guards.
 */

export { ConfidenceSchema, isConfidence, assertConfidence, asConfidence } from './confidence';
export type { Confidence } from './confidence';

export { ConfidenceLevelSchema, CONFIDENCE_LEVELS, isConfidenceLevel } from './confidence-level';
export type { ConfidenceLevel } from './confidence-level';

export { AttributionSchema } from './attribution';
export type { Attribution } from './attribution';

export {
  ClaimSchema,
  EVIDENCE_REF_KINDS,
  evidenceRef,
  isEvidenceRef,
  parseEvidenceRef,
} from './claim';
export type { Claim, EvidenceRefKind } from './claim';

export { issuesFrom, validateWith } from './validation';
export type { ValidationIssue } from './validation';

export { jsonSchemaEnvelope, schemaId } from './json-schema';

export { createEnumGuard, makeGuard } from './enum-guard';

export { asObservationId } from './brands';
export type { Brand, ObservationId } from './brands';
