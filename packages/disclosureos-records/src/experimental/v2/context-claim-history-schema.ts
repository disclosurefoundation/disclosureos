import { z } from "zod";
import {
  ExperimentalObservationSchema,
  ObservationAssertionSchema,
} from "./observation-schema";
import { instantString } from "./primitives";
import {
  ContextReferenceSchema,
  ContextAssertionReferenceSchema,
  DocumentSnapshotRefSchema,
  OBSERVATION_CONTEXT_SCHEMA_ID,
} from "./context-schema";

const text = z.string().min(1).regex(/\S/, "must contain non-whitespace text");
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const claimRef = z
  .string()
  .regex(/^claim:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const inputRef = z
  .string()
  .regex(
    /^(?:claim|source|product|assertion|measurement):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/,
  );
export const ContextClaimSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("observation") }),
  z.strictObject({
    kind: z.literal("context"),
    reference: ContextReferenceSchema,
  }),
  z.strictObject({ kind: z.literal("measurement"), measurementId: id }),
]);
const common = {
  id,
  recordedAt: instantString,
  topic: text,
  subject: ContextClaimSubjectSchema,
  supersedes: z.array(claimRef).min(1).optional(),
};
export const ContextSourceStatementSchema = z.strictObject({
  ...common,
  kind: z.literal("source_assertion"),
  text,
  reportedLevel: text.optional(),
  provenance: ObservationAssertionSchema.options[0].shape.provenance,
});
const assessment = {
  ...common,
  kind: z.literal("assessment"),
  inputRefs: z.array(inputRef),
  contextInputRefs: z.array(ContextAssertionReferenceSchema).optional(),
  rationale: text,
};
export const ContextUnassessedClaimSchema = z.strictObject({
  ...assessment,
  status: z.literal("unassessed"),
});
export const ContextAssessedClaimSchema = z.strictObject({
  ...assessment,
  status: z.literal("assessed"),
  outcome: z.enum(["reported", "confirmed", "absent", "inconclusive"]),
  evaluatedBy: text,
  evaluatedAt: instantString,
  methodRef: z.string().regex(/^method:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  methodVersion: text,
  confidence: z.number().min(0).max(1).optional(),
});
export const ContextHistoricalClaimSchema = z.union([
  ContextSourceStatementSchema,
  ContextUnassessedClaimSchema,
  ContextAssessedClaimSchema,
]);
export const CONTEXT_CLAIM_HISTORY_SCHEMA_ID =
  "urn:disclosureos:experimental:claim-history:0.2.0";
export const CONTEXT_CLAIM_HISTORY_RULESET_VERSION = "0.2.0";
/** Separate review envelope: the embedded Observation keeps its immutable 0.1.0 contract. */
export const ContextClaimHistorySchema = z.strictObject({
  kind: z.literal("claim_history"),
  schemaVersion: z.literal("0.2.0"),
  id,
  contextRefs: z.array(
    DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(OBSERVATION_CONTEXT_SCHEMA_ID),
    }),
  ),
  observation: ExperimentalObservationSchema,
  claims: z.array(ContextHistoricalClaimSchema),
  extensions: ExperimentalObservationSchema.shape.extensions,
});
export type ContextClaimSubject = z.infer<typeof ContextClaimSubjectSchema>;
export type ContextSourceStatement = z.infer<
  typeof ContextSourceStatementSchema
>;
export type ContextUnassessedClaim = z.infer<
  typeof ContextUnassessedClaimSchema
>;
export type ContextAssessedClaim = z.infer<typeof ContextAssessedClaimSchema>;
export type ContextHistoricalClaim = z.infer<
  typeof ContextHistoricalClaimSchema
>;
export type ContextClaimHistory = z.infer<typeof ContextClaimHistorySchema>;
export function contextClaimHistoryJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ContextClaimHistorySchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: CONTEXT_CLAIM_HISTORY_SCHEMA_ID,
  };
}
