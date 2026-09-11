import { z } from "zod";
import { entity, values, target } from "./entity-fields";
import {
  ArchivalEntitiesSchema,
  ArchivalEntitySchema,
  ArchivalEntityTargetSchema,
} from "./archival-entities-schema";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { EventTimeValueSchema } from "./primitives";
import { EvidenceQualitySchema } from "../../extensions/physical/types";
import {
  ChainOfCustodySchema,
  CustodyActionSchema,
} from "../../extensions/provenance/custody";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ids = z.array(id).min(1);
const support = z
  .array(
    z.string().regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  )
  .min(1);
const sampleSelectionRef = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(
      "urn:disclosureos:experimental:physical-sample-selection:0.1.0",
    ),
  }),
  sampleId: id,
});
export const MaterialFields = {
  label: values(text),
  type: values(
    z.enum([
      "material_sample",
      "biological_sample",
      "implant",
      "debris",
      "soil_sample",
      "water_sample",
      "vegetation_sample",
      "other",
    ]),
  ),
  description: values(text),
  reportedQuality: values(EvidenceQualitySchema),
  collectionTime: values(EventTimeValueSchema),
  collectionMethod: values(text),
  collectorName: values(text),
  collectorOrganization: values(text),
  storageLocation: values(text),
  reportedCustodyStatus: values(ChainOfCustodySchema),
  photographed: values(z.boolean()),
  labReportAvailable: values(z.boolean()),
  reportedAnalyses: values(z.array(text).min(1)),
  reportedAnalysisSummary: values(text),
  supportRefs: values(support),
  notes: values(text),
};
export const MaterialTraceFields = {
  type: values(z.enum(["ground_trace", "impression", "burn_mark", "other"])),
  description: values(text),
  recordedTime: values(EventTimeValueSchema),
  recordedBy: values(text),
  locationDescription: values(text),
  photographed: values(z.boolean()),
  supportRefs: values(support),
  notes: values(text),
};
export const MaterialPreparationFields = {
  method: values(text),
  methodVersion: values(text),
  performedAt: values(EventTimeValueSchema),
  operator: values(text),
  organization: values(text),
  description: values(text),
  supportRefs: values(support),
  notes: values(text),
};
export const MaterialCustodyFields = {
  action: values(CustodyActionSchema),
  occurredAt: values(EventTimeValueSchema),
  from: values(text),
  to: values(text),
  location: values(text),
  reference: values(text),
  supportRefs: values(support),
  notes: values(text),
};
for (const fields of [
  MaterialFields,
  MaterialTraceFields,
  MaterialPreparationFields,
  MaterialCustodyFields,
])
  for (const [key, schema] of Object.entries(fields))
    (fields as Record<string, z.ZodType>)[key] = schema.describe(
      `Sourced ${key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} declarations. Missingness and conflicting statements are retained; no physical verification is implied.`,
    );
const material = entity("material", MaterialFields).extend({
  selectionRef: sampleSelectionRef
    .optional()
    .describe(
      "Optional link to an existing exact specimen-selection snapshot. Reuse that specimen identity; external resolution is a separate check.",
    ),
  lineage: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("collected"), traceId: id.optional() }),
      z.strictObject({ kind: z.literal("derived"), preparationId: id }),
      z.strictObject({ kind: z.literal("unknown"), reason: text }),
    ])
    .describe(
      "Declared collection, an identified preparation, or unresolved lineage. A derived specimen does not inherit its parents' collection or custody.",
    ),
});
const trace = entity("material_trace", MaterialTraceFields);
const preparation = entity(
  "material_preparation",
  MaterialPreparationFields,
).extend({
  inputMaterialIds: ids.describe(
    "Identified input specimens. A trace or digital artifact is not a specimen.",
  ),
  outputMaterialIds: ids.describe(
    "Distinct output specimens. Splits and mixtures are relationships, not a mass-balance certification.",
  ),
  operation: z.enum(["split", "mixture", "preparation", "other"]),
});
const custody = entity("material_custody_action", MaterialCustodyFields).extend(
  {
    transferRef: sampleSelectionRef
      .extend({ transferId: id })
      .optional()
      .describe(
        "Optional identity of the existing selected transfer being described; not a second independent custody chain.",
      ),
    materialId: id,
    predecessor: z
      .discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("action"), id }),
        z.strictObject({ kind: z.literal("start") }),
        z.strictObject({ kind: z.literal("unknown"), reason: text }),
      ])
      .describe(
        "An action on this same specimen, a declared beginning, or an explicit unknown gap. Array order does not establish chronology.",
      ),
  },
);
export const MaterialEntitySchema = z.discriminatedUnion("kind", [
  ...ArchivalEntitySchema.options,
  material,
  trace,
  preparation,
  custody,
]);
export const MATERIAL_ENTITIES_SCHEMA_ID =
  "urn:disclosureos:experimental:research-entities:0.3.0";
export const MaterialEntitiesSchema = ArchivalEntitiesSchema.extend({
  schemaVersion: z.literal("0.3.0"),
  entities: z.array(MaterialEntitySchema).min(1),
}).describe(
  "Research entities extended with physical specimens, uncollected traces, preparation lineage and physical custody. Local consistency is not source integrity, laboratory validation or a complete custody finding.",
);
export const MaterialEntityTargetSchema = z.discriminatedUnion("kind", [
  ...ArchivalEntityTargetSchema.options,
  target("material", MaterialFields),
  target("material_trace", MaterialTraceFields),
  target("material_preparation", MaterialPreparationFields),
  target("material_custody_action", MaterialCustodyFields),
]);
export const MaterialEntityReferenceSchema = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(MATERIAL_ENTITIES_SCHEMA_ID),
  }),
  target: MaterialEntityTargetSchema,
});
export const MaterialEntityAssertionReferenceSchema =
  MaterialEntityReferenceSchema.extend({ assertionId: id });
export type MaterialEntities = z.infer<typeof MaterialEntitiesSchema>;
export type MaterialEntity = z.infer<typeof MaterialEntitySchema>;
export function materialEntitiesJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MaterialEntitiesSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: MATERIAL_ENTITIES_SCHEMA_ID,
  };
}
