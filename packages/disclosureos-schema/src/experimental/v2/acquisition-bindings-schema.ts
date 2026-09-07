import { z } from 'zod';
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) => z.string().regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
export const ACQUISITION_BINDINGS_SCHEMA_ID = 'urn:disclosureos:experimental:acquisition-bindings:0.1.0';
export const AcquisitionBindingsSchema = z.strictObject({
  kind: z.literal('acquisition_bindings'), schemaVersion: z.literal('0.1.0'), id,
  historyId: id, observationId: id, contextId: id,
  sources: z.array(z.strictObject({ sourceRef: ref('source'), instrumentRef: ref('instrument') })),
  products: z.array(z.strictObject({ observationProductRef: ref('product'), contextProductRef: ref('product') })),
  extensions: z.record(z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/), z.json()).optional(),
});
export type AcquisitionBindings = z.infer<typeof AcquisitionBindingsSchema>;
export function acquisitionBindingsJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(AcquisitionBindingsSchema, { target: 'draft-2020-12' }), $id: ACQUISITION_BINDINGS_SCHEMA_ID };
}
