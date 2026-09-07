import { parseExperimentalClaimHistory } from '@disclosureos/records/experimental/v2';
import type { ClaimHistoryIssueCode } from '@disclosureos/records/experimental/v2';
import { parseAcquisitionContext } from '@disclosureos/instruments/experimental/v2';
import type { AcquisitionContextIssueCode, ContextArtifact } from '@disclosureos/instruments/experimental/v2';
import { AcquisitionBindingsSchema, ACQUISITION_BINDINGS_SCHEMA_ID } from './acquisition-bindings-schema';

export const ACQUISITION_BINDINGS_PROFILE = Object.freeze({
  id: 'urn:disclosureos:experimental:profile:acquisition-bindings', version: '0.1.0', scope: 'product_identity_and_declared_context',
} as const);
type Status = 'passed' | 'failed' | 'not_checked';
export type BindingIssueCode = ClaimHistoryIssueCode | AcquisitionContextIssueCode | 'BINDING.DOCUMENT_ID'
  | 'BINDING.SOURCE_KIND' | 'BINDING.RAW_REQUIRED' | 'BINDING.DIGEST_MISMATCH' | 'BINDING.FORMAT_MISMATCH'
  | 'BINDING.SOURCE_IDENTITY' | 'BINDING.PRODUCT_REQUIRED' | 'BINDING.SOURCE_REQUIRED' | 'BINDING.DIGEST_REQUIRED'
  | 'BINDING.CONTEXT_INCOMPLETE' | 'BINDING.NO_INSTRUMENT_PRODUCTS' | 'EXTERNAL.ASSET_UNAVAILABLE'
  | 'EXTERNAL.DIGEST_MISMATCH' | 'EXTERNAL.SIZE_MISMATCH' | 'EXTERNAL.HASH_UNAVAILABLE' | 'EXTERNAL.EMPTY_ASSET';
export interface BindingIssue {
  code: BindingIssueCode; stage: 'structural' | 'semantic' | 'profile' | 'external'; severity: 'error' | 'warning'; pointer: string; message: string;
}
export interface BindingAssetCheck {
  ref: string; status: Status; pointer: string; expectedSha256: string; expectedByteLength: number;
  actualSha256?: string; actualByteLength?: number;
}
export interface ProductBindingCheck {
  observationProductRef: string; contextProductRef: string; acquisitionRef: string; instrumentRef: string;
  assetRefs: string[]; status: Status; issues: BindingIssue[];
}
export interface AcquisitionBindingOptions {
  /** Context-scoped keys: product:ID, manifest:ID, calibration:ID/report, calibration:ID/review. */
  assets?: ReadonlyMap<string, Uint8Array>;
}
export interface AcquisitionBindingResult {
  success: boolean; profile: typeof ACQUISITION_BINDINGS_PROFILE;
  contracts: { history: ReturnType<typeof parseExperimentalClaimHistory>['contract']; context: ReturnType<typeof parseAcquisitionContext>['contract']; bindings: {schemaId: typeof ACQUISITION_BINDINGS_SCHEMA_ID; rulesetVersion: '0.1.0'} };
  checks: { structural: Status; semantic: Status; profile: Status; external: Status };
  scientific: 'not_checked'; identityAuthenticity: 'not_checked'; artifactContents: 'not_checked';
  bindings: ProductBindingCheck[]; assets: BindingAssetCheck[]; issues: BindingIssue[];
}
const pointer = (path: readonly PropertyKey[]) => path.map(p => `/${String(p).replace(/~/g,'~0').replace(/\//g,'~1')}`).join('');

/** Explicit cross-document links and local byte identity. Does not authenticate an instrument or calibrate a measurement. */
export async function evaluateAcquisitionBindings(historyInput: unknown, contextInput: unknown, bindingsInput: unknown, options: AcquisitionBindingOptions = {}): Promise<AcquisitionBindingResult> {
  const history = parseExperimentalClaimHistory(historyInput);
  const context = parseAcquisitionContext(contextInput);
  const bindingParse = AcquisitionBindingsSchema.safeParse(bindingsInput);
  const result: AcquisitionBindingResult = {
    success: false, profile: ACQUISITION_BINDINGS_PROFILE,
    contracts: {history: history.contract, context: context.contract, bindings: {schemaId: ACQUISITION_BINDINGS_SCHEMA_ID, rulesetVersion:'0.1.0'}},
    checks: {structural:'passed',semantic:'not_checked',profile:'not_checked',external:'not_checked'},
    scientific:'not_checked', identityAuthenticity:'not_checked', artifactContents:'not_checked', bindings:[], assets:[],
    issues:[...history.issues.map(issue=>({...issue,pointer:`/history${issue.pointer}`})),...context.issues.map(issue=>({...issue,pointer:`/context${issue.pointer}`}))],
  };
  if (!bindingParse.success) result.issues.push(...bindingParse.error.issues.map(issue=>({code:'STRUCT.VALUE' as const,stage:'structural' as const,severity:'error' as const,pointer:`/bindings${pointer(issue.path)}`,message:issue.message})));
  if (history.checks.structural==='failed' || context.checks.structural==='failed' || !bindingParse.success) {
    result.checks.structural='failed';
    result.issues=result.issues.filter(issue=>issue.stage==='structural');
    return result;
  }
  if (!history.success || !context.success) {result.checks.semantic='failed';return result;}
  const bindingData=bindingParse.data;
  const observation=history.data.observation;
  const issue=(code:BindingIssueCode, path:string, message:string, stage:'semantic'|'profile'|'external'='semantic', severity:'error'|'warning'='error')=>result.issues.push({code,stage,severity,pointer:path,message});
  for (const [field,expected] of [['historyId',history.data.id],['observationId',observation.id],['contextId',context.data.id]] as const) {
    if(bindingData[field]!==expected) issue('BINDING.DOCUMENT_ID',`/bindings/${field}`,'Binding document identifies a different input document.');
  }
  const sources=new Map(observation.sources.map(v=>[`source:${v.id}`,v]));
  const products=new Map(observation.products.map((v,i)=>[`product:${v.id}`,{value:v,pointer:`/history/observation/products/${i}`}]));
  const instruments=new Map(context.data.instruments.map(v=>[`instrument:${v.id}`,v]));
  const contextProducts=new Map(context.data.products.map((v,i)=>[`product:${v.id}`,{value:v,pointer:`/context/products/${i}`} ]));
  const acquisitions=new Map(context.data.acquisitions.map(v=>[`acquisition:${v.id}`,v]));
  const resolutions=new Map(context.acquisitions.map(v=>[v.acquisitionRef,v]));
  const manifests=new Map(context.data.manifests.map((v,i)=>[`manifest:${v.id}`,{value:v,pointer:`/context/manifests/${i}`} ]));
  const calibrations=new Map(context.data.calibrations.map((v,i)=>[`calibration:${v.id}`,{value:v,pointer:`/context/calibrations/${i}`} ]));
  const sourceBindings=new Map<string,string>();
  for(const [i,binding] of bindingData.sources.entries()) {
    const path=`/bindings/sources/${i}`;
    if(sourceBindings.has(binding.sourceRef)) issue('REF.UNIQUE_ID',`${path}/sourceRef`,'Observation source has more than one instrument binding.');
    sourceBindings.set(binding.sourceRef,binding.instrumentRef);
    const source=sources.get(binding.sourceRef);
    if(!source) issue('REF.LOCAL_RESOLUTION',`${path}/sourceRef`,'Observation source is not declared.');
    else if(source.kind!=='instrument_data') issue('BINDING.SOURCE_KIND',`${path}/sourceRef`,'Only an instrument-data source can be bound as a producing instrument.');
    if(!instruments.has(binding.instrumentRef)) issue('REF.LOCAL_RESOLUTION',`${path}/instrumentRef`,'Context instrument is not declared.');
  }
  const observationBindings=new Set<string>();
  const contextBindings=new Set<string>();
  for(const [i,binding] of bindingData.products.entries()) {
    const path=`/bindings/products/${i}`;
    if(observationBindings.has(binding.observationProductRef)) issue('REF.UNIQUE_ID',`${path}/observationProductRef`,'Observation product is bound more than once.');
    if(contextBindings.has(binding.contextProductRef)) issue('REF.UNIQUE_ID',`${path}/contextProductRef`,'Context product is bound more than once; this profile requires one-to-one product mappings.');
    observationBindings.add(binding.observationProductRef);contextBindings.add(binding.contextProductRef);
    const product=products.get(binding.observationProductRef)?.value;
    const target=contextProducts.get(binding.contextProductRef)?.value;
    if(!product) issue('REF.LOCAL_RESOLUTION',`${path}/observationProductRef`,'Observation product is not declared.');
    if(!target) issue('REF.LOCAL_RESOLUTION',`${path}/contextProductRef`,'Context product is not declared.');
    if(!product || !target) continue;
    if(product.kind!=='raw') {issue('BINDING.RAW_REQUIRED',`${path}/observationProductRef`,'Derived products cannot be relabeled as raw acquisition products.');continue;}
    if(product.digest && product.digest.value!==target.artifact.digest.value) issue('BINDING.DIGEST_MISMATCH',path,'The linked product declarations pin different SHA-256 digests.');
    if(product.format!==target.artifact.mediaType) issue('BINDING.FORMAT_MISMATCH',path,'Declared product format and context media type must match exactly; no format conversion is inferred.');
    const producingSources=product.sourceRefs.filter(ref=>sources.get(ref)?.kind==='instrument_data');
    if(!producingSources.length) issue('BINDING.SOURCE_KIND',`${path}/observationProductRef`,'Raw product does not declare an instrument-data source.');
    const acquisition=acquisitions.get(target.acquisitionRef)!;
    for(const ref of producingSources) {
      const instrument=sourceBindings.get(ref);
      if(instrument && instrument!==acquisition.instrumentRef) issue('BINDING.SOURCE_IDENTITY',path,'A producing source is mapped to a different instrument than the product acquisition.');
    }
  }
  if(result.issues.some(item=>item.stage==='semantic' && item.severity==='error')) {result.checks.semantic='failed';return result;}
  result.checks.semantic='passed';
  const required=[...products].filter(([,entry])=>entry.value.kind==='raw' && entry.value.sourceRefs.some(ref=>sources.get(ref)?.kind==='instrument_data'));
  for(const [ref,entry] of required) if(!observationBindings.has(ref)) issue('BINDING.PRODUCT_REQUIRED',entry.pointer,'Instrument raw product needs an explicit acquisition-product binding.','profile');
  if(!required.length) issue('BINDING.NO_INSTRUMENT_PRODUCTS','/history/observation/products','No instrument raw products are present to evaluate.','profile','warning');
  const artifacts=new Map<string,{artifact:ContextArtifact;pointer:string}>();
  const register=(ref:string,artifact:ContextArtifact,path:string,report:ProductBindingCheck)=>{
    artifacts.set(ref,{artifact,pointer:path});
    if(!report.assetRefs.includes(ref)) report.assetRefs.push(ref);
  };
  for(const [i,binding] of bindingData.products.entries()) {
    const product=products.get(binding.observationProductRef)!;
    const target=contextProducts.get(binding.contextProductRef)!;
    const acquisition=acquisitions.get(target.value.acquisitionRef)!;
    const resolution=resolutions.get(target.value.acquisitionRef)!;
    const report:ProductBindingCheck={...binding,acquisitionRef:target.value.acquisitionRef,instrumentRef:acquisition.instrumentRef,assetRefs:[],status:'not_checked',issues:[]};
    const fail=(code:BindingIssueCode,path:string,message:string)=>report.issues.push({code,stage:'profile',severity:'error',pointer:path,message});
    if(!product.value.digest) fail('BINDING.DIGEST_REQUIRED',`${product.pointer}/digest`,'Observation product must pin the same bytes as its context product.');
    if(product.value.kind==='raw') for(const ref of product.value.sourceRefs) if(sources.get(ref)?.kind==='instrument_data' && !sourceBindings.has(ref)) {
      fail('BINDING.SOURCE_REQUIRED',`/bindings/products/${i}`,'Each declared producing instrument source needs an explicit instrument binding.');
    }
    if(resolution.status==='incomplete') fail('BINDING.CONTEXT_INCOMPLETE',`/bindings/products/${i}/contextProductRef`,'Selected acquisition has unknown or unresolved context; see the context diagnostics.');
    register(binding.contextProductRef,target.value.artifact,`${target.pointer}/artifact`,report);
    if(acquisition.manifest.state==='pinned') {
      const manifest=manifests.get(acquisition.manifest.ref)!;
      register(acquisition.manifest.ref,manifest.value.artifact,`${manifest.pointer}/artifact`,report);
    }
    for(const ref of resolution.calibrationRefs) {
      const calibration=calibrations.get(ref)!;
      if(calibration.value.report.state==='known') register(`${ref}/report`,calibration.value.report.artifact,`${calibration.pointer}/report/artifact`,report);
      if(calibration.value.review.state==='reviewed') register(`${ref}/review`,calibration.value.review.report,`${calibration.pointer}/review/report`,report);
    }
    result.bindings.push(report);
  }
  // Snapshot before the first await. Both documents and the binding schema have already cloned their inputs.
  const assets=new Map([...options.assets??[]].map(([ref,bytes])=>[ref,Uint8Array.from(bytes)]));
  for(const [ref,entry] of artifacts) {
    const check:BindingAssetCheck={ref,status:'not_checked',pointer:entry.pointer,expectedSha256:entry.artifact.digest.value,expectedByteLength:entry.artifact.byteLength};
    result.assets.push(check);
    const bytes=assets.get(ref);
    if(!bytes) {issue('EXTERNAL.ASSET_UNAVAILABLE',entry.pointer,`No complete local bytes supplied for ${ref}.`,'external','warning');continue;}
    check.actualByteLength=bytes.byteLength;
    if(!bytes.byteLength || bytes.byteLength!==entry.artifact.byteLength) {
      check.status='failed';issue(!bytes.byteLength?'EXTERNAL.EMPTY_ASSET':'EXTERNAL.SIZE_MISMATCH',entry.pointer,'Supplied nonempty bytes must match the declared byte length.','external');continue;
    }
    try {
      const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
      check.actualSha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
      check.status=check.actualSha256===entry.artifact.digest.value?'passed':'failed';
      if(check.status==='failed') issue('EXTERNAL.DIGEST_MISMATCH',entry.pointer,'Supplied bytes do not match the pinned SHA-256 digest.','external');
    } catch {issue('EXTERNAL.HASH_UNAVAILABLE',entry.pointer,'SHA-256 is unavailable; byte identity is not checked.','external','warning');}
  }
  const assetChecks=new Map(result.assets.map(check=>[check.ref,check]));
  for(const report of result.bindings) {
    const statuses=report.assetRefs.map(ref=>assetChecks.get(ref)!.status);
    report.status=report.issues.length || statuses.includes('failed')?'failed':statuses.includes('not_checked')?'not_checked':'passed';
    result.issues.push(...report.issues);
  }
  result.checks.profile=result.issues.some(item=>item.severity==='error')?'failed'
    : !required.length || result.bindings.some(report=>report.status==='not_checked')?'not_checked':'passed';
  result.checks.external=result.assets.some(check=>check.status==='failed')?'failed':'not_checked';
  result.success=result.checks.profile==='passed';
  return result;
}
