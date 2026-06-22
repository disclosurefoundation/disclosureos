import type { OriginClaim } from '../classification/types';
import { OriginDomainSchema } from '../taxonomy/types';
import { OCS_TAXONOMY } from '../taxonomy/tree';

export const ORIGIN_DOMAINS = OriginDomainSchema.options;

/**
 * Provenance of the OCS taxonomy. The three-domain structure (Physical /
 * Psychosocial / Metaphysical) is adapted from Col. Karl Nell's "Proposed
 * Taxonomy of UAP Origin Hypotheses," presented at the Sol Foundation
 * Symposium (Stanford University, November 2023). Surfaced as data so any
 * consumer renders the same credit.
 */
export const OCS_PROVENANCE = {
  author: 'Col. Karl Nell (U.S. Army, ret.)',
  work: 'Proposed Taxonomy of UAP Origin Hypotheses',
  venue: 'Sol Foundation Symposium, Stanford University',
  date: 'November 2023',
} as const;

export const ALL_OCS_IDS: readonly string[] = OCS_TAXONOMY.map((n) => n.id);

export const TESTABLE_IDS: readonly string[] = OCS_TAXONOMY
  .filter((n) => n.scientificallyTestable)
  .map((n) => n.id);

export const LEAF_IDS: readonly string[] = OCS_TAXONOMY
  .filter((n) => n.children.length === 0)
  .map((n) => n.id);

export const PHYSICAL_IDS: readonly string[] = OCS_TAXONOMY
  .filter((n) => n.domain === 'physical')
  .map((n) => n.id);

export const PSYCHOSOCIAL_IDS: readonly string[] = OCS_TAXONOMY
  .filter((n) => n.domain === 'psychosocial')
  .map((n) => n.id);

export const METAPHYSICAL_IDS: readonly string[] = OCS_TAXONOMY
  .filter((n) => n.domain === 'metaphysical')
  .map((n) => n.id);

/**
 * Canonical shape for the `Observation.origin` slot, registered on `Observation`
 * via module augmentation when this package is imported.
 *
 * A *list* of {@link OriginClaim}s: competing classifications from different
 * evaluators coexist without one being privileged (the inter-claim axis).
 *
 * @example
 * ```typescript
 * import type { Observation } from '@disclosureos/records';
 * import '@disclosureos/origins'; // augments Observation with `origin`
 *
 * const obs: Observation = { ...base, origin: [claim] };
 * ```
 */
export type OriginClassificationSlot = OriginClaim[];
