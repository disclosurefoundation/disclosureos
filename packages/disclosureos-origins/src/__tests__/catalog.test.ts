import { describe, expect, it } from 'vitest';
import { createOriginCatalog, readOriginTermDefinition, ORIGIN_TERM_EXTENSION } from '../catalog';
import { OCS_TAXONOMY } from '../taxonomy/tree';
import { OCS_PROVENANCE } from '../constants';

const options = { id: 'origins-v2-baseline', revision: '2026-10-13.1', publishedBy: 'Disclosure Foundation', publishedAt: '2026-10-13T00:00:00Z' };

describe('origin vocabulary catalog', () => {
  it('retains the complete taxonomy and its attribution in the shared catalog', () => {
    const catalog = createOriginCatalog(options);
    expect(catalog.catalogId).toBe('https://os.disclosure.org/vocabularies/origin-hypotheses');
    expect(catalog.terms.map(readOriginTermDefinition)).toEqual(OCS_TAXONOMY);
    expect(catalog.extensions?.[ORIGIN_TERM_EXTENSION]).toEqual({ provenance: OCS_PROVENANCE });
  });

  it('does not expose mutable children or aliases from the canonical taxonomy', () => {
    const term = createOriginCatalog(options).terms[0]!;
    const metadata = term.extensions![ORIGIN_TERM_EXTENSION] as { children: string[] };
    metadata.children.push('mutated-child');
    expect(createOriginCatalog(options).terms.map(readOriginTermDefinition)).toEqual(OCS_TAXONOMY);
    expect(OCS_TAXONOMY[0]!.children).not.toContain('mutated-child');
  });

  it('does not interpret an unrelated or malformed term as an OCS node', () => {
    const term = createOriginCatalog(options).terms[0]!;
    expect(readOriginTermDefinition({ ...term, extensions: undefined })).toBeUndefined();
    expect(readOriginTermDefinition({ ...term, extensions: { [ORIGIN_TERM_EXTENSION]: { depth: 'zero' } } })).toBeUndefined();
  });
});
