import { z } from "zod";
import { DocumentSnapshotRefSchema } from "./context-schema";
import {
  CaseGroupFields,
  CaseInvestigationFields,
  CaseResponseFields,
  CaseProvenanceSchema,
  CASE_RECORD_SCHEMA_ID,
} from "./case-schema";
import {
  SourceStatementSchema,
  UnassessedClaimSchema,
  AssessedClaimSchema,
} from "./claim-history-schema";
import { target } from "./entity-fields";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const CaseSnapshotRefSchema = DocumentSnapshotRefSchema.extend({
  schemaId: z.literal(CASE_RECORD_SCHEMA_ID),
});
const fieldTargets = [
  target("event_group", CaseGroupFields),
  target("investigation", CaseInvestigationFields),
  target("response_event", CaseResponseFields),
] as const;
const linkTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("membership"), id }),
  z.strictObject({ kind: z.literal("relationship"), id }),
]);
export const CaseEntityTargetSchema = z.discriminatedUnion("kind", [
  ...fieldTargets,
  ...linkTarget.options,
]);
export const CaseEntityReferenceSchema = z.strictObject({
  document: CaseSnapshotRefSchema,
  target: CaseEntityTargetSchema,
});
export const CaseObservationReferenceSchema = z.strictObject({
  case: CaseSnapshotRefSchema,
  observationId: id,
});
export const CaseRelationshipKindSchema = z
  .enum([
    "corroborates",
    "contradicts",
    "same_object",
    "duplicate_of",
    "re_analysis_of",
    "supersedes",
    "superseded_by",
  ])
  .describe(
    "Attributed relationship under review. This never merges observations or changes their publication lifecycle.",
  );
export const CaseClaimSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("case"), document: CaseSnapshotRefSchema }),
  z.strictObject({
    kind: z.literal("case_entity"),
    reference: CaseEntityReferenceSchema,
  }),
  z.strictObject({
    kind: z.literal("case_relation"),
    from: CaseObservationReferenceSchema,
    to: CaseObservationReferenceSchema,
    relation: CaseRelationshipKindSchema,
  }),
]);
const assertionTargets = z.discriminatedUnion("kind", [
  fieldTargets[0].extend({ field: fieldTargets[0].shape.field.unwrap() }),
  fieldTargets[1].extend({ field: fieldTargets[1].shape.field.unwrap() }),
  fieldTargets[2].extend({ field: fieldTargets[2].shape.field.unwrap() }),
]);
export const CaseInputReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("case_assertion"),
    document: CaseSnapshotRefSchema,
    target: assertionTargets,
    assertionId: id,
  }),
  z.strictObject({
    kind: z.literal("case_basis"),
    document: CaseSnapshotRefSchema,
    target: linkTarget,
  }),
]);
export const CaseObservationInputSchema = CaseObservationReferenceSchema.extend(
  {
    ref: z
      .string()
      .regex(
        /^(source|product|assertion|measurement):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/,
      ),
  },
);
export const CaseMethodReferenceSchema = CaseObservationReferenceSchema.extend({
  methodId: id,
});
const shared = { subject: CaseClaimSubjectSchema };
const inputs = {
  ...shared,
  inputRefs: z.array(
    z.string().regex(/^claim:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  ),
  caseInputRefs: z.array(CaseInputReferenceSchema).optional(),
  observationInputRefs: z.array(CaseObservationInputSchema).optional(),
};
export const CaseSourceStatementSchema = SourceStatementSchema.extend({
  ...shared,
  provenance: CaseProvenanceSchema.extend({ case: CaseSnapshotRefSchema }),
});
export const CaseUnassessedClaimSchema = UnassessedClaimSchema.extend(inputs);
export const CaseAssessedClaimSchema = AssessedClaimSchema.extend({
  ...inputs,
  methodRef: CaseMethodReferenceSchema,
});
export const CASE_CLAIM_HISTORY_SCHEMA_ID =
  "urn:disclosureos:experimental:case-claim-history:0.1.0";
export const CaseClaimHistorySchema = z.strictObject({
  kind: z.literal("case_claim_history"),
  schemaVersion: z.literal("0.1.0"),
  id,
  caseRefs: z
    .array(CaseSnapshotRefSchema)
    .min(1)
    .describe(
      "Exact case snapshots. Different revisions may coexist; references never follow latest.",
    ),
  claims: z.array(
    z.union([
      CaseSourceStatementSchema,
      CaseUnassessedClaimSchema,
      CaseAssessedClaimSchema,
    ]),
  ),
});
export type CaseClaimHistory = z.infer<typeof CaseClaimHistorySchema>;
export type CaseHistoricalClaim = CaseClaimHistory["claims"][number];
export type CaseClaimSubject = z.infer<typeof CaseClaimSubjectSchema>;
export type CaseEntityTarget = z.infer<typeof CaseEntityTargetSchema>;
export function caseClaimHistoryJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(CaseClaimHistorySchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: CASE_CLAIM_HISTORY_SCHEMA_ID,
  };
}
