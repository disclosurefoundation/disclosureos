import { createEnumGuard } from '@disclosureos/records/shared';
import type { OCSNodeId } from '../brands';
import { OriginDomainSchema } from '../taxonomy/types';
import {
  OriginClaimSchema,
  ConfidenceDistributionSchema,
} from '../classification/types';
import type { OriginClaim, ConfidenceDistribution } from '../classification/types';
import { ALL_OCS_IDS } from '../constants';

/** Re-exported from the origins brand module so `@disclosureos/origins` stays the home of OCS APIs. */
export type { OCSNodeId };

// Enum guards are built from each schema's `.options` (a plain string tuple) so
// they stay free of Zod's cross-package version brand. Object guards run the
// schema's own `safeParse` (same package, same Zod instance).
export const isOriginDomain = createEnumGuard(OriginDomainSchema.options);
export const isOCSNodeId = createEnumGuard<OCSNodeId>(ALL_OCS_IDS as readonly OCSNodeId[]);

export function isOriginClaim(value: unknown): value is OriginClaim {
  return OriginClaimSchema.safeParse(value).success;
}

export function isConfidenceDistribution(value: unknown): value is ConfidenceDistribution {
  return ConfidenceDistributionSchema.safeParse(value).success;
}
