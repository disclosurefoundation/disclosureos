import { z } from 'zod';
import { ExperimentalObservationV02Schema, EXPERIMENTAL_OBSERVATION_SCHEMA_ID, EXPERIMENTAL_OBSERVATION_V02_SCHEMA_ID } from './observation-schema';
import { ExperimentalClaimHistorySchema } from './claim-history-schema';
import { DocumentSnapshotRefSchema } from './context-schema';
import { CaseRecordSchema, CASE_RECORD_SCHEMA_ID } from './case-schema';
import {
  CaseClaimHistorySchema, CaseEntityTargetSchema, CaseInputReferenceSchema,
  CaseSourceStatementSchema, CaseUnassessedClaimSchema, CaseAssessedClaimSchema,
  CaseRelationshipKindSchema,
} from './case-claim-history-schema';

// 0.2–0.5 are specialized context/entity envelopes. This explicitly selected
// observation-level revision retains the original source/measurement subjects.
export const OBSERVATION_CLAIM_HISTORY_SCHEMA_ID = 'urn:disclosureos:experimental:claim-history:0.6.0';
export const ObservationClaimHistorySchema = ExperimentalClaimHistorySchema.extend({
  schemaVersion: z.literal('0.6.0'), observation: ExperimentalObservationV02Schema,
});
export type ObservationClaimHistory = z.infer<typeof ObservationClaimHistorySchema>;

export const CASE_RECORD_V02_SCHEMA_ID = 'urn:disclosureos:experimental:case-record:0.2.0';
export const CaseRecordV02Schema = CaseRecordSchema.extend({
  schemaVersion: z.literal('0.2.0'),
  observationRefs: z.array(DocumentSnapshotRefSchema.extend({
    schemaId: z.enum([EXPERIMENTAL_OBSERVATION_SCHEMA_ID, EXPERIMENTAL_OBSERVATION_V02_SCHEMA_ID]),
  })).min(1),
});
export type CaseRecordV02 = z.infer<typeof CaseRecordV02Schema>;
const caseRef = DocumentSnapshotRefSchema.extend({ schemaId: z.enum([CASE_RECORD_SCHEMA_ID, CASE_RECORD_V02_SCHEMA_ID]) });
const id = CaseRecordSchema.shape.id;
const observationRef = z.strictObject({ case: caseRef, observationId: id });
const subject = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('case'), document: caseRef }),
  z.strictObject({ kind: z.literal('case_entity'), reference: z.strictObject({ document: caseRef, target: CaseEntityTargetSchema }) }),
  z.strictObject({ kind: z.literal('case_relation'), from: observationRef, to: observationRef, relation: CaseRelationshipKindSchema }),
]);
const inputs = {
  subject,
  caseInputRefs: z.array(z.discriminatedUnion('kind', [
    CaseInputReferenceSchema.options[0].extend({ document: caseRef }),
    CaseInputReferenceSchema.options[1].extend({ document: caseRef }),
  ])).optional(),
  observationInputRefs: z.array(observationRef.extend({ ref: CaseUnassessedClaimSchema.shape.observationInputRefs.unwrap().element.shape.ref })).optional(),
};
const claims = z.union([
  CaseSourceStatementSchema.extend({ subject, provenance: CaseSourceStatementSchema.shape.provenance.extend({ case: caseRef }) }),
  CaseUnassessedClaimSchema.extend(inputs),
  CaseAssessedClaimSchema.extend({ ...inputs, methodRef: observationRef.extend({ methodId: id }) }),
]);
export const CASE_CLAIM_HISTORY_V02_SCHEMA_ID = 'urn:disclosureos:experimental:case-claim-history:0.2.0';
export const CaseClaimHistoryV02Schema = CaseClaimHistorySchema.extend({
  schemaVersion: z.literal('0.2.0'), caseRefs: z.array(caseRef).min(1), claims: z.array(claims),
});
export type CaseClaimHistoryV02 = z.infer<typeof CaseClaimHistoryV02Schema>;
export type CaseHistoricalClaimV02 = CaseClaimHistoryV02['claims'][number];
const emit = (schema: z.ZodType, $id: string) => ({ ...z.toJSONSchema(schema, { target: 'draft-2020-12', reused: 'ref' }), $id });
export const observationClaimHistoryJsonSchema = () => emit(ObservationClaimHistorySchema, OBSERVATION_CLAIM_HISTORY_SCHEMA_ID);
export const caseRecordV02JsonSchema = () => emit(CaseRecordV02Schema, CASE_RECORD_V02_SCHEMA_ID);
export const caseClaimHistoryV02JsonSchema = () => emit(CaseClaimHistoryV02Schema, CASE_CLAIM_HISTORY_V02_SCHEMA_ID);
