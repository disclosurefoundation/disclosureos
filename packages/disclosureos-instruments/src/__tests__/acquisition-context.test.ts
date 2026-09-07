import { expect, test } from 'vitest';
import { parseAcquisitionContext } from '../experimental/v2';
const unknown = {state:'unknown',reason:'Not supplied'};
const input = {kind:'acquisition_context',schemaVersion:'0.1.0',id:'context',
 instruments:[{id:'instrument',identity:unknown}],manifests:[],deployments:[],calibrations:[],
 acquisitions:[{id:'a',instrumentRef:'instrument:instrument',manifest:{state:'unresolved',legacyRef:'org:sensor',reason:'Revision unknown'},deployment:{state:'unresolved',reason:'History unknown'},time:unknown,
 classification:'background',clock:{source:unknown,synchronization:unknown,resolution:unknown,uncertainty:unknown},channels:[{channelId:'radar',calibration:{state:'unresolved',reason:'History unknown'}}]}],products:[]};
test('unresolved historical acquisition is preserved without selecting a manifest', () => {
 const result=parseAcquisitionContext(input);
 expect(result.success).toBe(true);
 if(result.success) {expect(result.data).toEqual(input);expect(result.acquisitions[0]?.status).toBe('incomplete');}
 expect(result.checks.profile).toBe('not_checked');
});
test('duplicate acquisition IDs are rejected', () => {
 const result=parseAcquisitionContext({...input,acquisitions:[input.acquisitions[0],input.acquisitions[0]]});
 expect(result.success).toBe(false);
 expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'REF.UNIQUE_ID'})]));
});
test('missing instrument identities cannot resolve from a legacy string', () => {
 const result=parseAcquisitionContext({...input,instruments:[]});
 expect(result.success).toBe(false);
 expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'REF.LOCAL_RESOLUTION'})]));
});
