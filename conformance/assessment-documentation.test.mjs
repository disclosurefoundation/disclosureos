import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluateAssessmentDocumentation, ASSESSMENT_DOCUMENTATION_PROFILE } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
import { parseExperimentalClaimHistory } from '../packages/disclosureos-records/dist/experimental/v2/index.js';
const corpus = JSON.parse(readFileSync(new URL('./v2-assessment-documentation-fixtures.json', import.meta.url)));
function fixtureInput(fixture) {
  const input = structuredClone(corpus.base);
  for (const change of fixture.changes) {
    let target = input;
    for (const part of change.path.slice(0, -1)) { assert.ok(Object.hasOwn(target, part)); target = target[part]; }
    const key = change.path.at(-1);
    assert.ok(!['__proto__','constructor','prototype'].includes(key));
    if (change.op === 'remove') { assert.ok(Object.hasOwn(target,key)); delete target[key]; }
    else { assert.equal(change.op,'replace'); Object.defineProperty(target,key,{value:structuredClone(change.value),writable:true,enumerable:true,configurable:true}); }
  }
  return input;
}
function assetMap(fixture = {omitAssets:[],assetOverrides:{}}) {
  return new Map(Object.entries({...corpus.assets,...fixture.assetOverrides}).filter(([ref]) => !fixture.omitAssets.includes(ref)).map(([ref,text]) => [ref,new TextEncoder().encode(text)]));
}
for (const fixture of corpus.cases) test(`Assessment documentation: ${fixture.id}`, async () => {
  const input = fixtureInput(fixture);
  const original = structuredClone(input);
  const assets = assetMap(fixture);
  const originalAssets = new Map([...assets].map(([ref,bytes]) => [ref,bytes.slice()]));
  const parsed = parseExperimentalClaimHistory(input);
  const result = await evaluateAssessmentDocumentation(input,{assets});
  assert.equal(result.checks.structural,fixture.expected.structural);
  assert.equal(result.checks.semantic,fixture.expected.semantic);
  assert.equal(result.checks.profile,fixture.expected.profile,JSON.stringify(result.issues));
  assert.equal(result.checks.structural,parsed.checks.structural);
  assert.equal(result.checks.semantic,parsed.checks.semantic);
  assert.equal(result.success,fixture.expected.profile === 'passed');
  assert.equal(result.checks.external,['wrong-bytes','empty-bytes'].includes(fixture.id) ? 'failed' : 'not_checked');
  assert.equal(result.scientific,'not_checked');
  assert.equal(result.locatorContents,'not_checked');
  assert.equal(result.methodExecution,'not_checked');
  assert.deepEqual(result.profile,ASSESSMENT_DOCUMENTATION_PROFILE);
  for (const code of fixture.codes) assert.ok(result.issues.some(issue => issue.code === code),`Missing ${code}`);
  assert.deepEqual(input,original);
  assert.deepEqual(assets,originalAssets);
  for (const report of result.assessments) for (const asset of report.assets) if (asset.status === 'passed') {
    const expected = createHash('sha256').update(assets.get(asset.ref)).digest('hex');
    assert.equal(asset.actualSha256,expected);
    assert.equal(asset.expectedSha256,expected);
  }
});
test('synthetic files reproduce the documented example', async () => {
  const example = JSON.parse(readFileSync(new URL('../examples/v2/assessment-documentation.json',import.meta.url)));
  assert.deepEqual(example,corpus.base);
  const assets = new Map(Object.entries(corpus.assets).map(([ref,text]) => {
    const bytes = readFileSync(new URL(`../examples/v2/documentation-assets/${ref.replace(':','-')}.txt`,import.meta.url));
    assert.equal(bytes.toString(),text);
    return [ref,new Uint8Array(bytes)];
  }));
  assert.equal((await evaluateAssessmentDocumentation(example,{assets})).success,true);
  assert.ok(!Object.hasOwn(example.claims[1],'confidence'));
  assert.ok(Object.isFrozen(ASSESSMENT_DOCUMENTATION_PROFILE));
});
test('no implicit network access or verification from source labels', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('Unexpected network access'); };
    const result = await evaluateAssessmentDocumentation(corpus.base);
    assert.equal(result.checks.profile,'not_checked');
    assert.ok(result.issues.some(issue => issue.code === 'EXTERNAL.ASSET_UNAVAILABLE'));
  } finally { globalThis.fetch = original; }
});
test('caller mutation after invocation does not change the byte snapshot', async () => {
  const assets = assetMap();
  const input = structuredClone(corpus.base);
  const pending = evaluateAssessmentDocumentation(input,{assets});
  for (const bytes of assets.values()) bytes.fill(0);
  input.claims[1].inputRefs = [];
  assert.equal((await pending).success,true);
});
test('shared content is hashed once and produces no aggregated score', async () => {
  const input = structuredClone(corpus.base);
  input.claims.push({...input.claims[1],id:'second',evaluatedBy:'person:other'});
  const original = globalThis.crypto.subtle.digest;
  let count = 0;
  try {
    globalThis.crypto.subtle.digest = function(...args) {count++; return original.apply(this,args);};
    const result = await evaluateAssessmentDocumentation(input,{assets:assetMap()});
    assert.equal(result.success,true);
    assert.equal(count,3);
    assert.equal(result.assessments.length,2);
    assert.ok(!Object.hasOwn(result,'score'));
    assert.deepEqual(result.assessments[0].assets,result.assessments[1].assets);
  } finally { globalThis.crypto.subtle.digest = original; }
});
test('unavailable hashing cannot become a pass', async () => {
  const original = globalThis.crypto.subtle.digest;
  try {
    globalThis.crypto.subtle.digest = async () => {throw new Error('Unavailable');};
    const result = await evaluateAssessmentDocumentation(corpus.base,{assets:assetMap()});
    assert.equal(result.checks.profile,'not_checked');
    assert.ok(result.issues.some(issue => issue.code === 'EXTERNAL.HASH_UNAVAILABLE'));
  } finally { globalThis.crypto.subtle.digest = original; }
});
test('arbitrary processing chains are traversed without recursion', async () => {
  const input = structuredClone(corpus.base);
  const digest = input.observation.products[0].digest;
  const assets = assetMap();
  for (let i=0; i<1500; i++) {
    const id=`derived-${i}`;
    input.observation.products.push({id,kind:'derived',format:'application/json',access:'unknown',generatedBy:`process:${id}`,digest});
    input.observation.processing.push({id,methodRef:'method:reduction',methodVersion:'0.1.0',performedBy:'person:synthetic',performedAt:input.observation.createdAt,inputRefs:[i ? `product:derived-${i-1}`:'product:raw'],outputRefs:[`product:${id}`]});
    assets.set(`product:${id}`,assets.get('product:raw'));
  }
  input.observation.processing[0].inputRefs=['product:derived-1499'];
  assert.equal((await evaluateAssessmentDocumentation(input,{assets})).success,true);
});
