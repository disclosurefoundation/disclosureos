import { OCS_TAXONOMY } from '../tree';
import type { OCSNode } from '../types';

export const PHYSICAL_NODES: readonly OCSNode[] = OCS_TAXONOMY.filter((n) => n.domain === 'physical');
