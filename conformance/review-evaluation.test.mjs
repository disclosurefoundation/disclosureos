import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as r from '../packages/disclosureos-records/dist/experimental/v2/index.js';
import * as s from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
import { fixture, bytes, sha, snapshot } from '../examples/v2/unknown-processing-review/fixture.mjs';
const clone = structuredClone;
const observationRun = f => s.evaluateClaimReview(f.request(f.history), { reviewBytes: bytes(f.history), assets: f.assets });
const caseRun = f => s.evaluateClaimReview(f.request(f.caseHistory), { reviewBytes: bytes(f.caseHistory), documents: f.documents });
const hasIssue = (result, code) => assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result));

// These are contract scenarios, not provider data or scientific validation.
test('new observation history retains unknown processing time, provenance and claim identity', async () => {
  const f = fixture(), before = clone(f.history), assets = clone(f.assets);
  const parsed = r.parseObservationClaimHistory(f.history);
  assert.equal(parsed.success, true); assert.deepEqual(parsed.data, before);
  assert.deepEqual(parsed.currentClaimRefs, ['claim:review-a']);
  const result = await observationRun(f);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.output.profile.version, '0.2.0');
  assert.deepEqual(result.output.unknownProcessingTimes, [{processRef:'process:prepare', performedAt:{state:'unknown',reason:'not_recorded'}}]);
  assert.equal(result.output.assessments[0].assets.length, 2);
  assert.equal(result.processingChronology, 'not_checked');
  assert.equal(result.scientificEligibility, 'not_checked');
  assert.equal(result.publicationPolicy, 'not_checked');
  assert.equal(result.output.methodExecution, 'not_checked');
  assert.deepEqual(f.history, before); assert.deepEqual(clone(f.assets), assets);
  assert.equal(await s.verifyClaimReviewReceipt(result.receipt), true);
  // Independent Node crypto calculation, separate from the browser-compatible verifier.
  assert.equal(sha(Buffer.from(result.receipt.inputJson)), result.receipt.input.sha256);
  assert.equal(sha(Buffer.from(result.receipt.outputJson)), result.receipt.output.sha256);
  assert.equal(Buffer.byteLength(result.receipt.inputJson), result.receipt.input.byteLength);
  assert.deepEqual(JSON.parse(result.receipt.inputJson).request, f.request(f.history));
});
test('case review resolves mixed observation revisions without rewriting either snapshot', async () => {
  const f = fixture(), before = clone(f.caseHistory);
  const result = await caseRun(f);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.deepEqual(result.output.currentClaimRefs, ['claim:case-assessment']);
  assert.deepEqual(result.output.snapshots.map(x => x.schemaId), [r.CASE_RECORD_V02_SCHEMA_ID,r.EXPERIMENTAL_OBSERVATION_V02_SCHEMA_ID,r.EXPERIMENTAL_OBSERVATION_SCHEMA_ID]);
  assert.equal(result.output.sourceArtifactIntegrity, 'not_checked');
  assert.equal(result.output.lifecycleChanges, 'not_performed');
  assert.deepEqual(f.caseHistory, before);
});
test('new case history can reference a legacy case with only legacy observations', async () => {
  const f = fixture();
  const c = clone(f.caseRecord); c.schemaVersion = '0.1.0'; c.entities[0].fromObservationId = f.second.id; c.entities[0].toObservationId = 'capture-c'; c.entities[0].basis.provenance.observationId = f.second.id;
  const third = clone(f.second); third.id = 'capture-c';
  c.observationRefs = [snapshot(f.second,'observation'), snapshot(third,'observation')];
  f.documents.set(sha(bytes(third)), bytes(third));
  const pin = snapshot(c,'case-record');
  const h = clone(f.caseHistory); h.caseRefs = [pin];
  const claim = h.claims[0]; claim.subject = {kind:'case',document:pin};
  claim.observationInputRefs = [{case:pin,observationId:f.second.id,ref:'measurement:reading'}];
  claim.methodRef = {case:pin,observationId:f.second.id,methodId:'review'};
  f.documents.set(pin.sha256,bytes(c));
  const result = await s.evaluateCaseClaimHistoryV02(h,{documents:f.documents});
  assert.equal(result.success,true,JSON.stringify(result));
});
test('legacy contracts and evaluators reject the new envelopes', async () => {
  const f=fixture();
  for(const [parse,input] of [[r.parseExperimentalClaimHistory,f.history],[r.parseCaseRecord,f.caseRecord],[r.parseCaseClaimHistory,f.caseHistory]]) assert.equal(parse(input).success,false);
  assert.equal((await s.evaluateAssessmentDocumentation(f.history,{assets:f.assets})).success,false);
  assert.equal((await s.evaluateCaseRecord(f.caseRecord,{documents:f.documents})).success,false);
  assert.equal((await s.evaluateCaseClaimHistory(f.caseHistory,{documents:f.documents})).success,false);
  const h=clone(f.history); h.schemaVersion='0.1.0'; h.observation=clone(f.second);
  assert.equal(r.parseExperimentalClaimHistory(h).success,true);
  assert.equal(r.parseObservationClaimHistory(h).success,false);
});
test('exact times remain valid in the new observation contract', () => {
  const f=fixture(); f.first.processing[0].performedAt='2026-09-30T12:00:00Z';
  assert.equal(r.parseObservationClaimHistory(f.history).success,true);
});
test('correct digest does not excuse a wrong observation revision', async () => {
  const f=fixture(); f.caseRecord.observationRefs[0].schemaId=r.EXPERIMENTAL_OBSERVATION_SCHEMA_ID;
  const result=await s.evaluateCaseRecordV02(f.caseRecord,{documents:f.documents});
  assert.equal(result.success,false); hasIssue(result,'SNAPSHOT.CONTRACT');
});
test('correct digest does not excuse a wrong case revision', async () => {
  const f=fixture();
  f.caseHistory=JSON.parse(JSON.stringify(f.caseHistory).replaceAll(r.CASE_RECORD_V02_SCHEMA_ID,r.CASE_RECORD_SCHEMA_ID));
  const result=await s.evaluateCaseClaimHistoryV02(f.caseHistory,{documents:f.documents});
  assert.equal(result.success,false); hasIssue(result,'SNAPSHOT.CONTRACT');
});
for(const mode of ['missing','corrupt']) test(`case snapshot ${mode} cannot pass`,async()=>{
  const f=fixture(), key=f.caseRecord.observationRefs[0].sha256;
  if(mode==='missing') f.documents.delete(key); else f.documents.set(key,Buffer.from('altered'));
  const result=await caseRun(f); assert.equal(result.success,false);
  assert.equal(await s.verifyClaimReviewReceipt(result.receipt),true); // A failed result is still reproducible.
});
for(const [name,change] of [
  ['producer link',h=>h.observation.products[1].generatedBy='process:absent'],
  ['method revision',h=>h.observation.processing[0].methodVersion='unregistered'],
  ['missing input',h=>h.claims[0].inputRefs=['measurement:absent']],
  ['duplicate claim',h=>h.claims.push(clone(h.claims[0]))],
  ['self supersession',h=>h.claims[0].supersedes=['claim:review-a']],
]) test(`new history preserves semantic validation: ${name}`,()=>{
  const f=fixture(); change(f.history); assert.equal(r.parseObservationClaimHistory(f.history).success,false);
});
test('independent evaluators can disagree without overwriting a prior claim',()=>{
  const f=fixture(); f.history.claims.push({...clone(f.history.claims[0]),id:'review-b',evaluatedBy:'Another reviewer',outcome:'absent'});
  const result=r.parseObservationClaimHistory(f.history);
  assert.equal(result.success,true); assert.deepEqual(result.currentClaimRefs,['claim:review-a','claim:review-b']);
});
for(const mode of ['missing','corrupt']) test(`source bytes ${mode} do not pass documentary evaluation`,async()=>{
  const f=fixture(); if(mode==='missing') f.assets.delete('product:original'); else f.assets.set('product:original',Buffer.from('altered'));
  const result=await observationRun(f); assert.equal(result.success,false); assert.equal(result.scientificEligibility,'not_checked');
  assert.equal(await s.verifyClaimReviewReceipt(result.receipt),true);
});
test('a confirmed claim does not bypass missing event time and uncertainty',async()=>{
  const f=fixture(); f.history.claims[0].outcome='confirmed';
  const result=await observationRun(f); assert.equal(result.success,false);
  assert.equal(result.output.checks.profile,'failed');
});
for(const [name,edit,code] of [
  ['wrong digest',(q,o)=>q.review.sha256='0'.repeat(64),'SNAPSHOT.DIGEST'],
  ['wrong identity',(q,o)=>q.review.documentId='other','SNAPSHOT.IDENTITY'],
  ['wrong contract',(q,o)=>q.review.schemaId=r.CASE_CLAIM_HISTORY_V02_SCHEMA_ID,'SNAPSHOT.CONTRACT'],
  ['unavailable',(q,o)=>delete o.reviewBytes,'SNAPSHOT.UNAVAILABLE'],
  ['invalid UTF8',(q,o)=>{o.reviewBytes=Buffer.from([255]);q.review.sha256=sha(o.reviewBytes)},'SNAPSHOT.JSON'],
]) test(`review request rejects ${name}`,async()=>{
  const f=fixture(),q=f.request(f.history),o={reviewBytes:bytes(f.history),assets:f.assets}; edit(q,o);
  const result=await s.evaluateClaimReview(q,o); assert.equal(result.success,false); assert.equal(result.receipt,null); hasIssue(result,code);
});
test('legacy review cannot be mislabeled as the new request contract',async()=>{
  const f=fixture(); const q=f.request(f.history); f.history.schemaVersion='0.1.0'; f.history.observation=f.second;
  q.review.sha256=sha(bytes(f.history));
  const result=await s.evaluateClaimReview(q,{reviewBytes:bytes(f.history),assets:f.assets});
  assert.equal(result.success,false); hasIssue(result,'SNAPSHOT.CONTRACT');
});
test('receipt replay is deterministic and independent of map insertion order',async()=>{
  const f=fixture(), first=await caseRun(f);
  f.documents=new Map([...f.documents].reverse());
  const second=await caseRun(f); assert.deepEqual(second.receipt,first.receipt);
  f.documents.set('unreferenced',Buffer.from('retained auxiliary bytes'));
  const third=await caseRun(f); assert.notEqual(third.receipt.input.sha256,first.receipt.input.sha256);
  assert.equal(third.receipt.output.sha256,first.receipt.output.sha256);
});
test('receipt captures buffers and request before the first asynchronous operation',async()=>{
  const f=fixture(), expected=await caseRun(f), request=f.request(f.caseHistory), reviewBytes=bytes(f.caseHistory);
  const pending=s.evaluateClaimReview(request,{reviewBytes,documents:f.documents});
  reviewBytes.fill(0); for(const b of f.documents.values()) b.fill(0); request.review.documentId='mutated';
  assert.deepEqual((await pending).receipt,expected.receipt);
});
test('receipt detects altered serialization, digest, length and policy',async()=>{
  const f=fixture(), {receipt}=await observationRun(f);
  for(const edit of [r=>r.inputJson+=' ',r=>r.outputJson=r.outputJson.replace('passed','failed'),r=>r.output.sha256='0'.repeat(64),r=>r.input.byteLength++,r=>r.policy.version='0.2.0']) {
    const changed=clone(receipt);edit(changed); assert.equal(await s.verifyClaimReviewReceipt(changed),false);
  }
});
test('no network calls or automatic lifecycle changes',async()=>{
  const original=globalThis.fetch;
  try {globalThis.fetch=()=>{throw new Error('Unexpected network')}; const f=fixture(); assert.equal((await observationRun(f)).success,true); assert.equal((await caseRun(f)).success,true)}
  finally {globalThis.fetch=original}
});
test('generated schema artifacts agree with the public schema functions and accept the examples',async()=>{
  const f=fixture(),{receipt}=await observationRun(f);
  const ajv=new Ajv2020({strict:false});addFormats(ajv);
  for(const [pkg,file,emit,value] of [
    ['records','claim-history-0.6.0',r.observationClaimHistoryJsonSchema,f.history],
    ['records','case-record-0.2.0',r.caseRecordV02JsonSchema,f.caseRecord],
    ['records','case-claim-history-0.2.0',r.caseClaimHistoryV02JsonSchema,f.caseHistory],
    ['schema','claim-review-evaluation-0.1.0',s.claimReviewEvaluationJsonSchema,f.request(f.history)],
    ['schema','claim-review-receipt-0.1.0',s.claimReviewReceiptJsonSchema,receipt],
  ]) {
    const artifact=JSON.parse(readFileSync(new URL(`../packages/disclosureos-${pkg}/schema/experimental/${file}.schema.json`,import.meta.url)));
    assert.deepEqual(artifact,emit()); const validate=ajv.compile(artifact); assert.equal(validate(value),true,JSON.stringify(validate.errors));
    assert.equal(validate({...value,schemaVersion:'99.0.0'}),false);
  }
});
