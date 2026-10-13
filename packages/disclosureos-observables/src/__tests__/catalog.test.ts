import { describe, expect, it } from 'vitest';
import { ALL_OBSERVABLES, ALL_OBSERVABLE_IDS } from '../constants';
import { ObservableDefinitionSchema } from '../assessment/types';
import { createObservableCatalog, readObservableTermDefinition, OBSERVABLE_TERM_EXTENSION } from '../catalog';
import { isObservableId } from '../guards';
import { readFileSync } from 'node:fs';

const options = { id: 'observables-v2-baseline', revision: '2026-10-13.1', publishedBy: 'Disclosure Foundation', publishedAt: '2026-10-13T00:00:00Z' };

describe('observable vocabulary baseline', () => {
  it('keeps the reviewed definitions, enums and runtime catalog in agreement', () => {
    const review = JSON.parse(readFileSync(new URL('../../../../docs/rfcs/0007-vocabulary/observable-catalog-proposal.json', import.meta.url), 'utf8'));
    expect(ALL_OBSERVABLES).toEqual(review.terms);
    expect(ALL_OBSERVABLES.map((term) => term.id)).toEqual(ALL_OBSERVABLE_IDS);
    expect(new Set(ALL_OBSERVABLES.map((term) => term.code)).size).toBe(12);
    for (const term of ALL_OBSERVABLES) {
      expect(ObservableDefinitionSchema.safeParse(term).success).toBe(true);
      expect(isObservableId(term.id)).toBe(true);
      expect(term.caveat).toBeTruthy();
      expect(term.references?.length).toBeGreaterThan(0);
    }
    expect(isObservableId('antigravity_lift')).toBe(false);
  });

  it('retains every definition and its methodological qualification in the shared catalog', () => {
    const catalog = createObservableCatalog(options);
    expect(catalog.catalogId).toBe('https://os.disclosure.org/vocabularies/observable-characteristics');
    expect(catalog.terms.map(readObservableTermDefinition)).toEqual(ALL_OBSERVABLES);
    expect(catalog.revision).toBe(options.revision);
  });

  it('does not share mutable domain metadata with another catalog or package constants', () => {
    const first = createObservableCatalog(options);
    const metadata = first.terms[0]!.extensions![OBSERVABLE_TERM_EXTENSION] as { methods: string[] };
    metadata.methods.push('mutated copy');
    expect(readObservableTermDefinition(createObservableCatalog(options).terms[0]!)?.methods).not.toContain('mutated copy');
    expect(ALL_OBSERVABLES[0]!.methods).not.toContain('mutated copy');
  });

  it('does not interpret absent or malformed extensions as a definition', () => {
    const term = createObservableCatalog(options).terms[0]!;
    expect(readObservableTermDefinition({ ...term, extensions: undefined })).toBeUndefined();
    expect(readObservableTermDefinition({ ...term, extensions: { [OBSERVABLE_TERM_EXTENSION]: { scientificBasis: 5 } } })).toBeUndefined();
    expect(readObservableTermDefinition({ ...term, category: 'unrecognized' })).toBeUndefined();
  });
});
