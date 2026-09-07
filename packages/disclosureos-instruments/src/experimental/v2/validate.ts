import { compareUtcInstants } from '@disclosureos/records/experimental/v2';
import { AcquisitionContextSchema, ACQUISITION_CONTEXT_SCHEMA_ID, ACQUISITION_CONTEXT_RULESET_VERSION } from './schema';
import type { AcquisitionContext, AcquisitionContextEntry, ManifestRevision } from './schema';

export type AcquisitionContextIssueCode = 'STRUCT.VALUE' | 'REF.UNIQUE_ID' | 'REF.LOCAL_RESOLUTION' | 'REF.INSTRUMENT_MISMATCH'
  | 'MANIFEST.AMBIGUOUS_VERSION' | 'MANIFEST.MISMATCH' | 'CHANNEL.UNKNOWN' | 'TIME.INTERVAL' | 'TIME.INSTANT'
  | 'TIME.OUTSIDE_DEPLOYMENT' | 'CALIBRATION.CHANNEL_MISMATCH' | 'CALIBRATION.AFTER_ACQUISITION' | 'CALIBRATION.OUTSIDE_VALIDITY'
  | 'CALIBRATION.REVIEW_ORDER' | 'UNIT.MISMATCH' | 'CONTEXT.UNRESOLVED' | 'CONTEXT.UNKNOWN';
export interface AcquisitionContextIssue {code:AcquisitionContextIssueCode;stage:'structural'|'semantic';severity:'error'|'warning';pointer:string;message:string}
export interface AcquisitionResolution {acquisitionRef:string;status:'resolved'|'incomplete';manifestRef?:string;calibrationRefs:string[];missingPointers:string[]}
interface ResultBase {
  checks:{structural:'passed'|'failed';semantic:'passed'|'failed'|'not_checked';profile:'not_checked';external:'not_checked'};
  contract:{schemaId:typeof ACQUISITION_CONTEXT_SCHEMA_ID;rulesetVersion:typeof ACQUISITION_CONTEXT_RULESET_VERSION};
  issues:AcquisitionContextIssue[];uncheckedArtifactPointers:string[];
}
export type AcquisitionContextResult = ResultBase & ({success:true;data:AcquisitionContext;acquisitions:AcquisitionResolution[]}|{success:false});
const pointer = (path:readonly PropertyKey[]) => path.map(p=>`/${String(p).replace(/~/g,'~0').replace(/\//g,'~1')}`).join('');
type Period = {state:'known';start:string;end:string;timeScale:'UTC'} | {state:'unknown';reason:string};

/** Validates pinned declarations, not scientific calibration adequacy or artifact bytes. */
export function parseAcquisitionContext(input:unknown):AcquisitionContextResult {
  const contract:ResultBase['contract']={schemaId:ACQUISITION_CONTEXT_SCHEMA_ID,rulesetVersion:ACQUISITION_CONTEXT_RULESET_VERSION};
  const parsed=AcquisitionContextSchema.safeParse(input);
  if(!parsed.success) return {success:false,contract,checks:{structural:'failed',semantic:'not_checked',profile:'not_checked',external:'not_checked'},uncheckedArtifactPointers:[],
    issues:parsed.error.issues.map(issue=>({code:'STRUCT.VALUE',stage:'structural',severity:'error',pointer:pointer(issue.path),message:issue.message}))};
  const data=parsed.data;
  const issues:AcquisitionContextIssue[]=[];
  const uncheckedArtifactPointers:string[]=[];
  const error=(code:AcquisitionContextIssueCode,path:string,message:string)=>issues.push({code,stage:'semantic',severity:'error',pointer:path,message});
  function index<T extends {id:string}>(items:T[],kind:string,collection:string) {
    const map=new Map<string,{value:T;pointer:string}>();
    items.forEach((value,i)=>{
      const ref=`${kind}:${value.id}`;
      if(map.has(ref)) error('REF.UNIQUE_ID',`/${collection}/${i}/id`,'Duplicate ID; pinned revisions must be unambiguous.');
      else map.set(ref,{value,pointer:`/${collection}/${i}`});
    });
    return map;
  }
  const instruments=index(data.instruments,'instrument','instruments');
  const manifests=index(data.manifests,'manifest','manifests');
  const deployments=index(data.deployments,'deployment','deployments');
  const calibrations=index(data.calibrations,'calibration','calibrations');
  const acquisitions=index(data.acquisitions,'acquisition','acquisitions');
  index(data.products,'product','products');
  function resolve<T>(map:Map<string,T>,ref:string,path:string):T|undefined {
    const value=map.get(ref);
    if(!value) error('REF.LOCAL_RESOLUTION',path,`Undeclared pinned reference: ${ref}`);
    return value;
  }
  function sameInstrument(expected:string,actual:string,path:string):void {
    if(expected!==actual) error('REF.INSTRUMENT_MISMATCH',path,'Pinned context belongs to a different instrument instance.');
  }
  function instant(value:string,path:string):void {
    if(compareUtcInstants(value,value)===undefined) error('TIME.INSTANT',path,'Instant cannot be resolved with its UTC offset.');
  }
  function period(value:Period,path:string):void {
    if(value.state==='unknown') return;
    instant(value.start,`${path}/start`);instant(value.end,`${path}/end`);
    const order=compareUtcInstants(value.start,value.end);
    if(order!==undefined && order>=0) error('TIME.INTERVAL',`${path}/end`,'Half-open intervals require end strictly after start; represent a point acquisition as an instant.');
  }
  const channelMaps=new Map<string,Map<string,{value:ManifestRevision['channels'][number];pointer:string}>>();
  const versions=new Set<string>();
  for(const [i,manifest] of data.manifests.entries()) {
    const path=`/manifests/${i}`;
    resolve(instruments,manifest.instrumentRef,`${path}/instrumentRef`);
    instant(manifest.publishedAt,`${path}/publishedAt`);
    const version=JSON.stringify([manifest.instrumentRef,manifest.version]);
    if(versions.has(version)) error('MANIFEST.AMBIGUOUS_VERSION',`${path}/version`,'Instrument/version pair is declared more than once.');
    versions.add(version);
    const channels=new Map<string,{value:ManifestRevision['channels'][number];pointer:string}>();
    for(const [j,channel] of manifest.channels.entries()) {
      if(channels.has(channel.id)) error('REF.UNIQUE_ID',`${path}/channels/${j}/id`,'Duplicate channel ID within manifest revision.');
      channels.set(channel.id,{value:channel,pointer:`${path}/channels/${j}`});
    }
    channelMaps.set(`manifest:${manifest.id}`,channels);
    uncheckedArtifactPointers.push(`${path}/artifact`);
  }
  for(const [i,deployment] of data.deployments.entries()) {
    const path=`/deployments/${i}`;
    resolve(instruments,deployment.instrumentRef,`${path}/instrumentRef`);period(deployment.period,`${path}/period`);
    if(deployment.manifest.state==='pinned') {
      const manifest=resolve(manifests,deployment.manifest.ref,`${path}/manifest/ref`);
      if(manifest) sameInstrument(deployment.instrumentRef,manifest.value.instrumentRef,`${path}/manifest/ref`);
    }
  }
  for(const [i,calibration] of data.calibrations.entries()) {
    const path=`/calibrations/${i}`;
    resolve(instruments,calibration.instrumentRef,`${path}/instrumentRef`);
    const manifest=resolve(manifests,calibration.manifestRef,`${path}/manifestRef`);
    if(manifest) {
      sameInstrument(calibration.instrumentRef,manifest.value.instrumentRef,`${path}/manifestRef`);
      const channel=channelMaps.get(calibration.manifestRef)?.get(calibration.channelId);
      if(!channel) error('CHANNEL.UNKNOWN',`${path}/channelId`,'Calibration channel is not in its pinned manifest.');
      else if(calibration.uncertainty.kind!=='unknown' && calibration.uncertainty.unit!==channel.value.unit) error('UNIT.MISMATCH',`${path}/uncertainty/unit`,'Declared calibration uncertainty unit differs from its channel.');
    }
    if(calibration.performedAt.state==='known') instant(calibration.performedAt.value,`${path}/performedAt/value`);
    period(calibration.validity,`${path}/validity`);
    if(calibration.report.state==='known') uncheckedArtifactPointers.push(`${path}/report/artifact`);
    if(calibration.review.state==='reviewed') {
      instant(calibration.review.reviewedAt,`${path}/review/reviewedAt`);uncheckedArtifactPointers.push(`${path}/review/report`);
      if(calibration.performedAt.state==='known' && compareUtcInstants(calibration.review.reviewedAt,calibration.performedAt.value)===-1) error('CALIBRATION.REVIEW_ORDER',`${path}/review/reviewedAt`,'Review cannot precede the declared calibration event.');
    }
  }
  const resolutions:AcquisitionResolution[]=[];
  function outside(time:AcquisitionContextEntry['time'],window:Period):boolean {
    if(time.state!=='known'||window.state!=='known') return false;
    const start=time.kind==='instant'?time.value:time.start;
    const end=time.kind==='instant'?time.value:time.end;
    return compareUtcInstants(start,window.start)===-1 || (time.kind==='instant' ? compareUtcInstants(end,window.end)!==-1 : compareUtcInstants(end,window.end)===1);
  }
  for(const [i,acquisition] of data.acquisitions.entries()) {
    const path=`/acquisitions/${i}`;
    const resolution:AcquisitionResolution={acquisitionRef:`acquisition:${acquisition.id}`,status:'resolved',calibrationRefs:[],missingPointers:[]};
    const missing=(code:'CONTEXT.UNKNOWN'|'CONTEXT.UNRESOLVED',pointer:string,message:string)=>{
      resolution.status='incomplete';resolution.missingPointers.push(pointer);issues.push({code,stage:'semantic',severity:'warning',pointer,message});
    };
    const instrument=resolve(instruments,acquisition.instrumentRef,`${path}/instrumentRef`);
    if(instrument?.value.identity.state==='unknown') missing('CONTEXT.UNKNOWN',`${instrument.pointer}/identity`,'Physical instrument identity is unknown beyond its local ID.');
    if(acquisition.time.state==='unknown') missing('CONTEXT.UNKNOWN',`${path}/time`,'Acquisition time is unknown.');
    else if(acquisition.time.kind==='instant') instant(acquisition.time.value,`${path}/time/value`);
    else period(acquisition.time,`${path}/time`);
    for(const [key,value] of Object.entries(acquisition.clock)) if(value.state==='unknown') missing('CONTEXT.UNKNOWN',`${path}/clock/${key}`,'Clock context is unknown.');
    const manifest=acquisition.manifest.state==='pinned'?resolve(manifests,acquisition.manifest.ref,`${path}/manifest/ref`):undefined;
    if(acquisition.manifest.state==='unresolved') missing('CONTEXT.UNRESOLVED',`${path}/manifest`, 'No manifest revision is selected; legacy labels are never resolved automatically.');
    if(manifest && acquisition.manifest.state==='pinned') {
      resolution.manifestRef=acquisition.manifest.ref;sameInstrument(acquisition.instrumentRef,manifest.value.instrumentRef,`${path}/manifest/ref`);
      for(const [key,value] of Object.entries(manifest.value.configuration)) if(value.state==='unknown') missing('CONTEXT.UNKNOWN',`${manifest.pointer}/configuration/${key}`,'Configuration detail is unknown.');
    }
    if(acquisition.deployment.state==='unresolved') missing('CONTEXT.UNRESOLVED',`${path}/deployment`,'Deployment history is unresolved.');
    else {
      const deployment=resolve(deployments,acquisition.deployment.ref,`${path}/deployment/ref`);
      if(deployment) {
        sameInstrument(acquisition.instrumentRef,deployment.value.instrumentRef,`${path}/deployment/ref`);
        if(deployment.value.manifest.state==='unresolved') missing('CONTEXT.UNRESOLVED',`${deployment.pointer}/manifest`,'Deployment configuration is unresolved.');
        else if(acquisition.manifest.state==='pinned' && deployment.value.manifest.ref!==acquisition.manifest.ref) error('MANIFEST.MISMATCH',`${path}/manifest/ref`,'Acquisition and deployment pin different manifest revisions.');
        if(deployment.value.site.state==='unknown') missing('CONTEXT.UNKNOWN',`${deployment.pointer}/site`,'Deployment site is unknown.');
        if(deployment.value.period.state==='unknown') missing('CONTEXT.UNKNOWN',`${deployment.pointer}/period`,'Deployment time coverage is unknown.');
        else if(outside(acquisition.time,deployment.value.period)) error('TIME.OUTSIDE_DEPLOYMENT',`${path}/time`,'Acquisition is not wholly contained in its deployment window.');
      }
    }
    const channels=new Set<string>();
    for(const [j,binding] of acquisition.channels.entries()) {
      const bindingPath=`${path}/channels/${j}`;
      if(channels.has(binding.channelId)) error('REF.UNIQUE_ID',`${bindingPath}/channelId`,'Channel is bound more than once; select an explicit calibration per channel.');
      channels.add(binding.channelId);
      const selectedChannel=manifest?channelMaps.get(`manifest:${manifest.value.id}`)?.get(binding.channelId):undefined;
      if(manifest && !selectedChannel) error('CHANNEL.UNKNOWN',`${bindingPath}/channelId`,'Acquisition channel is not in its pinned manifest.');
      if(selectedChannel?.value.sampling.state==='unknown') missing('CONTEXT.UNKNOWN',`${selectedChannel.pointer}/sampling`,'Declared channel sampling is unknown.');
      if(binding.calibration.state==='unresolved') {missing('CONTEXT.UNRESOLVED',`${bindingPath}/calibration`,'Calibration history is unresolved.');continue;}
      const calibration=resolve(calibrations,binding.calibration.ref,`${bindingPath}/calibration/ref`);
      if(!calibration) continue;
      resolution.calibrationRefs.push(binding.calibration.ref);
      sameInstrument(acquisition.instrumentRef,calibration.value.instrumentRef,`${bindingPath}/calibration/ref`);
      if(acquisition.manifest.state==='pinned' && calibration.value.manifestRef!==acquisition.manifest.ref) error('MANIFEST.MISMATCH',`${bindingPath}/calibration/ref`,'Calibration does not apply to the exact acquisition manifest revision.');
      if(calibration.value.channelId!==binding.channelId) error('CALIBRATION.CHANNEL_MISMATCH',`${bindingPath}/calibration/ref`,'Calibration covers a different channel.');
      if(calibration.value.performedAt.state==='unknown') missing('CONTEXT.UNKNOWN',`${calibration.pointer}/performedAt`,'Calibration performance time is unknown.');
      else if(acquisition.time.state==='known') {
        const start=acquisition.time.kind==='instant'?acquisition.time.value:acquisition.time.start;
        if(compareUtcInstants(calibration.value.performedAt.value,start)===1) error('CALIBRATION.AFTER_ACQUISITION',`${bindingPath}/calibration/ref`,'A calibration performed after acquisition cannot establish acquisition-time calibration.');
      }
      if(calibration.value.validity.state==='unknown') missing('CONTEXT.UNKNOWN',`${calibration.pointer}/validity`,'Declared calibration coverage is unknown.');
      else if(outside(acquisition.time,calibration.value.validity)) error('CALIBRATION.OUTSIDE_VALIDITY',`${bindingPath}/calibration/ref`,'Acquisition is not wholly contained in declared calibration validity.');
      for(const field of ['method','report','review'] as const) if(calibration.value[field].state==='unknown') missing('CONTEXT.UNKNOWN',`${calibration.pointer}/${field}`,'Calibration documentation is unknown.');
      if(calibration.value.uncertainty.kind==='unknown') missing('CONTEXT.UNKNOWN',`${calibration.pointer}/uncertainty`,'Calibration uncertainty is unknown.');
    }
    resolutions.push(resolution);
  }
  for(const [i,product] of data.products.entries()) {resolve(acquisitions,product.acquisitionRef,`/products/${i}/acquisitionRef`);uncheckedArtifactPointers.push(`/products/${i}/artifact`);}
  const failed=issues.some(issue=>issue.severity==='error');
  const base:ResultBase={contract,issues,uncheckedArtifactPointers,checks:{structural:'passed',semantic:failed?'failed':'passed',profile:'not_checked',external:'not_checked'}};
  return failed?{...base,success:false}:{...base,success:true,data,acquisitions:resolutions};
}
