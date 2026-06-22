// Side-effect import: registers the `origin` slot on `Observation` via
// module augmentation (see ./augmentation).
import './augmentation';

// === Taxonomy ===
export type {
  OCSNode,
  OriginDomain,
  PhysicalSubdomain,
  PsychosocialSubdomain,
  MetaphysicalSubdomain,
  OriginSubdomain,
} from './taxonomy';
export {
  OCSNodeSchema,
  OriginDomainSchema,
  PhysicalSubdomainSchema,
  PsychosocialSubdomainSchema,
  MetaphysicalSubdomainSchema,
  OriginSubdomainSchema,
} from './taxonomy';
export { OCS_TAXONOMY } from './taxonomy';
export {
  getNode,
  getChildren,
  getAncestors,
  getSiblings,
  getDomain,
  getTestableNodes,
  getLeafNodes,
  searchNodes,
  getPath,
} from './taxonomy';
export { PHYSICAL_NODES } from './taxonomy';
export { PSYCHOSOCIAL_NODES } from './taxonomy';
export { METAPHYSICAL_NODES } from './taxonomy';

// === Classification ===
export type {
  HypothesisWeight,
  OriginClaim,
  ConfidenceDistribution,
  CategoryConfidence,
} from './classification';
export {
  HypothesisWeightSchema,
  OriginClaimSchema,
  ConfidenceDistributionSchema,
  CategoryConfidenceSchema,
} from './classification';

// === Reference Systems ===
// Hynek / Vallée / AARO / GEIPAN are reachable only via their `./reference/*`
// subpaths — kept off the root barrel so the core import surface is the OCS
// taxonomy + classification, not the comparative reference systems.

// === Labels ===
export { OCS_LABELS, ORIGIN_DOMAIN_LABELS } from './labels';

// === Constants ===
export {
  ORIGIN_DOMAINS,
  OCS_PROVENANCE,
  ALL_OCS_IDS,
  TESTABLE_IDS,
  LEAF_IDS,
  PHYSICAL_IDS,
  PSYCHOSOCIAL_IDS,
  METAPHYSICAL_IDS,
} from './constants';
export type { OriginClassificationSlot } from './constants';

// === Brands ===
export { asOCSNodeId } from './brands';
export type { OCSNodeId } from './brands';

// === Guards ===
export {
  isOriginDomain,
  isOCSNodeId,
  isOriginClaim,
  isConfidenceDistribution,
} from './guards';
// The [0,1] confidence guard is records' shared `isConfidence` — re-exported
// here (replacing the old duplicate `isValidConfidence`) so origins consumers keep
// a single, canonical confidence check.
export { isConfidence } from '@disclosureos/records/shared';

// === Factories ===
export type { ClassificationOptions } from './factories';
export { createOriginClaim, createConfidenceDistribution } from './factories';

// === Formatters ===
export { formatOCSCode, formatDomainLabel, formatNodeLabel, formatTestability } from './formatters';

// === JSON Schema + validation ===
export {
  originsJsonSchema,
  validateOriginClassification,
  ORIGINS_SCHEMA_VERSION,
  ORIGINS_SCHEMA_ID,
} from './schema';
