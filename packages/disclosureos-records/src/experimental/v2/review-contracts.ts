import { parseObservationClaims } from './claim-history';
import { parseCaseRecordWithSchema } from './case';
import { parseCaseClaimsWithSchema } from './case-claim-history';
import {
  ObservationClaimHistorySchema, OBSERVATION_CLAIM_HISTORY_SCHEMA_ID,
  CaseRecordV02Schema, CASE_RECORD_V02_SCHEMA_ID,
  CaseClaimHistoryV02Schema, CASE_CLAIM_HISTORY_V02_SCHEMA_ID,
} from './review-contracts-schema';
export function parseObservationClaimHistory(input: unknown) {
  return parseObservationClaims(input, ObservationClaimHistorySchema, { kind: 'claim_history', schemaId: OBSERVATION_CLAIM_HISTORY_SCHEMA_ID, rulesetVersion: '0.6.0' } as const);
}
export function parseCaseRecordV02(input: unknown) {
  return parseCaseRecordWithSchema(input, CaseRecordV02Schema, { schemaId: CASE_RECORD_V02_SCHEMA_ID, rulesetVersion: '0.2.0' } as const);
}
export function parseCaseClaimHistoryV02(input: unknown) {
  return parseCaseClaimsWithSchema(input, CaseClaimHistoryV02Schema, { schemaId: CASE_CLAIM_HISTORY_V02_SCHEMA_ID, rulesetVersion: '0.2.0' } as const);
}
