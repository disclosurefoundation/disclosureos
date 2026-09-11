import { z } from "zod";
import {
  ArchivalClaimHistorySchema,
  ArchivalClaimSubjectSchema,
  ArchivalSourceStatementSchema,
  ArchivalUnassessedClaimSchema,
  ArchivalAssessedClaimSchema,
  EditionCitationSchema,
} from "./archival-claim-history-schema";
import {
  LaboratoryEntityReferenceSchema,
  LaboratoryEntityAssertionReferenceSchema,
  LABORATORY_ENTITIES_SCHEMA_ID,
} from "./laboratory-entities-schema";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { EvidenceQualitySchema } from "../../extensions/physical/types";
import { ChainOfCustodySchema } from "../../extensions/provenance/custody";
const text = z.string().min(1).regex(/\S/);
export const MaterialReviewSchema = z
  .strictObject({
    quality: EvidenceQualitySchema.optional(),
    custody: ChainOfCustodySchema.optional(),
    contamination: z.enum(["reported", "not_detected", "unknown"]).optional(),
    representativeness: z
      .enum(["supported", "not_supported", "unknown"])
      .optional(),
    limitations: z.array(text).min(1).optional(),
    findings: text,
  })
  .describe(
    "An attributed material or analytical review, never an automatic quality, origin or scientific-validity finding.",
  );
export const LaboratoryEditionCitationSchema = EditionCitationSchema.extend({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(LABORATORY_ENTITIES_SCHEMA_ID),
  }),
});
export const LaboratoryClaimSubjectSchema = z.discriminatedUnion("kind", [
  ArchivalClaimSubjectSchema.options[0],
  z.strictObject({
    kind: z.literal("entity"),
    reference: LaboratoryEntityReferenceSchema,
  }),
  ArchivalClaimSubjectSchema.options[2],
  ArchivalClaimSubjectSchema.options[3],
]);
const subject = LaboratoryClaimSubjectSchema;
export const LaboratorySourceStatementSchema =
  ArchivalSourceStatementSchema.extend({
    subject,
    editionCitation: LaboratoryEditionCitationSchema.optional(),
    reportedMaterialReview: MaterialReviewSchema.optional(),
  });
const assessment = {
  subject,
  entityInputRefs: z.array(LaboratoryEntityAssertionReferenceSchema).optional(),
  editionInputRefs: z.array(LaboratoryEditionCitationSchema).optional(),
};
export const LaboratoryUnassessedClaimSchema =
  ArchivalUnassessedClaimSchema.extend(assessment);
export const LaboratoryAssessedClaimSchema = ArchivalAssessedClaimSchema.extend(
  { ...assessment, materialReview: MaterialReviewSchema.optional() },
);
export const LaboratoryHistoricalClaimSchema = z.union([
  LaboratorySourceStatementSchema,
  LaboratoryUnassessedClaimSchema,
  LaboratoryAssessedClaimSchema,
]);
export const LABORATORY_CLAIM_HISTORY_SCHEMA_ID =
  "urn:disclosureos:experimental:claim-history:0.5.0";
export const LaboratoryClaimHistorySchema = ArchivalClaimHistorySchema.extend({
  schemaVersion: z.literal("0.5.0"),
  claims: z.array(LaboratoryHistoricalClaimSchema),
  entityRefs: z.array(
    DocumentSnapshotRefSchema.extend({
      schemaId: z.literal(LABORATORY_ENTITIES_SCHEMA_ID),
    }),
  ),
});
export type LaboratoryHistoricalClaim = z.infer<
  typeof LaboratoryHistoricalClaimSchema
>;
export type LaboratoryClaimHistory = z.infer<
  typeof LaboratoryClaimHistorySchema
>;
export type LaboratoryEditionCitation = z.infer<
  typeof LaboratoryEditionCitationSchema
>;
export function laboratoryClaimHistoryJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(LaboratoryClaimHistorySchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: LABORATORY_CLAIM_HISTORY_SCHEMA_ID,
  };
}
