import { z } from 'zod';
import { EventTimeValueSchema, PositionValueSchema, SourceProvenanceSchema, ValueSelectionSchema, instantString } from './primitives';

const text = z.string().min(1).regex(/\S/, 'must contain non-whitespace text');
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kinds: readonly string[]) => z.string().regex(new RegExp(`^(?:${kinds.join('|')}):[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const sourceProductRef = ref(['source', 'product']);
const valueRef = ref(['source', 'product', 'assertion']);
const sourceRefs = z.array(valueRef).min(1);
const access = z.enum(['public', 'restricted', 'withheld', 'unknown']);
const digest = z.strictObject({ algorithm: z.literal('sha256'), value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/) });

const quantified = { magnitude: z.number().min(0), unit: text, sourceRefs: z.array(sourceProductRef).min(1) };
export const QuantitativeUncertaintySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unknown'), reason: z.enum(['not_reported', 'not_characterized', 'unavailable']) }),
  z.strictObject({ kind: z.literal('standard'), ...quantified }),
  z.strictObject({ kind: z.literal('expanded'), ...quantified, coverageFactor: z.number().positive(), coverageProbability: z.number().gt(0).lte(1).optional() }),
  z.strictObject({ kind: z.literal('bound'), ...quantified }),
]);
export const MeasuredQuantitySchema = z.strictObject({
  value: z.number(), unit: text, uncertainty: QuantitativeUncertaintySchema,
});

const definition = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('identified'), authority: text, code: text, revision: text.optional() }),
  z.strictObject({ state: z.literal('described'), description: text }),
  z.strictObject({ state: z.literal('unknown'), reason: text }),
]);
export const ReferenceFrameSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id, kind: z.literal('geodetic'), definition, angularUnit: z.literal('deg'), vertical: z.strictObject({ definition, unit: text }).optional() }),
  z.strictObject({ id, kind: z.literal('cartesian'), definition, unit: text }),
]);
export const FramedPositionSchema = z.discriminatedUnion('kind', [
  PositionValueSchema.omit({ datum: true }).extend({
    kind: z.literal('geodetic'), frameRef: ref(['frame']), altitude: MeasuredQuantitySchema.optional(),
    uncertainty: z.strictObject({ latitude: QuantitativeUncertaintySchema, longitude: QuantitativeUncertaintySchema }).optional(),
  }),
  z.strictObject({ kind: z.literal('cartesian'), frameRef: ref(['frame']), x: MeasuredQuantitySchema, y: MeasuredQuantitySchema, z: MeasuredQuantitySchema }),
]);

function envelope<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('known'), value, sourceRefs, selection: ValueSelectionSchema.optional() }),
    z.strictObject({ state: z.literal('approximate'), value, sourceRefs, selection: ValueSelectionSchema.optional(), precision: text }),
    z.strictObject({ state: z.literal('unknown'), reason: z.enum(['not_recorded', 'not_collected', 'unavailable']) }),
    z.strictObject({ state: z.literal('redacted'), reason: text }),
  ]);
}
const timeEnvelope = envelope(EventTimeValueSchema);
// Time uncertainty is an observation about timing, distinct from calendar granularity.
export const ObservationTimeSchema = z.discriminatedUnion('state', [
  timeEnvelope.options[0].extend({ uncertainty: QuantitativeUncertaintySchema.optional() }),
  timeEnvelope.options[1].extend({ uncertainty: QuantitativeUncertaintySchema.optional() }),
  timeEnvelope.options[2],
  timeEnvelope.options[3],
]);
export const ObservationPositionSchema = envelope(FramedPositionSchema);

export const ObservationSourceSchema = z.strictObject({
  id, kind: z.enum(['document', 'testimony', 'instrument_data', 'other', 'unknown']),
  access, title: text.optional(), uri: z.url().optional(), digest: digest.optional(),
});
const product = { id, format: text, access, uri: z.url().optional(), digest: digest.optional() };
export const ObservationProductSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...product, kind: z.literal('raw'), sourceRefs: z.array(ref(['source'])).min(1) }),
  z.strictObject({ ...product, kind: z.literal('derived'), generatedBy: ref(['process']) }),
]);
export const ObservationMethodSchema = z.strictObject({ id, version: text, description: text.optional(), uri: z.url().optional() });
const provenance = SourceProvenanceSchema.extend({ sourceRef: sourceProductRef, sourceDigest: digest.optional() });
export const ObservationAssertionSchema = z.discriminatedUnion('field', [
  z.strictObject({ id, field: z.literal('eventTime'), value: EventTimeValueSchema, provenance }),
  z.strictObject({ id, field: z.literal('position'), value: FramedPositionSchema, provenance }),
  z.strictObject({ id, field: z.literal('measurement'), measurementId: id, value: MeasuredQuantitySchema, provenance }),
]);
export const ObservationMeasurementSchema = z.strictObject({
  id, quantity: text, value: MeasuredQuantitySchema, sourceRefs,
  frameRef: ref(['frame']).optional(), selection: ValueSelectionSchema.optional(),
});
export const ProcessingActivitySchema = z.strictObject({
  id, methodRef: ref(['method']), methodVersion: text, performedBy: text, performedAt: instantString,
  inputRefs: z.array(valueRef).min(1), outputRefs: z.array(ref(['product'])).min(1),
});

export const EXPERIMENTAL_OBSERVATION_SCHEMA_ID = 'urn:disclosureos:experimental:observation:0.1.0';
export const ExperimentalObservationSchema = z.strictObject({
  kind: z.literal('observation'), schemaVersion: z.literal('0.1.0'), id,
  status: z.enum(['draft', 'published', 'withdrawn']), createdAt: instantString, updatedAt: instantString,
  summary: text.optional(), eventTime: ObservationTimeSchema, position: ObservationPositionSchema,
  sources: z.array(ObservationSourceSchema), products: z.array(ObservationProductSchema), methods: z.array(ObservationMethodSchema),
  frames: z.array(ReferenceFrameSchema), assertions: z.array(ObservationAssertionSchema),
  measurements: z.array(ObservationMeasurementSchema), processing: z.array(ProcessingActivitySchema),
  extensions: z.record(z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/), z.json()).optional(),
});

export type QuantitativeUncertainty = z.infer<typeof QuantitativeUncertaintySchema>;
export type MeasuredQuantity = z.infer<typeof MeasuredQuantitySchema>;
export type ReferenceFrame = z.infer<typeof ReferenceFrameSchema>;
export type FramedPosition = z.infer<typeof FramedPositionSchema>;
export type ObservationAssertion = z.infer<typeof ObservationAssertionSchema>;
export type ProcessingActivity = z.infer<typeof ProcessingActivitySchema>;
export type ExperimentalObservation = z.infer<typeof ExperimentalObservationSchema>;

export function experimentalObservationJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(ExperimentalObservationSchema, { target: 'draft-2020-12' }), $id: EXPERIMENTAL_OBSERVATION_SCHEMA_ID };
}
