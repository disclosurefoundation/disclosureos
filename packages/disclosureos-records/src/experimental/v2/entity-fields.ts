import { z } from "zod";
import { SourceProvenanceSchema } from "./primitives";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const sourceRef = z
  .string()
  .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const provenance = SourceProvenanceSchema.extend({ sourceRef });
export function values<T extends z.ZodType>(schema: T) {
  return z
    .array(
      z.strictObject({
        id: id.describe(
          "Assertion identity within this entity, independent of array order.",
        ),
        content: z.union([
          z.strictObject({
            state: z.literal("known"),
            value: schema,
            provenance,
            originalWording: text.optional(),
          }),
          z.strictObject({
            state: z.literal("approximate"),
            value: schema,
            precision: text,
            provenance,
            originalWording: text.optional(),
          }),
          z.strictObject({
            state: z.literal("unknown"),
            reason: z.enum(["not_recorded", "not_collected", "unavailable"]),
          }),
          z.strictObject({ state: z.literal("redacted"), reason: text }),
          z.strictObject({
            state: z.literal("unmapped"),
            originalWording: text,
            provenance,
          }),
        ]),
      }),
    )
    .min(1)
    .optional();
}

export function entity<K extends string, F extends z.ZodRawShape>(
  kind: K,
  fields: F,
) {
  return z.strictObject({
    kind: z.literal(kind),
    id,
    fields: z.strictObject(fields),
  });
}
export function target<K extends string, F extends z.ZodRawShape>(
  kind: K,
  fields: F,
) {
  return z.strictObject({
    kind: z.literal(kind),
    id,
    field: z
      .enum(Object.keys(fields) as [keyof F & string, ...(keyof F & string)[]])
      .optional(),
  });
}
