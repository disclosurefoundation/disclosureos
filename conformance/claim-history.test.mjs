import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseExperimentalClaimHistory, experimentalClaimHistoryJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const corpus = JSON.parse(readFileSync(new URL('./v2-claim-history-fixtures.json', import.meta.url)));
const artifact = JSON.parse(readFileSync(new URL('../packages/disclosureos-records/schema/experimental/claim-history-0.1.0.schema.json', import.meta.url)));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(artifact);
function inputFor(fixture) {
  const input = structuredClone(corpus.bases[fixture.base]);
  assert.ok(input);
  for (const change of fixture.changes) {
    assert.ok(change.path.length);
    let target = input;
    for (const segment of change.path.slice(0, -1)) {
      assert.ok(Object.hasOwn(target, segment));
      target = target[segment];
    }
    const key = change.path.at(-1);
    assert.ok(!['__proto__', 'constructor', 'prototype'].includes(key));
    if (change.op === 'remove') { assert.ok(Object.hasOwn(target, key)); delete target[key]; }
    else if (change.op === 'append') { assert.ok(Array.isArray(target[key])); target[key].push(structuredClone(change.value)); }
    else { assert.equal(change.op, 'replace'); Object.defineProperty(target, key, {value:structuredClone(change.value), enumerable:true, configurable:true, writable:true}); }
  }
  return input;
}
test('claim history artifact and fixture IDs are stable', () => {
  assert.deepEqual(artifact, experimentalClaimHistoryJsonSchema());
  assert.equal(new Set(corpus.cases.map(item => item.id)).size, corpus.cases.length);
});
for (const fixture of corpus.cases) test(`Claim history: ${fixture.id}`, () => {
  const input = inputFor(fixture);
  const original = structuredClone(input);
  const result = parseExperimentalClaimHistory(input);
  assert.equal(validate(input), fixture.structural, JSON.stringify(validate.errors));
  assert.equal(result.checks.structural, fixture.structural ? 'passed' : 'failed');
  assert.equal(result.checks.semantic, !fixture.structural ? 'not_checked' : fixture.semantic ? 'passed' : 'failed');
  assert.equal(result.checks.profile, 'not_checked');
  assert.equal(result.checks.external, 'not_checked');
  assert.equal(result.contract.schemaId, artifact.$id);
  assert.equal(result.contract.rulesetVersion, '0.1.0');
  assert.equal(result.success, fixture.structural && fixture.semantic === true);
  for (const code of fixture.codes) assert.ok(result.issues.some(issue => issue.code === code), `Missing ${code}`);
  assert.deepEqual(input, original);
  if (result.success) {
    assert.deepEqual(result.data, original);
    if (fixture.current) assert.deepEqual(result.currentClaimRefs, fixture.current);
    assert.deepEqual(parseExperimentalClaimHistory(JSON.parse(JSON.stringify(result.data))), result);
  } else {
    assert.ok(!Object.hasOwn(result, 'data'));
    assert.ok(!Object.hasOwn(result, 'currentClaimRefs'));
  }
});
test('synthetic example preserves attribution boundaries and unknown confidence', () => {
  const example = JSON.parse(readFileSync(new URL('../examples/v2/claim-history.json', import.meta.url)));
  assert.deepEqual(example, corpus.bases.integrated);
  const result = parseExperimentalClaimHistory(example);
  assert.equal(result.success, true);
  assert.ok(!Object.hasOwn(result.data.claims[0].provenance, 'attributedTo'));
  assert.ok(!Object.hasOwn(result.data.claims[2], 'confidence'));
  assert.equal(result.data.claims[0].reportedLevel, 'confirmed');
  assert.equal(result.data.claims[2].outcome, 'inconclusive');
});
test('embedded diagnostics retain their complete document pointers', () => {
  const input = structuredClone(corpus.bases.integrated);
  input.observation.updatedAt = '2000-01-01T00:00:00Z';
  const result = parseExperimentalClaimHistory(input);
  assert.ok(result.issues.some(issue => issue.code === 'TIME.RECORD_ORDER' && issue.pointer === '/observation/updatedAt'));
});
test('long revision chains use iterative traversal and preserve all earlier statements', () => {
  const input = structuredClone(corpus.bases.integrated);
  const original = input.claims[0];
  input.claims = [];
  for (let i = 0; i < 3000; i++) input.claims.push({...original, id:`r${i}`, ...(i ? {supersedes:[`claim:r${i-1}`]} : {})});
  const result = parseExperimentalClaimHistory(input);
  assert.equal(result.success, true);
  assert.equal(result.data.claims.length, 3000);
  assert.deepEqual(result.currentClaimRefs, ['claim:r2999']);
  input.claims[0].supersedes = ['claim:r2999'];
  assert.ok(parseExperimentalClaimHistory(input).issues.some(issue => issue.code === 'CLAIM.DEPENDENCY_CYCLE'));
});
test('offline parsing leaves externally declared content unchecked', () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('Unexpected network access'); };
    const input = structuredClone(corpus.bases.integrated);
    input.observation.sources[0].uri = 'https://example.invalid/missing.json';
    const result = parseExperimentalClaimHistory(input);
    assert.equal(result.success, true);
    assert.equal(result.checks.external, 'not_checked');
    assert.ok(result.uncheckedRefs.includes('source:s1'));
  } finally { globalThis.fetch = originalFetch; }
});
