import { describe, it, expect } from 'vitest';
import {
  ClaimSchema,
  EVIDENCE_REF_KINDS,
  evidenceRef,
  isEvidenceRef,
  parseEvidenceRef,
} from '../shared/claim';

describe('evidenceRef helpers', () => {
  it('builds a "<kind>:<id>" ref for every supported kind', () => {
    for (const kind of EVIDENCE_REF_KINDS) {
      expect(evidenceRef(kind, 'x1')).toBe(`${kind}:x1`);
    }
  });

  it('round-trips through parseEvidenceRef', () => {
    expect(parseEvidenceRef(evidenceRef('sensor', 'radar-1'))).toEqual({
      kind: 'sensor',
      id: 'radar-1',
    });
  });

  it('preserves ids that themselves contain colons', () => {
    // Only the first ":" separates kind from id, so URN-style ids survive.
    expect(parseEvidenceRef('media:urn:obj:42')).toEqual({ kind: 'media', id: 'urn:obj:42' });
  });

  it('accepts well-formed refs and rejects malformed ones', () => {
    expect(isEvidenceRef('physical:p1')).toBe(true);
    expect(isEvidenceRef('testimony:s1')).toBe(true);
    expect(isEvidenceRef('garbage-no-colon')).toBe(false);
    expect(isEvidenceRef('unknownkind:x1')).toBe(false);
    expect(isEvidenceRef('media:')).toBe(false); // empty id
    expect(isEvidenceRef(42)).toBe(false);
  });

  it('parseEvidenceRef returns null on malformed input', () => {
    expect(parseEvidenceRef('garbage-no-colon')).toBeNull();
    expect(parseEvidenceRef('unknownkind:x1')).toBeNull();
  });
});

describe('ClaimSchema', () => {
  it('is an Attribution plus optional evidenceRefs', () => {
    const parsed = ClaimSchema.safeParse({
      evaluatedBy: 'AARO',
      evaluatedAt: '2024-01-01T00:00:00Z',
      rationale: 'multi-sensor corroboration',
      evidenceRefs: [evidenceRef('sensor', 'radar-1')],
    });
    expect(parsed.success).toBe(true);
  });

  it('allows an attribution-only claim (evidenceRefs optional)', () => {
    expect(ClaimSchema.safeParse({ evaluatedBy: 'witness' }).success).toBe(true);
  });

  it('rejects empty-string evidence refs', () => {
    expect(ClaimSchema.safeParse({ evidenceRefs: [''] }).success).toBe(false);
  });
});
