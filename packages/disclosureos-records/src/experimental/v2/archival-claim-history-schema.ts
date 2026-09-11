import { z } from "zod";
import {
  ResearchClaimHistorySchema,
  ResearchClaimSubjectSchema,
  ResearchSourceStatementSchema,
  ResearchUnassessedClaimSchema,
  ResearchAssessedClaimSchema,
} from "./research-claim-history-schema";
import {
  ArchivalEntityReferenceSchema,
  ArchivalEntityAssertionReferenceSchema,
  ArtifactSnapshotRefSchema,
  ARCHIVAL_ENTITIES_SCHEMA_ID,
} from "./archival-entities-schema";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { SourceProvenanceSchema, EventTimeValueSchema } from "./primitives";
import {
  VerificationMethodSchema,
  VerificationResultSchema,
} from "../../extensions/provenance/digital";
import { SourceCredibilitySchema } from "../../source/credibility";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const EditionCitationSchema = z
  .strictObject({
    document: DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(ARCHIVAL_ENTITIES_SCHEMA_ID),
    }),
    editionId: id,
    artifact: ArtifactSnapshotRefSchema,
    locator: SourceProvenanceSchema.shape.locator.unwrap(),
  })
  .describe(
    "A citation bound to an exact edition declaration and artifact digest. Similar titles do not permit edition substitution.",
  );
export const ArtifactReviewSchema = z
  .strictObject({
    verifier: text.optional(),
    organization: text.optional(),
    credentials: text.optional(),
    reviewedAt: EventTimeValueSchema.optional(),
    verificationMethod: VerificationMethodSchema.optional(),
    methodDescription: text.optional(),
    result: VerificationResultSchema.optional(),
    confidence: z.enum(["high", "medium", "low", "unassessed"]).optional(),
    sourceCredibility: SourceCredibilitySchema.optional(),
    findings: text.optional(),
    reportRef: ArtifactSnapshotRefSchema.shape.sourceRef.optional(),
    reportUrl: z.url().optional(),
    manipulationDetected: z.boolean().optional(),
    manipulationDescription: text.optional(),
    notes: text.optional(),
  })
  .describe(
    "An attributed authenticity or source-credibility review, not an automatic result of snapshot validation.",
  );
export const ArchivalClaimSubjectSchema = z.discriminatedUnion("kind", [
  ResearchClaimSubjectSchema.options[0],
  z.strictObject({
    kind: z.literal("entity"),
    reference: ArchivalEntityReferenceSchema,
  }),
  ResearchClaimSubjectSchema.options[2],
  ResearchClaimSubjectSchema.options[3],
]);
const subject = ArchivalClaimSubjectSchema;
export const ArchivalSourceStatementSchema =
  ResearchSourceStatementSchema.extend({
    subject,
    editionCitation: EditionCitationSchema.optional(),
    reportedArtifactReview: ArtifactReviewSchema.optional(),
  });
const assessment = {
  subject,
  entityInputRefs: z.array(ArchivalEntityAssertionReferenceSchema).optional(),
  editionInputRefs: z.array(EditionCitationSchema).optional(),
};
export const ArchivalUnassessedClaimSchema =
  ResearchUnassessedClaimSchema.extend(assessment);
export const ArchivalAssessedClaimSchema = ResearchAssessedClaimSchema.extend({
  ...assessment,
  artifactReview: ArtifactReviewSchema.optional(),
});
export const ArchivalHistoricalClaimSchema = z.union([
  ArchivalSourceStatementSchema,
  ArchivalUnassessedClaimSchema,
  ArchivalAssessedClaimSchema,
]);
export const ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID =
  "urn:disclosureos:experimental:claim-history:0.4.0";
export const ArchivalClaimHistorySchema = ResearchClaimHistorySchema.extend({
  schemaVersion: z.literal("0.4.0"),
  claims: z.array(ArchivalHistoricalClaimSchema),
  entityRefs: z.array(
    DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(ARCHIVAL_ENTITIES_SCHEMA_ID),
    }),
  ),
});
export type ArchivalHistoricalClaim = z.infer<
  typeof ArchivalHistoricalClaimSchema
>;
export type ArchivalClaimHistory = z.infer<typeof ArchivalClaimHistorySchema>;
export type EditionCitation = z.infer<typeof EditionCitationSchema>;
export function archivalClaimHistoryJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ArchivalClaimHistorySchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID,
  };
}
