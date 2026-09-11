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
import {
  ResearchEntityReferenceSchema,
  ResearchEntityAssertionReferenceSchema,
  RESEARCH_ENTITIES_SCHEMA_ID,
} from "./research-entities-schema";
import {
  CredibilityFactorSchema,
  CredibilityDetractorSchema,
} from "../../extensions/testimony/credibility";
import { ConfidenceLevelSchema } from "../../shared";

const text = z.string().min(1).regex(/\S/, "must contain non-whitespace text");
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const claimRef = z
  .string()
  .regex(/^claim:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const inputRef = z
  .string()
  .regex(
    /^(?:claim|source|product|assertion|measurement):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/
  );
export const ResearchClaimSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("observation") }),
  z.strictObject({
    kind: z.literal("entity"),
    reference: ResearchEntityReferenceSchema,
  }),
  z.strictObject({
    kind: z.literal("context"),
    reference: ContextReferenceSchema,
  }),
  z.strictObject({ kind: z.literal("measurement"), measurementId: id }),
]);
export const WitnessReviewSchema = z
  .strictObject({
    rating: ConfidenceLevelSchema.optional(),
    factors: z
      .array(CredibilityFactorSchema)
      .optional()
      .describe(
        "Reviewer-selected factor labels; no built-in weighting or validation of their truth."
      ),
    detractors: z
      .array(CredibilityDetractorSchema)
      .optional()
      .describe(
        "Retained vocabulary for attributable reviews. Anonymity never adds a penalty automatically."
      ),
    consistentTestimony: z
      .enum(["consistent", "inconsistent", "unknown"])
      .optional(),
    multipleIndependent: z
      .enum(["independent", "not_independent", "unknown"])
      .optional(),
    notes: text.optional(),
  })
  .describe(
    "Attributable interpretation, separate from sourced qualifications; requires explicit inputs."
  );
const common = {
  id,
  recordedAt: instantString,
  topic: text,
  subject: ResearchClaimSubjectSchema,
  supersedes: z.array(claimRef).min(1).optional(),
};
export const ResearchSourceStatementSchema = z.strictObject({
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
  entityInputRefs: z.array(ResearchEntityAssertionReferenceSchema).optional(),
  rationale: text,
};
export const ResearchUnassessedClaimSchema = z.strictObject({
  ...assessment,
  status: z.literal("unassessed"),
});
export const ResearchAssessedClaimSchema = z.strictObject({
  ...assessment,
  status: z.literal("assessed"),
  outcome: z.enum(["reported", "confirmed", "absent", "inconclusive"]),
  evaluatedBy: text,
  evaluatedAt: instantString,
  methodRef: z.string().regex(/^method:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  methodVersion: text,
  confidence: z.number().min(0).max(1).optional(),
  witnessReview: WitnessReviewSchema.optional(),
});
export const ResearchHistoricalClaimSchema = z.union([
  ResearchSourceStatementSchema,
  ResearchUnassessedClaimSchema,
  ResearchAssessedClaimSchema,
]);
export const RESEARCH_CLAIM_HISTORY_SCHEMA_ID =
  "urn:disclosureos:experimental:claim-history:0.3.0";
export const RESEARCH_CLAIM_HISTORY_RULESET_VERSION = "0.3.0";
/** Separate review envelope: the embedded Observation keeps its immutable 0.1.0 contract. */
export const ResearchClaimHistorySchema = z.strictObject({
  kind: z.literal("claim_history"),
  schemaVersion: z.literal("0.3.0"),
  id,
  contextRefs: z.array(
    DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(OBSERVATION_CONTEXT_SCHEMA_ID),
    })
  ),
  entityRefs: z.array(
    DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(RESEARCH_ENTITIES_SCHEMA_ID),
    })
  ),
  observation: ExperimentalObservationSchema,
  claims: z.array(ResearchHistoricalClaimSchema),
  extensions: ExperimentalObservationSchema.shape.extensions,
});
export type ResearchClaimSubject = z.infer<typeof ResearchClaimSubjectSchema>;
export type ResearchSourceStatement = z.infer<
  typeof ResearchSourceStatementSchema
>;
export type ResearchUnassessedClaim = z.infer<
  typeof ResearchUnassessedClaimSchema
>;
export type ResearchAssessedClaim = z.infer<typeof ResearchAssessedClaimSchema>;
export type ResearchHistoricalClaim = z.infer<
  typeof ResearchHistoricalClaimSchema
>;
export type ResearchClaimHistory = z.infer<typeof ResearchClaimHistorySchema>;
export function researchClaimHistoryJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ResearchClaimHistorySchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: RESEARCH_CLAIM_HISTORY_SCHEMA_ID,
  };
}
