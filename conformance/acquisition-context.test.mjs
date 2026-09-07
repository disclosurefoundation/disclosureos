import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseAcquisitionContext, acquisitionContextJsonSchema } from '../packages/disclosureos-instruments/dist/experimental/v2/index.js';
import { compareUtcInstants } from '../packages/disclosureos-records/dist/experimental/v2/index.js';
const corpus=JSON.parse(readFileSync(new URL('./v2-acquisition-context-fixtures.json',import.meta.url)));
const artifact=JSON.parse(readFileSync(new URL('../packages/disclosureos-instruments/schema/experimental/acquisition-context-0.1.0.schema.json',import.meta.url)));
const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);const validate=ajv.compile(artifact);
function fixtureInput(fixture) {
 const input=structuredClone(corpus.base);
 for(const change of fixture.changes) {
  let target=input;
  for(const part of change.path.slice(0,-1)) {assert.ok(Object.hasOwn(target,part));target=target[part];}
  const key=change.path.at(-1);assert.ok(!['__proto__','constructor','prototype'].includes(key));
  if(change.op==='remove') {assert.ok(Object.hasOwn(target,key));delete target[key];}
  else {assert.equal(change.op,'replace');Object.defineProperty(target,key,{value:structuredClone(change.value),writable:true,configurable:true,enumerable:true});}
 }
 return input;
}
test('acquisition artifact matches emitter and fixture IDs are unique',()=>{
 assert.deepEqual(artifact,acquisitionContextJsonSchema());
 assert.equal(new Set(corpus.cases.map(c=>c.id)).size,corpus.cases.length);
});
for(const fixture of corpus.cases) test(`Acquisition context: ${fixture.id}`,()=>{
 const input=fixtureInput(fixture);const original=structuredClone(input);const result=parseAcquisitionContext(input);
 assert.equal(validate(input),fixture.structural,JSON.stringify(validate.errors));
 assert.equal(result.checks.structural,fixture.structural?'passed':'failed');
 assert.equal(result.checks.semantic,!fixture.structural?'not_checked':fixture.semantic?'passed':'failed',JSON.stringify(result.issues));
 assert.equal(result.success,fixture.structural && fixture.semantic===true);
 assert.equal(result.checks.profile,'not_checked');assert.equal(result.checks.external,'not_checked');
 assert.equal(result.contract.schemaId,artifact.$id);assert.equal(result.contract.rulesetVersion,'0.1.0');
 for(const code of fixture.codes) assert.ok(result.issues.some(issue=>issue.code===code),`Missing ${code}`);
 assert.deepEqual(input,original);
 if(result.success) {
  assert.deepEqual(result.data,original);assert.equal(result.acquisitions[0].status,fixture.status);
  assert.deepEqual(parseAcquisitionContext(JSON.parse(JSON.stringify(result.data))),result);
 } else {assert.ok(!Object.hasOwn(result,'data'));assert.ok(!Object.hasOwn(result,'acquisitions'));}
});
test('example pins original revision/calibration and declares no coverage probability',()=>{
 const example=JSON.parse(readFileSync(new URL('../examples/v2/acquisition-context.json',import.meta.url)));
 assert.deepEqual(example,corpus.base);const result=parseAcquisitionContext(example);assert.equal(result.success,true);
 assert.equal(result.acquisitions[0].manifestRef,'manifest:r1');assert.deepEqual(result.acquisitions[0].calibrationRefs,['calibration:c1']);
 assert.ok(!Object.hasOwn(result.data.calibrations[0].uncertainty,'coverageProbability'));
 assert.deepEqual(result.uncheckedArtifactPointers,['/manifests/0/artifact','/calibrations/0/report/artifact','/products/0/artifact']);
});
test('legacy references stay unresolved even when an inventory candidate exists',()=>{
 const input=structuredClone(corpus.base);input.acquisitions[0].manifest={state:'unresolved',legacyRef:'station:radar',reason:'Missing revision provenance'};
 const result=parseAcquisitionContext(input);assert.equal(result.success,true);
 assert.equal(result.acquisitions[0].status,'incomplete');assert.ok(!Object.hasOwn(result.acquisitions[0],'manifestRef'));
 assert.equal(result.data.acquisitions[0].manifest.legacyRef,'station:radar');
});
test('no network or byte verification is implied by artifact declarations',()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=()=>{throw new Error('Unexpected network access');};
  const input=structuredClone(corpus.base);input.manifests[0].artifact.uri='https://example.invalid/manifest.json';
  const result=parseAcquisitionContext(input);assert.equal(result.success,true);assert.equal(result.checks.external,'not_checked');
 } finally {globalThis.fetch=original;}
});
test('instruments and records agree on UTC lexical validity and exact instant order',()=>{
 const cases=[['2026-02-29T00:00:00Z',false],['2024-02-29T00:00:00Z',true],['2026-07-28T12:00Z',false],['0000-01-01T00:00:00Z',false],['2026-07-28T12:00:00.0000000000001Z',true],['2026-07-28T12:00:00+07:00',true]];
 for(const [value,valid] of cases) {
  const input=structuredClone(corpus.base);input.acquisitions[0].time={state:'known',kind:'instant',value,timeScale:'UTC'};
  assert.equal(validate(input),valid);assert.equal(parseAcquisitionContext(input).checks.structural==='passed',valid);
  assert.equal(compareUtcInstants(value,value)===0,valid);
 }
 assert.equal(compareUtcInstants('2026-07-28T12:00:00.0000000000001Z','2026-07-28T12:00:00Z'),1);
});
test('many explicitly pinned channels resolve without implicit calibration selection',()=>{
 const input=structuredClone(corpus.base);
 const channel=input.manifests[0].channels[0];const calibration=input.calibrations[0];
 input.manifests[0].channels=[];input.calibrations=[];input.acquisitions[0].channels=[];
 for(let i=0;i<1500;i++) {
  input.manifests[0].channels.push({...channel,id:`channel-${i}`});
  input.calibrations.push({...calibration,id:`cal-${i}`,channelId:`channel-${i}`});
  input.acquisitions[0].channels.push({channelId:`channel-${i}`,calibration:{state:'pinned',ref:`calibration:cal-${i}`}});
 }
 const result=parseAcquisitionContext(input);assert.equal(result.success,true);assert.equal(result.acquisitions[0].calibrationRefs.length,1500);
});
