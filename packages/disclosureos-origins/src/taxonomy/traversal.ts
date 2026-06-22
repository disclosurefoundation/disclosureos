import type { OCSNode, OriginDomain } from './types';
import { OCS_TAXONOMY } from './tree';

const nodeMap = new Map<string, OCSNode>(OCS_TAXONOMY.map((n) => [n.id, n]));

export function getNode(id: string): OCSNode | undefined {
  return nodeMap.get(id);
}

export function getChildren(id: string): OCSNode[] {
  const node = nodeMap.get(id);
  if (!node) return [];
  return node.children.map((cid) => nodeMap.get(cid)).filter((n): n is OCSNode => n !== undefined);
}

export function getAncestors(id: string): OCSNode[] {
  const ancestors: OCSNode[] = [];
  let current = nodeMap.get(id);
  while (current?.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

export function getSiblings(id: string): OCSNode[] {
  const node = nodeMap.get(id);
  if (!node?.parentId) return [];
  const parent = nodeMap.get(node.parentId);
  if (!parent) return [];
  return parent.children
    .filter((cid) => cid !== id)
    .map((cid) => nodeMap.get(cid))
    .filter((n): n is OCSNode => n !== undefined);
}

export function getDomain(domain: OriginDomain): OCSNode[] {
  return OCS_TAXONOMY.filter((n) => n.domain === domain);
}

export function getTestableNodes(): OCSNode[] {
  return OCS_TAXONOMY.filter((n) => n.scientificallyTestable);
}

export function getLeafNodes(): OCSNode[] {
  return OCS_TAXONOMY.filter((n) => n.children.length === 0);
}

export function searchNodes(query: string): OCSNode[] {
  const lower = query.toLowerCase();
  return OCS_TAXONOMY.filter(
    (n) =>
      n.label.toLowerCase().includes(lower) ||
      n.description.toLowerCase().includes(lower) ||
      n.aliases?.some((a) => a.toLowerCase().includes(lower)),
  );
}

export function getPath(id: string): string {
  const ancestors = getAncestors(id);
  const node = nodeMap.get(id);
  if (!node) return '';
  return [...ancestors, node].map((n) => n.label).join(' > ');
}
