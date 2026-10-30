import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExperimentalObservation,
  parseExperimentalClaimHistory,
  parseContextClaimHistory,
  parseResearchClaimHistory,
  parseArchivalClaimHistory,
  parseLaboratoryClaimHistory,
} from '../packages/disclosureos-records/dist/experimental/v2/index.js';
import {
  evaluateVideoFrameSourceMapping,
  evaluateMcapSourceMapping,
  evaluateCaseRecord,
  evaluateAssessmentDocumentation,
} from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
import { fixture as videoFixture } from '../examples/v2/video-frame-source-demo/fixture.mjs';
import { fixture as mcapFixture } from '../examples/v2/mcap-source-demo/fixture.mjs';
import { fixture as caseFixture, refresh, documents } from '../examples/v2/connected-case-demo/fixture.mjs';

// Author a derivative without inventing a processing timestamp. The fixture
// resolvers are test doubles, not real MCAP or video decoders.
function withUnknownProcessing(observation, productId) {
  observation.schemaVersion = '0.2.0';
  const product = observation.products.find(p => p.id === productId);
  const inputRefs = product.sourceRefs;
  delete product.sourceRefs;
  product.kind = 'derived';
  product.generatedBy = 'process:derive';
  observation.methods.push({ id: 'derive', version: '1', description: 'Synthetic processing receipt with no retained date.' });
  observation.processing.push({
    id: 'derive', methodRef: 'method:derive', methodVersion: '1',
    performedBy: 'Fixture producer', performedAt: { state: 'unknown', reason: 'not_recorded' },
    inputRefs, outputRefs: [`product:${productId}`],
  });
}

for (const [label, fixture, productId, evaluate, contentCheck] of [
  ['video', videoFixture, 'video', evaluateVideoFrameSourceMapping, 'frameTiming'],
  ['MCAP', mcapFixture, 'mcap', evaluateMcapSourceMapping, 'content'],
]) {
  test(`${label} mapping preserves an Observation 0.2.0 derivative and its unknown processing time`, async () => {
    const f = fixture();
    withUnknownProcessing(f.observation, productId);
    const before = structuredClone(f.observation);
    assert.equal(parseExperimentalObservation(f.observation).success, true);
    const result = await evaluate(f.observation, f.mapping, f);
    assert.equal(result.success, true, JSON.stringify(result.issues));
    assert.equal(result.checks.external, 'passed');
    assert.equal(result.checks[contentCheck], 'passed');
    assert.equal(result.scientific, 'not_checked');
    assert.deepEqual(f.observation, before);
    if (label === 'video') {
      assert.equal(result.selections[0].reference.presentationTick, '9007199254744593');
      assert.equal(result.captureTime, 'not_checked');
    } else assert.equal(result.selections[0].value, 1.25);
  });
  test(`${label} mapping still rejects broken processing lineage`, async () => {
    const f = fixture();
    withUnknownProcessing(f.observation, productId);
    f.observation.processing.at(-1).outputRefs = ['product:absent'];
    const result = await evaluate(f.observation, f.mapping, f);
    assert.equal(result.success, false);
    assert.equal(result.checks.semantic, 'failed');
    assert.equal(result.checks.external, 'not_checked');
  });
}

for (const [version, parse, refs] of [
  ['0.1.0', parseExperimentalClaimHistory, {}],
  ['0.2.0', parseContextClaimHistory, { contextRefs: [] }],
  ['0.3.0', parseResearchClaimHistory, { contextRefs: [], entityRefs: [] }],
  ['0.4.0', parseArchivalClaimHistory, { contextRefs: [], entityRefs: [] }],
  ['0.5.0', parseLaboratoryClaimHistory, { contextRefs: [], entityRefs: [] }],
]) {
  test(`claim history ${version} retains its published Observation 0.1.0 boundary`, () => {
    const h = { kind: 'claim_history', schemaVersion: version, id: 'history', observation: mcapFixture().observation, claims: [], ...refs };
    assert.equal(parse(h).success, true);
    withUnknownProcessing(h.observation, 'mcap');
    assert.equal(parseExperimentalObservation(h.observation).success, true);
    const result = parse(h);
    assert.equal(result.success, false);
    assert.equal(result.checks.structural, 'failed');
    assert.equal(result.checks.profile, 'not_checked');
    assert.equal(result.contract.schemaId, `urn:disclosureos:experimental:claim-history:${version}`);
    assert.ok(result.issues.some(i => i.pointer.startsWith('/observation/')));
  });
}

test('documentary evaluation does not silently upgrade an unsupported history', async () => {
  const observation = mcapFixture().observation;
  withUnknownProcessing(observation, 'mcap');
  const result = await evaluateAssessmentDocumentation({ kind: 'claim_history', schemaVersion: '0.1.0', id: 'history', observation, claims: [] });
  assert.equal(result.success, false);
  assert.equal(result.checks.structural, 'failed');
  assert.equal(result.checks.profile, 'not_checked');
  assert.equal(result.scientific, 'not_checked');
});

test('case references cannot label a valid 0.2.0 snapshot as Observation 0.1.0', async () => {
  const f = caseFixture();
  f.first.schemaVersion = '0.2.0';
  assert.equal(parseExperimentalObservation(f.first).success, true);
  // Rehash the actual bytes while deliberately preserving the old schema ID.
  // A correct digest and document ID are insufficient to satisfy a version pin.
  refresh(f);
  const result = await evaluateCaseRecord(f.caseRecord, { documents: documents(f) });
  assert.equal(result.success, false);
  assert.equal(result.snapshots[0].status, 'failed');
  assert.ok(result.issues.some(i => i.code === 'SNAPSHOT.CONTRACT' && i.pointer === '/observationRefs/0'));
});
