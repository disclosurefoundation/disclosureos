import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {evaluateAcquisitionBindings, acquisitionBindingsJsonSchema, ACQUISITION_BINDINGS_PROFILE, evaluateAssessmentDocumentation} from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
const corpus=JSON.parse(readFileSync(new URL('./v2-acquisition-bindings-fixtures.json',import.meta.url)));
const artifact=JSON.parse(readFileSync(new URL('../packages/disclosureos-schema/schema/experimental/acquisition-bindings-0.1.0.schema.json',import.meta.url)));
const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);
const validators=[artifact,JSON.parse(readFileSync(new URL('../packages/disclosureos-records/schema/experimental/claim-history-0.1.0.schema.json',import.meta.url))),JSON.parse(readFileSync(new URL('../packages/disclosureos-instruments/schema/experimental/acquisition-context-0.1.0.schema.json',import.meta.url)))].map(schema=>ajv.compile(schema));
function fixtureInput(fixture) {
 const input=structuredClone(corpus.base);
 for(const change of fixture.changes) {
  let target=input;
  for(const part of change.path.slice(0,-1)) {assert.ok(Object.hasOwn(target,part));target=target[part];}
  const key=change.path.at(-1);assert.ok(!['__proto__','constructor','prototype'].includes(key));
  if(change.op==='remove') {assert.ok(Object.hasOwn(target,key));delete target[key];}
  else {assert.equal(change.op,'replace');Object.defineProperty(target,key,{value:structuredClone(change.value),writable:true,enumerable:true,configurable:true});}
 }
 return input;
}
function assetMap(fixture={omitAssets:[],assetOverrides:{}}) {
 return new Map(Object.entries({...corpus.assets,...fixture.assetOverrides}).filter(([ref])=>!fixture.omitAssets.includes(ref)).map(([ref,text])=>[ref,new TextEncoder().encode(text)]));
}
test('binding artifact and profile identity are stable',()=>{
 assert.deepEqual(artifact,acquisitionBindingsJsonSchema());assert.ok(Object.isFrozen(ACQUISITION_BINDINGS_PROFILE));
 assert.equal(new Set(corpus.cases.map(item=>item.id)).size,corpus.cases.length);
});
for(const fixture of corpus.cases) test(`Acquisition bindings: ${fixture.id}`,async()=>{
 const input=fixtureInput(fixture);const original=structuredClone(input);const assets=assetMap(fixture);
 const result=await evaluateAcquisitionBindings(input.history,input.context,input.bindings,{assets});
 const independent=[input.bindings,input.history,input.context].every((value,i)=>validators[i](value));
 assert.equal(independent,fixture.structural);
 assert.equal(result.checks.structural,fixture.structural?'passed':'failed');
 assert.equal(result.checks.semantic,!fixture.structural?'not_checked':fixture.semantic?'passed':'failed',JSON.stringify(result.issues));
 assert.equal(result.checks.profile,fixture.profile,JSON.stringify(result.issues));assert.equal(result.checks.external,fixture.external);
 assert.equal(result.success,fixture.profile==='passed');assert.equal(result.scientific,'not_checked');assert.equal(result.identityAuthenticity,'not_checked');assert.equal(result.artifactContents,'not_checked');
 for(const code of fixture.codes) assert.ok(result.issues.some(issue=>issue.code===code),`Missing ${code}`);
 assert.deepEqual(input,original);assert.deepEqual(assets,assetMap(fixture));
 for(const check of result.assets) if(check.status==='passed') {
  assert.equal(check.actualSha256,createHash('sha256').update(assets.get(check.ref)).digest('hex'));
  assert.equal(check.actualByteLength,assets.get(check.ref).byteLength);assert.equal(check.actualByteLength,check.expectedByteLength);
 }
});
test('complete synthetic packet reproduces local artifact checks',async()=>{
 const base=new URL('../examples/v2/acquisition-binding-demo/',import.meta.url);
 const [history,context,bindings]=['history','context','bindings'].map(name=>JSON.parse(readFileSync(new URL(`${name}.json`,base))));
 assert.deepEqual({history,context,bindings},corpus.base);
 const assets=new Map(Object.entries(corpus.assets).map(([ref,text])=>{
  const bytes=readFileSync(new URL(`assets/${ref.replace(':','-').replace('/','-')}.txt`,base));assert.equal(bytes.toString(),text);return [ref,new Uint8Array(bytes)];
 }));
 const result=await evaluateAcquisitionBindings(history,context,bindings,{assets});assert.equal(result.success,true);assert.equal(result.assets.length,3);
 assert.equal(result.bindings[0].observationProductRef,'product:raw');assert.equal(result.bindings[0].contextProductRef,'product:captured-raw');
});
test('the existing documentation profile remains independent',async()=>{
 const old=JSON.parse(readFileSync(new URL('./v2-assessment-documentation-fixtures.json',import.meta.url)));
 const assets=new Map(Object.entries(old.assets).map(([ref,text])=>[ref,new TextEncoder().encode(text)]));
 assert.equal((await evaluateAssessmentDocumentation(corpus.base.history,{assets})).success,true);
 const missing={...corpus.base.bindings,products:[]};
 assert.equal((await evaluateAcquisitionBindings(corpus.base.history,corpus.base.context,missing,{assets:assetMap()})).checks.profile,'failed');
});
test('missing local bytes never cause implicit network access',async()=>{
 const original=globalThis.fetch;
 try {globalThis.fetch=()=>{throw new Error('Unexpected retrieval');};const result=await evaluateAcquisitionBindings(corpus.base.history,corpus.base.context,corpus.base.bindings);assert.equal(result.checks.profile,'not_checked');}
 finally {globalThis.fetch=original;}
});
test('inputs and byte buffers are snapshotted before hashing',async()=>{
 const input=structuredClone(corpus.base);const assets=assetMap();
 const pending=evaluateAcquisitionBindings(input.history,input.context,input.bindings,{assets});
 input.context.calibrations=[];input.bindings.products=[];input.history.observation.products=[];
 for(const bytes of assets.values()) bytes.fill(0);
 assert.equal((await pending).success,true);
});
test('hashing unavailability is never success',async()=>{
 const original=globalThis.crypto.subtle.digest;
 try {globalThis.crypto.subtle.digest=async()=>{throw new Error('Unavailable');};const result=await evaluateAcquisitionBindings(corpus.base.history,corpus.base.context,corpus.base.bindings,{assets:assetMap()});assert.equal(result.checks.profile,'not_checked');assert.ok(result.issues.some(issue=>issue.code==='EXTERNAL.HASH_UNAVAILABLE'));}
 finally {globalThis.crypto.subtle.digest=original;}
});
test('shared manifest and calibration artifacts are verified once',async()=>{
 const input=structuredClone(corpus.base);const assets=assetMap();
 input.history.observation.products.push({...input.history.observation.products[0],id:'raw-2'});
 input.context.products.push({...input.context.products[0],id:'captured-2'});
 input.bindings.products.push({observationProductRef:'product:raw-2',contextProductRef:'product:captured-2'});
 assets.set('product:captured-2',assets.get('product:captured-raw'));
 const original=globalThis.crypto.subtle.digest;let count=0;
 try {globalThis.crypto.subtle.digest=function(...args){count++;return original.apply(this,args);};const result=await evaluateAcquisitionBindings(input.history,input.context,input.bindings,{assets});assert.equal(result.success,true);assert.equal(count,4);assert.equal(result.bindings.length,2);}
 finally {globalThis.crypto.subtle.digest=original;}
});
test('an instrument-free inventory cannot vacuously pass',async()=>{
 const input=structuredClone(corpus.base);
 input.history.observation.products=[];input.history.observation.processing=[];input.history.observation.measurements=[];input.history.observation.assertions=[];input.history.claims=[];
 input.bindings.products=[];input.bindings.sources=[];
 const result=await evaluateAcquisitionBindings(input.history,input.context,input.bindings);
 assert.equal(result.checks.semantic,'passed');assert.equal(result.checks.profile,'not_checked');assert.ok(result.issues.some(issue=>issue.code==='BINDING.NO_INSTRUMENT_PRODUCTS'));
});
