import assert from 'node:assert/strict';
import { parseObservationClaimHistory, parseCaseRecordV02, parseCaseClaimHistoryV02 } from '@disclosureos/records/experimental/v2';
import { evaluateClaimReview, verifyClaimReviewReceipt } from '@disclosureos/schema/experimental/v2';
import { fixture, bytes } from './fixture.mjs';

const f = fixture();
assert.equal(parseObservationClaimHistory(f.history).success, true);
assert.equal(parseCaseRecordV02(f.caseRecord).success, true);
assert.equal(parseCaseClaimHistoryV02(f.caseHistory).success, true);
for (const review of [f.history, f.caseHistory]) {
  const request = f.request(review);
  const options = { reviewBytes: bytes(review), documents: f.documents, assets: f.assets };
  const result = await evaluateClaimReview(request, options);
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.equal(await verifyClaimReviewReceipt(result.receipt), true);
  const replay = await evaluateClaimReview(request, options);
  assert.deepEqual(replay.receipt, result.receipt);
  console.log(`${review.id}: declared support and exact snapshots passed; receipt reproduced.`);
}
assert.deepEqual(f.first.processing[0].performedAt, {state:'unknown',reason:'not_recorded'});
console.log('Unknown processing time preserved. Scientific eligibility, processing chronology and publication policy are not checked.');
