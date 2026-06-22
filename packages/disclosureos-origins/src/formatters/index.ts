import type { OriginDomain, OCSNode } from '../taxonomy/types';
import { OCS_LABELS, ORIGIN_DOMAIN_LABELS } from '../labels';
import { getPath } from '../taxonomy/traversal';

export function formatOCSCode(id: string): string {
  return getPath(id) || id;
}

export function formatDomainLabel(domain: OriginDomain): string {
  return ORIGIN_DOMAIN_LABELS[domain];
}

export function formatNodeLabel(id: string): string {
  return OCS_LABELS[id] ?? id;
}

export function formatTestability(node: OCSNode): string {
  return node.scientificallyTestable
    ? 'Scientifically testable'
    : 'Not empirically falsifiable';
}
