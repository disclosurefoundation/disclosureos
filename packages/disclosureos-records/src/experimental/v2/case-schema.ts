import { z } from "zod";
import {
  SourceProvenanceSchema,
  EventTimeValueSchema,
  instantString,
} from "./primitives";
import { ObservationSnapshotRefSchema } from "./context-schema";
import { ConfidenceLevelSchema } from "../../shared";

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ids = z.array(id).min(1);
export const CASE_RECORD_SCHEMA_ID =
  "urn:disclosureos:experimental:case-record:0.1.0";
export const CaseProvenanceSchema = SourceProvenanceSchema.extend({
  attributedTo: text.describe(
    "Who made the declaration, using a public label when identity is withheld.",
  ),
  extractedBy: text.describe("Who recorded the declaration in this case."),
  observationId: id.describe(
    "Selects an exact observation snapshot in this case's observationRefs, disambiguating source IDs across observations.",
  ),
  sourceRef: z
    .string()
    .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
});
function values<T extends z.ZodType>(schema: T) {
  return z
    .array(
      z.strictObject({
        id,
        content: z.union([
          z.strictObject({
            state: z.literal("known"),
            value: schema,
            provenance: CaseProvenanceSchema,
            originalWording: text.optional(),
          }),
          z.strictObject({
            state: z.literal("approximate"),
            value: schema,
            precision: text,
            provenance: CaseProvenanceSchema,
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
            provenance: CaseProvenanceSchema,
          }),
        ]),
      }),
    )
    .min(1)
    .optional();
}
export const CaseGroupFields = {
  label: values(text),
  groupType: values(z.enum(["cluster", "wave", "flap", "other"])),
  description: values(text),
};
export const CaseInvestigationFields = {
  investigatingBody: values(text),
  investigatingBodies: values(z.array(text).min(1)),
  caseNumber: values(text),
  investigationTime: values(EventTimeValueSchema),
  status: values(text),
  reportedMethods: values(z.array(text).min(1)),
  methodReferences: values(
    z.array(z.strictObject({ observationId: id, methodId: id })).min(1),
  ),
  reportedFindings: values(text),
  reportedConclusion: values(text),
  reportedConfidence: values(ConfidenceLevelSchema),
  reportedRecommendations: values(text),
};
export const CaseResponseFields = {
  occurredAt: values(EventTimeValueSchema),
  respondingBody: values(text),
  officialResponse: values(text),
  mediaAttention: values(z.boolean()),
  publicImpact: values(text),
  policyImpact: values(text),
  militaryResponse: values(text),
  reportedConcealmentAllegation: values(text),
};
for (const fields of [
  CaseGroupFields,
  CaseInvestigationFields,
  CaseResponseFields,
])
  for (const [name, schema] of Object.entries(fields))
    (fields as Record<string, z.ZodType>)[name] = schema.describe(
      `Sourced ${name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} declarations. Conflicting assertions and missingness remain explicit; this is not an assessment by the standard.`,
    );
const basis = z
  .strictObject({ text, provenance: CaseProvenanceSchema })
  .describe(
    "The attributed basis for this structural link; it does not establish object identity or corroboration.",
  );
export const CaseMemberSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("observation"), id }),
  z.strictObject({ kind: z.literal("event_group"), id }),
]);
export const CaseEntitySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("event_group"),
    id,
    fields: z.strictObject(CaseGroupFields),
  }),
  z.strictObject({
    kind: z.literal("membership"),
    id,
    member: CaseMemberSchema,
    groupId: id,
    basis,
  }),
  z.strictObject({
    kind: z.literal("relationship"),
    id,
    fromObservationId: id,
    toObservationId: id,
    relation: z
      .enum(["related_to", "precedes", "follows"])
      .describe(
        "A directed sourced declaration. Chronology is checked for cycles only; no temporal normalization or scientific equivalence is inferred.",
      ),
    basis,
  }),
  z.strictObject({
    kind: z.literal("investigation"),
    id,
    observationIds: ids,
    fields: z.strictObject(CaseInvestigationFields),
  }),
  z.strictObject({
    kind: z.literal("response_event"),
    id,
    observationIds: ids,
    fields: z.strictObject(CaseResponseFields),
  }),
]);
export const CaseRecordSchema = z.strictObject({
  kind: z.literal("case_record"),
  schemaVersion: z.literal("0.1.0"),
  id,
  recordedAt: instantString,
  recordedBy: text.describe(
    "Assembler of the case document, distinct from the authors of its sourced declarations.",
  ),
  observationRefs: z
    .array(ObservationSnapshotRefSchema)
    .min(1)
    .describe(
      "Complete case observation scope, with one exact snapshot per observation ID. Missing supplied bytes prevent complete reference validation.",
    ),
  entities: z.array(CaseEntitySchema).min(1),
});
export type CaseRecord = z.infer<typeof CaseRecordSchema>;
export type CaseEntity = z.infer<typeof CaseEntitySchema>;
export type CaseProvenance = z.infer<typeof CaseProvenanceSchema>;
export function caseRecordJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(CaseRecordSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: CASE_RECORD_SCHEMA_ID,
  };
}
