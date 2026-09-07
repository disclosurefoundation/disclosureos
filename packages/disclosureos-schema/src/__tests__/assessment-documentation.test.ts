import { expect, test } from 'vitest';
import { evaluateAssessmentDocumentation } from '../experimental/v2';

const observation = {kind:'observation',schemaVersion:'0.1.0',id:'o',status:'draft',createdAt:'2026-09-07T00:00:00Z',updatedAt:'2026-09-07T00:00:00Z',
  eventTime:{state:'unknown',reason:'not_recorded'},position:{state:'unknown',reason:'not_recorded'},sources:[],products:[],frames:[],assertions:[],measurements:[],processing:[],
  methods:[{id:'review',version:'1',description:'Synthetic documentary review'}]};
const claim = {id:'a',kind:'assessment',status:'assessed',outcome:'confirmed',recordedAt:observation.createdAt,evaluatedAt:observation.createdAt,
  evaluatedBy:'person:reviewer',methodRef:'method:review',methodVersion:'1',topic:'synthetic motion',subject:{kind:'observation'},inputRefs:[],rationale:'Synthetic declaration.'};
const envelope = {kind:'claim_history',schemaVersion:'0.1.0',id:'h',observation,claims:[claim]};

test('unsupported confirmed assessments remain preserved but fail documentary support', async () => {
  const result = await evaluateAssessmentDocumentation(envelope);
  expect(result.checks.semantic).toBe('passed');
  expect(result.checks.profile).toBe('failed');
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'PROFILE.INPUTS_REQUIRED'})]));
  expect(result.scientific).toBe('not_checked');
});
test('invalid records prevent profile execution', async () => {
  const result = await evaluateAssessmentDocumentation({});
  expect(result.checks.structural).toBe('failed');
  expect(result.checks.profile).toBe('not_checked');
  expect(result.assessments).toEqual([]);
});
test('empty histories cannot vacuously pass the profile', async () => {
  const result = await evaluateAssessmentDocumentation({...envelope,claims:[]});
  expect(result.checks.profile).toBe('not_checked');
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'PROFILE.NO_ASSESSMENTS'})]));
});
