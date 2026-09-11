import { z } from "zod";
import { WitnessCategorySchema } from "../../extensions/testimony/category";
import { SecurityClearanceSchema } from "../../extensions/testimony/witness";
import { TestimonyContextSchema } from "../../extensions/testimony/statement";
import { ChainOfCustodySchema } from "../../extensions/provenance/custody";
import {
  SourceProvenanceSchema,
  EventTimeValueSchema,
  instantString,
} from "./primitives";
import {
  DocumentSnapshotRefSchema,
  ObservationSnapshotRefSchema,
  ContextReferenceSchema,
  ContextTargetSchema,
  OBSERVATION_CONTEXT_SCHEMA_ID,
} from "./context-schema";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const sourceRef = z
  .string()
  .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const provenance = SourceProvenanceSchema.extend({ sourceRef });
export const RESEARCH_ENTITIES_SCHEMA_ID =
  "urn:disclosureos:experimental:research-entities:0.1.0";
// Independent C2 envelope; the published context contract remains byte-identical.
function values<T extends z.ZodType>(schema: T) {
  return z
    .array(
      z.strictObject({
        id: id.describe(
          "Assertion identity within this entity, independent of array order."
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
      })
    )
    .min(1)
    .optional();
}

const timeContextReference = ContextReferenceSchema.extend({
  target: z.union([
    ContextTargetSchema.options[0],
    ContextTargetSchema.options[5],
  ]),
}).describe(
  "Temporal or event context for a qualification, not an arbitrary object attribute."
);
const relevantTime = z.union([
  z.strictObject({ kind: z.literal("calendar"), value: EventTimeValueSchema }),
  z.strictObject({
    kind: z.literal("context"),
    reference: timeContextReference,
  }),
  z.strictObject({ kind: z.literal("unknown"), reason: text }),
]);
const qualification = <T extends z.ZodType>(value: T) =>
  z.strictObject({ value, relevantTime });
export const ResearchWitnessFields = {
  publicIdentity: values(
    z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("public_name"), display: text }),
      z.strictObject({ kind: z.literal("pseudonym"), display: text }),
      z.strictObject({ kind: z.literal("withheld"), display: text }),
    ])
  ),
  anonymous: values(z.boolean()),
  willingToBeIdentified: values(z.boolean()),
  category: values(qualification(WitnessCategorySchema)),
  role: values(qualification(text)),
  organization: values(qualification(text)),
  experienceYears: values(qualification(z.number().min(0))),
  securityClearance: values(qualification(SecurityClearanceSchema)),
  isProfessionalObserver: values(qualification(z.boolean())),
  hasAviationExperience: values(qualification(z.boolean())),
  hasMilitaryExperience: values(qualification(z.boolean())),
  hasScientificBackground: values(qualification(z.boolean())),
  hasPriorUAPKnowledge: values(qualification(z.boolean())),
  wasSkepticPrior: values(qualification(z.boolean())),
  description: values(text),
};
export const ResearchAccountFields = {
  speakerWitnessIds: values(z.array(id).min(1)),
  recorder: values(text),
  context: values(TestimonyContextSchema),
  recordedTime: values(EventTimeValueSchema),
  dateCertainty: values(
    z.enum(["exact", "approximate", "estimated", "unknown"])
  ),
  eventContext: values(ContextReferenceSchema),
  content: values(text),
  summary: values(z.strictObject({ text, summarizedBy: text })),
  sourceDocument: values(sourceRef),
  interviewAvailable: values(z.boolean()),
  writtenReportAvailable: values(z.boolean()),
  underOath: values(z.boolean()),
  custodyStatus: values(ChainOfCustodySchema),
  supportRefs: values(z.array(sourceRef).min(1)),
};
export const ResearchProcedureFields = {
  procedureType: values(z.literal("polygraph")),
  witnessId: values(id),
  accountId: values(id),
  administered: values(z.boolean()),
  passed: values(z.boolean()),
  performedAt: values(EventTimeValueSchema),
  context: values(text),
  sourceDocument: values(sourceRef),
};
export const ResearchWitnessGroupFields = {
  witnessIds: values(z.array(id).min(1)),
  reportedCount: values(z.number().int().min(0)),
  categories: values(z.array(WitnessCategorySchema).min(1)),
  militaryWitnesses: values(z.boolean()),
  aviationWitnesses: values(z.boolean()),
  professionalObservers: values(z.boolean()),
  descriptions: values(z.array(text).min(1)),
};
for (const fields of [
  ResearchWitnessFields,
  ResearchAccountFields,
  ResearchProcedureFields,
  ResearchWitnessGroupFields,
])
  for (const [key, schema] of Object.entries(fields))
    (fields as Record<string, z.ZodType>)[key] = schema.describe(
      `Sourced ${key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()} assertions. Alternatives and unknowns are retained; supplied does not mean verified.`
    );
function entity<K extends string, F extends z.ZodRawShape>(kind: K, fields: F) {
  return z.strictObject({
    kind: z.literal(kind),
    id,
    fields: z.strictObject(fields),
  });
}
export const ResearchEntitySchema = z.discriminatedUnion("kind", [
  entity("witness", ResearchWitnessFields),
  entity("account", ResearchAccountFields),
  entity("procedure", ResearchProcedureFields),
  entity("witness_group", ResearchWitnessGroupFields),
]);
export const ResearchEntitiesSchema = z
  .strictObject({
    kind: z.literal("research_entities"),
    schemaVersion: z.literal("0.1.0"),
    id,
    observationRef: ObservationSnapshotRefSchema,
    contextRefs: z.array(
      DocumentSnapshotRefSchema.extend({
        schemaId: z.literal(OBSERVATION_CONTEXT_SCHEMA_ID),
      })
    ),
    recordedAt: instantString,
    recordedBy: text,
    entities: z.array(ResearchEntitySchema).min(1),
  })
  .describe(
    "Public witness, account, procedure and aggregate declarations. Private identity mappings and contact fields belong outside this exchange document. No consent or credibility is inferred."
  );
function target<K extends string, F extends z.ZodRawShape>(kind: K, fields: F) {
  return z.strictObject({
    kind: z.literal(kind),
    id,
    field: z
      .enum(Object.keys(fields) as [keyof F & string, ...(keyof F & string)[]])
      .optional(),
  });
}
export const ResearchEntityTargetSchema = z.discriminatedUnion("kind", [
  target("witness", ResearchWitnessFields),
  target("account", ResearchAccountFields),
  target("procedure", ResearchProcedureFields),
  target("witness_group", ResearchWitnessGroupFields),
]);
export const ResearchEntityReferenceSchema = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(RESEARCH_ENTITIES_SCHEMA_ID),
  }),
  target: ResearchEntityTargetSchema,
});
export const ResearchEntityAssertionReferenceSchema =
  ResearchEntityReferenceSchema.extend({ assertionId: id });
export type ResearchEntities = z.infer<typeof ResearchEntitiesSchema>;
export type ResearchEntity = z.infer<typeof ResearchEntitySchema>;
export type ResearchEntityReference = z.infer<
  typeof ResearchEntityReferenceSchema
>;
export function researchEntitiesJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ResearchEntitiesSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: RESEARCH_ENTITIES_SCHEMA_ID,
  };
}
