import type { OriginDomain } from '../taxonomy/types';
import { OCS_TAXONOMY } from '../taxonomy/tree';

export const OCS_LABELS: Record<string, string> = Object.fromEntries(
  OCS_TAXONOMY.map((n) => [n.id, n.label]),
);

export const ORIGIN_DOMAIN_LABELS: Record<OriginDomain, string> = {
  physical: 'Physical',
  psychosocial: 'Psychosocial',
  metaphysical: 'Metaphysical',
};
