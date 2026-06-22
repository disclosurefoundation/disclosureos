import { OCS_TAXONOMY } from '../tree';
import type { OCSNode } from '../types';

export const METAPHYSICAL_NODES: readonly OCSNode[] = OCS_TAXONOMY.filter((n) => n.domain === 'metaphysical');
