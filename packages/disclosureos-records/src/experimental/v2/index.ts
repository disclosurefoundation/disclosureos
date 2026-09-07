/** Experimental RFC 0002/0003 building blocks. Not the v2 Observation contract. */
import { z } from 'zod';

const text = z.string().min(1).regex(/\S/, 'must contain non-whitespace text');
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const sourceRef = z.string().regex(/^(source|product):[^\s:]+$/);
const valueRef = z.string().regex(/^(source|product|assertion):[^\s:]+$/);
const sourceRefs = z.array(valueRef).min(1);

// Match the JSON Schema date-time contract: seconds and a complete UTC offset
// are required; fractional digits remain optional and are preserved verbatim.
const instantString = z.iso.datetime({ offset: true }).regex(/^(?!0000)/)
  .regex(/T[0-9]{2}:[0-9]{2}:[0-9]{2}/)
  .regex(/(?:Z|[+-][0-9]{2}:[0-9]{2})(?![\s\S])/);

export const EventTimePointSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('year'), value: z.string().regex(/^(?!0000)[0-9]{4}$/) }),
  z.strictObject({ kind: z.literal('month'), value: z.string().regex(/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/) }),
  z.strictObject({ kind: z.literal('date'), value: z.iso.date().regex(/^(?!0000)/) }),
  z.strictObject({ kind: z.literal('instant'), value: instantString, timeScale: z.literal('UTC') }),
]);

export const EventTimeIntervalSchema = z.strictObject({
  kind: z.literal('interval'), start: EventTimePointSchema, end: EventTimePointSchema,
});
export const EventTimeValueSchema = z.union([EventTimePointSchema, EventTimeIntervalSchema]);

const assertionRef = z.string().regex(/^assertion:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const ValueSelectionSchema = z.strictObject({
  assertionRef,
  consideredAssertionRefs: z.array(assertionRef).min(1),
  methodRef: z.string().regex(/^method:[^\s:]+(?![\s\S])/),
  methodVersion: text,
  evaluatedBy: text,
  evaluatedAt: instantString,
  rationale: text,
});

export const PositionValueSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  datum: z.literal('WGS84'),
});

function envelope<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('known'), value, sourceRefs, selection: ValueSelectionSchema.optional() }),
    z.strictObject({ state: z.literal('approximate'), value, sourceRefs, precision: text, selection: ValueSelectionSchema.optional() }),
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
export type EventTimePoint = z.infer<typeof EventTimePointSchema>;
export type EventTimeInterval = z.infer<typeof EventTimeIntervalSchema>;
export type ValueSelection = z.infer<typeof ValueSelectionSchema>;
export type PositionValue = z.infer<typeof PositionValueSchema>;
export type EventTime = z.infer<typeof EventTimeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;
export type ValueAssertion = z.infer<typeof ValueAssertionSchema>;
export type PrimitiveRecord = z.infer<typeof PrimitiveRecordSchema>;

export interface PrimitiveIssue {
  code: 'STRUCT.VALUE' | 'REF.UNIQUE_ID' | 'REF.FIELD_MISMATCH' | 'REF.LOCAL_RESOLUTION' | 'TIME.INTERVAL'
    | 'TIME.PRECISION_MISMATCH' | 'TIME.INSTANT' | 'SELECTION.VALUE_MISMATCH' | 'SELECTION.INPUTS' | 'SELECTION.SOURCE_REF';
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

// Date.parse is used only for whole seconds and UTC-offset normalization.
// Fractional digits remain strings, so sub-millisecond order is never rounded away.
function instantParts(value: string): { milliseconds: number; fraction: string } {
  const dot = value.indexOf('.', 10);
  if (dot === -1) return { milliseconds: Date.parse(value), fraction: '' };
  let end = dot + 1;
  while (end < value.length && value[end]! >= '0' && value[end]! <= '9') end++;
  return { milliseconds: Date.parse(value.slice(0, dot) + value.slice(end)), fraction: value.slice(dot + 1, end) };
}

function comparePoints(start: EventTimePoint, end: EventTimePoint): number {
  if (start.kind !== 'instant' || end.kind !== 'instant') return start.value < end.value ? -1 : start.value > end.value ? 1 : 0;
  const a = instantParts(start.value);
  const b = instantParts(end.value);
  if (!Number.isFinite(a.milliseconds) || !Number.isFinite(b.milliseconds)) return NaN;
  if (a.milliseconds !== b.milliseconds) return a.milliseconds < b.milliseconds ? -1 : 1;
  const digits = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(digits, '0');
  const bf = b.fraction.padEnd(digits, '0');
  return af < bf ? -1 : af > bf ? 1 : 0;
}

function checkTime(value: EventTimeValue, path: string, issues: PrimitiveIssue[]): void {
  if (value.kind === 'instant' && !Number.isFinite(instantParts(value.value).milliseconds)) {
    issues.push({ code: 'TIME.INSTANT', stage: 'semantic', pointer: path, message: 'Instant cannot be resolved with its declared UTC offset.' });
  }
  if (value.kind !== 'interval') return;
  checkTime(value.start, `${path}/start`, issues);
  checkTime(value.end, `${path}/end`, issues);
  if (value.start.kind !== value.end.kind) {
    issues.push({ code: 'TIME.PRECISION_MISMATCH', stage: 'semantic', pointer: path, message: 'Interval endpoints must use the same kind of calendar precision or both be instants.' });
  } else if (comparePoints(value.start, value.end) > 0) {
    issues.push({ code: 'TIME.INTERVAL', stage: 'semantic', pointer: `${path}/end`, message: 'Interval end precedes its start.' });
  }
}

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
    if (assertion.field === 'eventTime') checkTime(assertion.value, `/assertions/${index}/value`, issues);
    const locator = assertion.provenance.locator;
    if (locator?.kind === 'time_range' && locator.endSeconds < locator.startSeconds) issues.push({ code: 'TIME.INTERVAL', stage: 'semantic', pointer: `/assertions/${index}/provenance/locator/endSeconds`, message: 'Locator end precedes its start.' });
  }
  for (const field of ['eventTime', 'position'] as const) {
    const value = data[field];
    if (value.state !== 'known' && value.state !== 'approximate') continue;
    if (field === 'eventTime' && (data.eventTime.state === 'known' || data.eventTime.state === 'approximate')) checkTime(data.eventTime.value, '/eventTime/value', issues);
    for (const [index, ref] of value.sourceRefs.entries()) {
      if (!ref.startsWith('assertion:')) { unchecked.add(ref); continue; }
      const target = assertions.get(ref.slice('assertion:'.length));
      if (!target) issues.push({ code: 'REF.LOCAL_RESOLUTION', stage: 'semantic', pointer: `/${field}/sourceRefs/${index}`, message: 'Local assertion does not exist.' });
      else if (target.field !== field) issues.push({ code: 'REF.FIELD_MISMATCH', stage: 'semantic', pointer: `/${field}/sourceRefs/${index}`, message: 'Assertion concerns a different field.' });
    }
    const selection = value.selection;
    if (!selection) continue;
    const path = `/${field}/selection`;
    unchecked.add(selection.methodRef);
    if (!Number.isFinite(instantParts(selection.evaluatedAt).milliseconds)) issues.push({ code: 'TIME.INSTANT', stage: 'semantic', pointer: `${path}/evaluatedAt`, message: 'Selection timestamp cannot be resolved with its declared UTC offset.' });
    if (!selection.consideredAssertionRefs.includes(selection.assertionRef)) issues.push({ code: 'SELECTION.INPUTS', stage: 'semantic', pointer: `${path}/assertionRef`, message: 'Selected assertion must be among the considered inputs.' });
    if (!value.sourceRefs.includes(selection.assertionRef)) issues.push({ code: 'SELECTION.SOURCE_REF', stage: 'semantic', pointer: `/${field}/sourceRefs`, message: 'Field provenance must cite the selected assertion.' });
    const refs = new Set<string>();
    for (const [index, ref] of selection.consideredAssertionRefs.entries()) {
      if (refs.has(ref)) issues.push({ code: 'REF.UNIQUE_ID', stage: 'semantic', pointer: `${path}/consideredAssertionRefs/${index}`, message: 'Considered assertion is repeated.' });
      refs.add(ref);
      const target = assertions.get(ref.slice('assertion:'.length));
      if (!target) issues.push({ code: 'REF.LOCAL_RESOLUTION', stage: 'semantic', pointer: `${path}/consideredAssertionRefs/${index}`, message: 'Considered assertion does not exist.' });
      else if (target.field !== field) issues.push({ code: 'REF.FIELD_MISMATCH', stage: 'semantic', pointer: `${path}/consideredAssertionRefs/${index}`, message: 'Considered assertion concerns a different field.' });
    }
    const selected = assertions.get(selection.assertionRef.slice('assertion:'.length));
    if (!selected) issues.push({ code: 'REF.LOCAL_RESOLUTION', stage: 'semantic', pointer: `${path}/assertionRef`, message: 'Selected assertion does not exist.' });
    else if (selected.field !== field) issues.push({ code: 'REF.FIELD_MISMATCH', stage: 'semantic', pointer: `${path}/assertionRef`, message: 'Selected assertion concerns a different field.' });
    // Both values have passed the same strict schema, which fixes their key order.
    // Selection copies a source value verbatim; it is not a derivation or normalization.
    else if (JSON.stringify(selected.value) !== JSON.stringify(value.value)) issues.push({ code: 'SELECTION.VALUE_MISMATCH', stage: 'semantic', pointer: `/${field}/value`, message: 'Selected value must equal the cited source value; derived values need a separate contract.' });
  }
  return issues.length ? { success: false, issues, uncheckedRefs: [...unchecked] }
    : { success: true, data, issues, uncheckedRefs: [...unchecked] };
}

export const PRIMITIVES_SCHEMA_ID = 'urn:disclosureos:experimental:records-v2-primitives:0.2.0';
/** Plain JSON; Zod instances remain inside records. Semantic checks are separate. */
export function primitivesJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(PrimitiveRecordSchema, { target: 'draft-2020-12' }), $id: PRIMITIVES_SCHEMA_ID };
}
