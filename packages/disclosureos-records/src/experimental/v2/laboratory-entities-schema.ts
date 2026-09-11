import { z } from "zod";
import { entity, values, target } from "./entity-fields";
import {
  MaterialEntitiesSchema,
  MaterialEntitySchema,
  MaterialEntityTargetSchema,
} from "./material-entities-schema";
import { ArtifactSnapshotRefSchema } from "./archival-entities-schema";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { EventTimeValueSchema } from "./primitives";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const methodRef = z
  .string()
  .regex(/^method:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const LaboratoryLimitSchema = z
  .strictObject({
    magnitude: z.number().nonnegative(),
    unit: text,
    kind: z.enum(["detection", "quantification"]),
    basis: text,
  })
  .describe(
    "A source-declared analytical threshold with units and stated basis, not a measured zero or uncertainty estimate.",
  );
export const LaboratoryResultValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("quantitative"),
    measurementId: id,
    limit: z.discriminatedUnion("state", [
      z.strictObject({
        state: z.literal("reported"),
        value: LaboratoryLimitSchema,
      }),
      z.strictObject({ state: z.literal("unknown"), reason: text }),
      z.strictObject({ state: z.literal("not_applicable"), reason: text }),
    ]),
  }),
  z.strictObject({
    kind: z.literal("below_limit"),
    limit: LaboratoryLimitSchema,
  }),
  z.strictObject({ kind: z.literal("qualitative"), text }),
]);
export const LaboratoryAnalysisFields = {
  label: values(text),
  method: values(z.strictObject({ methodRef, methodVersion: text })),
  laboratory: values(text),
  operator: values(text),
  performedAt: values(EventTimeValueSchema),
  protocol: values(text),
  preparationDescription: values(text),
  reportArtifacts: values(z.array(ArtifactSnapshotRefSchema).min(1)),
  notes: values(text),
};
export const LaboratoryResultFields = {
  analyte: values(text),
  result: values(LaboratoryResultValueSchema),
  reportArtifacts: values(z.array(ArtifactSnapshotRefSchema).min(1)),
  notes: values(text),
};
for (const fields of [LaboratoryAnalysisFields, LaboratoryResultFields])
  for (const [key, schema] of Object.entries(fields))
    (fields as Record<string, z.ZodType>)[key] = schema.describe(
      `Sourced ${key} declarations, retaining missingness and disagreements without certifying laboratory performance.`,
    );
const analysis = entity("laboratory_analysis", LaboratoryAnalysisFields).extend(
  {
    inputMaterialIds: z.array(id).min(1),
    preparationIds: z.array(id).min(1).optional(),
    resultIds: z
      .array(id)
      .describe(
        "Explicit result identities; an empty list does not invent a result from reported analytical work.",
      ),
  },
);
const result = entity("laboratory_result", LaboratoryResultFields).extend({
  analysisId: id,
  materialId: id.describe(
    "The exact analyzed specimen. Results do not propagate to parents or sibling aliquots.",
  ),
});
export const LaboratoryEntitySchema = z.discriminatedUnion("kind", [
  ...MaterialEntitySchema.options,
  analysis,
  result,
]);
export const LABORATORY_ENTITIES_SCHEMA_ID =
  "urn:disclosureos:experimental:research-entities:0.4.0";
export const LaboratoryEntitiesSchema = MaterialEntitiesSchema.extend({
  schemaVersion: z.literal("0.4.0"),
  entities: z.array(LaboratoryEntitySchema).min(1),
});
export const LaboratoryEntityTargetSchema = z.discriminatedUnion("kind", [
  ...MaterialEntityTargetSchema.options,
  target("laboratory_analysis", LaboratoryAnalysisFields),
  target("laboratory_result", LaboratoryResultFields),
]);
export const LaboratoryEntityReferenceSchema = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(LABORATORY_ENTITIES_SCHEMA_ID),
  }),
  target: LaboratoryEntityTargetSchema,
});
export const LaboratoryEntityAssertionReferenceSchema =
  LaboratoryEntityReferenceSchema.extend({ assertionId: id });
export type LaboratoryEntities = z.infer<typeof LaboratoryEntitiesSchema>;
export type LaboratoryEntity = z.infer<typeof LaboratoryEntitySchema>;
export type LaboratoryEntityReference = z.infer<
  typeof LaboratoryEntityReferenceSchema
>;
export function laboratoryEntitiesJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(LaboratoryEntitiesSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: LABORATORY_ENTITIES_SCHEMA_ID,
  };
}
