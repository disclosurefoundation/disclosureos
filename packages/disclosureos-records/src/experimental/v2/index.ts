/** Experimental RFC 0002/0003 building blocks. Not the v2 Observation contract. */
import { z } from 'zod';

const text = z.string().min(1).regex(/\S/, 'must contain non-whitespace text');
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const sourceRef = z.string().regex(/^(source|product):[^\s:]+$/);
const valueRef = z.string().regex(/^(source|product|assertion):[^\s:]+$/);
const sourceRefs = z.array(valueRef).min(1);

export const EventTimeValueSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('year'), value: z.string().regex(/^(?!0000)[0-9]{4}$/) }),
  z.strictObject({ kind: z.literal('month'), value: z.string().regex(/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/) }),
  z.strictObject({ kind: z.literal('date'), value: z.iso.date().regex(/^(?!0000)/) }),
  z.strictObject({ kind: z.literal('instant'), value: z.iso.datetime({ offset: true }).regex(/^(?!0000)/), timeScale: z.literal('UTC') }),
]);

export const PositionValueSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  datum: z.literal('WGS84'),
});

function envelope<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('known'), value, sourceRefs }),
    z.strictObject({ state: z.literal('approximate'), value, sourceRefs, precision: text }),
    z.strictObject({ state: z.literal('unknown'), reason: z.enum(['not_recorded', 'not_collected', 'unavailable']) }),
    z.strictObject({ state: z.literal('redacted'), reason: text }),
  ]);
}

export const EventTimeSchema = envelope(EventTimeValueSchema);
export const PositionSchema = envelope(PositionValueSchema);

// A pointer is empty or begins with '/', followed by characters or valid tilde escapes.
// Slash is ordinary content after the first separator: do not repeat token groups.
// The final lookahead enforces absolute end, including a trailing newline.
export const SourceProvenanceSchema = z.strictObject({
  sourceRef,
  sourceDigest: z.strictObject({ algorithm: z.literal('sha256'), value: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
  locator: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('page'), page: z.number().int().min(1) }),
    z.strictObject({ kind: z.literal('time_range'), startSeconds: z.number().min(0), endSeconds: z.number().min(0) }),
    z.strictObject({ kind: z.literal('json_pointer'), pointer: z.string().regex(/^(?:\/(?:[^~]|~[01])*)?(?![\s\S])/) }),
  ]).optional(),
  attributedTo: text.optional(),
  extractedBy: text.optional(),
});

export const ValueAssertionSchema = z.discriminatedUnion('field', [
  z.strictObject({ id: identifier, field: z.literal('eventTime'), value: EventTimeValueSchema, provenance: SourceProvenanceSchema }),
  z.strictObject({ id: identifier, field: z.literal('position'), value: PositionValueSchema, provenance: SourceProvenanceSchema }),
]);

/** Testable container for value primitives, not an Observation or public projection API. */
export const PrimitiveRecordSchema = z.strictObject({
  id: identifier,
  eventTime: EventTimeSchema,
  position: PositionSchema,
  assertions: z.array(ValueAssertionSchema).optional(),
});

export type EventTimeValue = z.infer<typeof EventTimeValueSchema>;
export type PositionValue = z.infer<typeof PositionValueSchema>;
export type EventTime = z.infer<typeof EventTimeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;
export type ValueAssertion = z.infer<typeof ValueAssertionSchema>;
export type PrimitiveRecord = z.infer<typeof PrimitiveRecordSchema>;

export interface PrimitiveIssue {
  code: 'STRUCT.VALUE' | 'REF.UNIQUE_ID' | 'REF.FIELD_MISMATCH' | 'REF.LOCAL_RESOLUTION' | 'TIME.INTERVAL';
  stage: 'structural' | 'semantic';
  pointer: string;
  message: string;
}
export type PrimitiveParseResult = {
  success: true; data: PrimitiveRecord; issues: PrimitiveIssue[]; uncheckedRefs: string[];
} | {
  success: false; issues: PrimitiveIssue[]; uncheckedRefs: string[];
};

const pointer = (path: readonly PropertyKey[]) => path.map(p => `/${String(p).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');

/** Structural and local-reference checks only. External references/digests are never fetched or verified. */
export function parsePrimitiveRecord(input: unknown): PrimitiveParseResult {
  const result = PrimitiveRecordSchema.safeParse(input);
  if (!result.success) return { success: false, uncheckedRefs: [], issues: result.error.issues.map(issue => ({
    code: 'STRUCT.VALUE', stage: 'structural', pointer: pointer(issue.path), message: issue.message,
  })) };
  const data = result.data;
  const issues: PrimitiveIssue[] = [];
  const unchecked = new Set<string>();
  const assertions = new Map<string, ValueAssertion>();
  for (const [index, assertion] of (data.assertions ?? []).entries()) {
    if (assertions.has(assertion.id)) issues.push({ code: 'REF.UNIQUE_ID', stage: 'semantic', pointer: `/assertions/${index}/id`, message: 'Assertion ID is duplicated.' });
    else assertions.set(assertion.id, assertion);
    unchecked.add(assertion.provenance.sourceRef);
    const locator = assertion.provenance.locator;
    if (locator?.kind === 'time_range' && locator.endSeconds < locator.startSeconds) issues.push({ code: 'TIME.INTERVAL', stage: 'semantic', pointer: `/assertions/${index}/provenance/locator/endSeconds`, message: 'Locator end precedes its start.' });
  }
  for (const field of ['eventTime', 'position'] as const) {
    const value = data[field];
    if (value.state !== 'known' && value.state !== 'approximate') continue;
    for (const [index, ref] of value.sourceRefs.entries()) {
      if (!ref.startsWith('assertion:')) { unchecked.add(ref); continue; }
      const target = assertions.get(ref.slice('assertion:'.length));
      if (!target) issues.push({ code: 'REF.LOCAL_RESOLUTION', stage: 'semantic', pointer: `/${field}/sourceRefs/${index}`, message: 'Local assertion does not exist.' });
      else if (target.field !== field) issues.push({ code: 'REF.FIELD_MISMATCH', stage: 'semantic', pointer: `/${field}/sourceRefs/${index}`, message: 'Assertion concerns a different field.' });
    }
  }
  return issues.length ? { success: false, issues, uncheckedRefs: [...unchecked] }
    : { success: true, data, issues, uncheckedRefs: [...unchecked] };
}

export const PRIMITIVES_SCHEMA_ID = 'urn:disclosureos:experimental:records-v2-primitives:0.1.0';
/** Plain JSON; Zod instances remain inside records. Semantic checks are separate. */
export function primitivesJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(PrimitiveRecordSchema, { target: 'draft-2020-12' }), $id: PRIMITIVES_SCHEMA_ID };
}
