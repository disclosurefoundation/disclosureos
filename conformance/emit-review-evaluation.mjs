import { writeFileSync } from 'node:fs';
import { observationClaimHistoryJsonSchema, caseRecordV02JsonSchema, caseClaimHistoryV02JsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';
import { claimReviewEvaluationJsonSchema, claimReviewReceiptJsonSchema } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
for (const [pkg, file, emit] of [
  ['records', 'claim-history-0.6.0', observationClaimHistoryJsonSchema],
  ['records', 'case-record-0.2.0', caseRecordV02JsonSchema],
  ['records', 'case-claim-history-0.2.0', caseClaimHistoryV02JsonSchema],
  ['schema', 'claim-review-evaluation-0.1.0', claimReviewEvaluationJsonSchema],
  ['schema', 'claim-review-receipt-0.1.0', claimReviewReceiptJsonSchema],
]) writeFileSync(new URL(`../packages/disclosureos-${pkg}/schema/experimental/${file}.schema.json`, import.meta.url), JSON.stringify(emit(), null, 2) + '\n');
