import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { preservePublishedSchema } from '../shared/published-schema';

describe('patched validation dependency', () => {
  it.each(['array', 'set', 'map'] as const)('rejects oversized %s before parsing its members', kind => {
    let visited = 0;
    const member = z.string().superRefine(() => { visited += 1; });
    const schema = kind === 'array' ? z.array(member).max(1) : kind === 'set' ? z.set(member).max(1) : z.map(member, member).max(1);
    const input = kind === 'array' ? ['one', 'two'] : kind === 'set' ? new Set(['one', 'two']) : new Map([['one', 'one'], ['two', 'two']]);
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    expect(visited).toBe(0);
    if (!result.success) expect(result.error.issues).toHaveLength(1);
  });

  it('requires seconds for qualified timestamps, as the published date-time contract does', () => {
    const timestamp = z.iso.datetime({ offset: true });
    for (const value of ['2026-11-15T12:00:00Z', '2026-11-15T12:00:00.123-08:00']) expect(timestamp.safeParse(value).success).toBe(true);
    for (const value of ['2026-11-15T12:00Z', '2026-11-15T12:00-08:00', '2026-02-30T12:00:00Z']) expect(timestamp.safeParse(value).success).toBe(false);
  });
});

describe('published JSON Schema representation', () => {
  it('retains nullable alternatives without changing metadata or example data', () => {
    const example = { type: ['string', 'null'], pattern: 'literal data' };
    expect(preservePublishedSchema({ type: ['string', 'null'], description: 'Value', examples: [example] })).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Value', examples: [example] });
  });
  it('keeps meaningful tuple tail restrictions', () => {
    expect(preservePublishedSchema({ type: 'array', prefixItems: [{ type: 'string' }], items: false })).toHaveProperty('items', false);
    expect(preservePublishedSchema({ type: 'array', prefixItems: [{ type: 'string' }], maxItems: 1, items: false })).not.toHaveProperty('items');
  });
  it('preserves timestamp spellings only where another constraint requires seconds', () => {
    const raw = z.toJSONSchema(z.iso.datetime({ offset: true }));
    const preserved = preservePublishedSchema(raw);
    expect(preserved.format).toBe('date-time');
    expect(preserved.pattern).not.toEqual(raw.pattern);
    expect(preservePublishedSchema({ pattern: raw.pattern }).pattern).toEqual(raw.pattern);
  });
});
