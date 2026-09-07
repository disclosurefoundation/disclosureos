import { z } from 'zod';
import { ExperimentalObservationSchema, ObservationAssertionSchema } from './observation-schema';
import { instantString } from './primitives';

const text = z.string().min(1).regex(/\S/, 'must contain non-whitespace text');
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const claimRef = z.string().regex(/^claim:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const inputRef = z.string().regex(/^(?:claim|source|product|assertion|measurement):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const ClaimSubjectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('observation') }),
  z.strictObject({ kind: z.literal('measurement'), measurementId: id }),
]);
const common = {
  id, recordedAt: instantString, topic: text, subject: ClaimSubjectSchema,
  supersedes: z.array(claimRef).min(1).optional(),
};
export const SourceStatementSchema = z.strictObject({
  ...common, kind: z.literal('source_assertion'), text,
  reportedLevel: text.optional(), provenance: ObservationAssertionSchema.options[0].shape.provenance,
});
const assessment = { ...common, kind: z.literal('assessment'), inputRefs: z.array(inputRef), rationale: text };
export const UnassessedClaimSchema = z.strictObject({ ...assessment, status: z.literal('unassessed') });
export const AssessedClaimSchema = z.strictObject({
  ...assessment, status: z.literal('assessed'),
  outcome: z.enum(['reported', 'confirmed', 'absent', 'inconclusive']),
  evaluatedBy: text, evaluatedAt: instantString,
  methodRef: z.string().regex(/^method:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/), methodVersion: text,
  confidence: z.number().min(0).max(1).optional(),
});
export const HistoricalClaimSchema = z.union([SourceStatementSchema, UnassessedClaimSchema, AssessedClaimSchema]);
export const EXPERIMENTAL_CLAIM_HISTORY_SCHEMA_ID = 'urn:disclosureos:experimental:claim-history:0.1.0';
export const CLAIM_HISTORY_RULESET_VERSION = '0.1.0';
/** Separate review envelope: the embedded Observation keeps its immutable 0.1.0 contract. */
export const ExperimentalClaimHistorySchema = z.strictObject({
  kind: z.literal('claim_history'), schemaVersion: z.literal('0.1.0'), id,
  observation: ExperimentalObservationSchema, claims: z.array(HistoricalClaimSchema),
  extensions: ExperimentalObservationSchema.shape.extensions,
});
export type ClaimSubject = z.infer<typeof ClaimSubjectSchema>;
export type SourceStatement = z.infer<typeof SourceStatementSchema>;
export type UnassessedClaim = z.infer<typeof UnassessedClaimSchema>;
export type AssessedClaim = z.infer<typeof AssessedClaimSchema>;
export type HistoricalClaim = z.infer<typeof HistoricalClaimSchema>;
export type ExperimentalClaimHistory = z.infer<typeof ExperimentalClaimHistorySchema>;
export function experimentalClaimHistoryJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(ExperimentalClaimHistorySchema, { target: 'draft-2020-12' }), $id: EXPERIMENTAL_CLAIM_HISTORY_SCHEMA_ID };
}
