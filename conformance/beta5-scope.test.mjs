import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
import { fixture as newReview } from '../examples/v2/unknown-processing-review/fixture.mjs';

for (const [folder, evaluator] of [
  ['context-demo','evaluateContextClaimHistory'],
  ['witness-accounts-demo','evaluateResearchClaimHistory'],
  ['archival-editions-demo','evaluateArchivalClaimHistory'],
  ['laboratory-review-demo','evaluateLaboratoryClaimHistory'],
]) {
  const f = await import(`../examples/v2/${folder}/fixture.mjs`);
  const bundle = value => f.bundle ? f.bundle(value) : {history:value.history,options:{documents:f.documents(value)}};
  test(`${folder}: existing specialized review remains supported`, async () => {
    const b=bundle(f.fixture());
    const result=await s[evaluator](b.history,b.options);
    assert.equal(result.success,true,JSON.stringify(result));
  });
  test(`${folder}: Observation 0.2 is explicitly outside this specialized envelope`,async()=>{
    const b=bundle(f.fixture()); b.history.observation.schemaVersion='0.2.0';
    const before=structuredClone(b.history);
    const result=await s[evaluator](b.history,b.options);
    assert.equal(result.success,false);assert.equal(result.checks.structural,'failed');
    assert.deepEqual(b.history,before);
  });
  test(`${folder}: observation-level history 0.6 cannot masquerade as specialized review`,async()=>{
    const b=bundle(f.fixture());const result=await s[evaluator](newReview().history,b.options);
    assert.equal(result.success,false);assert.equal(result.checks.structural,'failed');
  });
}

for(const [folder,builder] of [
  ['case-presentation-demo','buildPublicCaseOutputs'],
  ['context-case-demo','buildPublicContextCaseOutputs'],
  ['testimony-case-demo','buildPublicTestimonyCaseOutputs'],
  ['archival-case-demo','buildPublicArchivalCaseOutputs'],
  ['material-case-demo','buildPublicMaterialCaseOutputs'],
]) {
  const f=await import(`../examples/v2/${folder}/fixture.mjs`);
  const run=(v,approval=f.approval(v))=>s[builder](f.bytes(v.presentation),{documents:f.documents(v),approval});
  test(`${folder}: selected public output remains supported`,async()=>assert.equal((await run(f.fixture())).success,true));
  test(`${folder}: output still requires exact presentation approval`,async()=>{
    const result=await run(f.fixture(),{presentationSha256:'0'.repeat(64),policyVersion:'unapproved'});
    assert.equal(result.success,false);assert.equal('data' in result,false);
  });
  test(`${folder}: new case revision cannot bypass the public-display boundary`,async()=>{
    const v=f.fixture(); const pin=v.presentation.caseRef ?? v.presentation.presentation?.caseRef;
    assert.ok(pin);pin.schemaId='urn:disclosureos:experimental:case-record:0.2.0';
    const result=await run(v);assert.equal(result.success,false);assert.equal('data' in result,false);
  });
}
test('legacy completion does not produce assessment reports for the new review envelope',async()=>{
  const result=await s.evaluateDocumentationCompletion(newReview().history);
  assert.equal(result.validation.success,false);assert.equal(result.applicability.state,'not_checked');assert.deepEqual(result.assessments,[]);
});
