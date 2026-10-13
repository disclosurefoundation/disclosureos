import type { VocabularyCatalog, VocabularyCatalogTerm } from '@disclosureos/records/experimental/v2';
import { OCS_TAXONOMY } from '../taxonomy/tree';
import { OCSNodeSchema } from '../taxonomy/types';
import type { OCSNode } from '../taxonomy/types';
import { OCS_PROVENANCE } from '../constants';

export const ORIGIN_CATALOG_ID = 'https://os.disclosure.org/vocabularies/origin-hypotheses';
export const ORIGIN_TERM_EXTENSION = 'org.disclosureos.origins';

export type OriginCatalogOptions = Pick<VocabularyCatalog, 'id' | 'revision' | 'publishedBy' | 'publishedAt'>;

/** Exports the OCS taxonomy using the shared vocabulary envelope. Membership does not establish an origin. */
export function createOriginCatalog(options: OriginCatalogOptions): VocabularyCatalog {
  return {
    kind: 'vocabulary_catalog',
    schemaVersion: '0.1.0',
    ...options,
    catalogId: ORIGIN_CATALOG_ID,
    extensions: { [ORIGIN_TERM_EXTENSION]: { provenance: { ...OCS_PROVENANCE } } },
    terms: OCS_TAXONOMY.map((node) => {
      const { id, label, description, domain } = node;
      const metadata: Record<string, string | string[] | number | boolean | null> = {
        depth: node.depth,
        parentId: node.parentId,
        children: [...node.children],
        scientificallyTestable: node.scientificallyTestable,
      };
      if (node.aliases !== undefined) metadata.aliases = [...node.aliases];
      return {
        id, label, description, category: domain,
        extensions: { [ORIGIN_TERM_EXTENSION]: metadata },
      };
    }),
  };
}

/** Reads package-owned OCS metadata; unknown or malformed metadata is not a typed OCS node. */
export function readOriginTermDefinition(term: VocabularyCatalogTerm): OCSNode | undefined {
  const metadata = term.extensions?.[ORIGIN_TERM_EXTENSION];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const parsed = OCSNodeSchema.safeParse({
    ...metadata,
    id: term.id,
    label: term.label,
    description: term.description,
    domain: term.category,
  });
  return parsed.success ? parsed.data : undefined;
}
