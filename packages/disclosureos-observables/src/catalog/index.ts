import type { VocabularyCatalog, VocabularyCatalogTerm } from '@disclosureos/records/experimental/v2';
import { ALL_OBSERVABLES } from '../constants';
import { ObservableDefinitionSchema } from '../assessment/types';
import type { ObservableDefinition } from '../assessment/types';

export const OBSERVABLE_CATALOG_ID = 'https://os.disclosure.org/vocabularies/observable-characteristics';
export const OBSERVABLE_TERM_EXTENSION = 'org.disclosureos.observables';

export type ObservableCatalogOptions = Pick<VocabularyCatalog, 'id' | 'revision' | 'publishedBy' | 'publishedAt'>;

/** Creates a snapshot from the current definitions. Retain and hash the serialized bytes before referring to it. */
export function createObservableCatalog(options: ObservableCatalogOptions): VocabularyCatalog {
  return {
    kind: 'vocabulary_catalog',
    schemaVersion: '0.1.0',
    ...options,
    catalogId: OBSERVABLE_CATALOG_ID,
    terms: ALL_OBSERVABLES.map((definition) => {
      const { id, label, description, code, category } = definition;
      const metadata: Record<string, string | string[]> = {
        scientificBasis: definition.scientificBasis,
        detectionSignals: [...definition.detectionSignals],
        methods: [...definition.methods],
      };
      if (definition.caveat !== undefined) metadata.caveat = definition.caveat;
      if (definition.caveatLabel !== undefined) metadata.caveatLabel = definition.caveatLabel;
      if (definition.references !== undefined) metadata.references = [...definition.references];
      return {
        id, label, description, code, category,
        extensions: { [OBSERVABLE_TERM_EXTENSION]: metadata },
      };
    }),
  };
}

/** Reads and validates observable metadata without treating an unrelated term as an observable. */
export function readObservableTermDefinition(term: VocabularyCatalogTerm): ObservableDefinition | undefined {
  const metadata = term.extensions?.[OBSERVABLE_TERM_EXTENSION];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const parsed = ObservableDefinitionSchema.safeParse({
    ...metadata,
    id: term.id,
    label: term.label,
    description: term.description,
    code: term.code,
    category: term.category,
  });
  return parsed.success ? parsed.data : undefined;
}
