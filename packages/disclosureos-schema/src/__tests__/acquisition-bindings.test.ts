import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { evaluateAcquisitionBindings } from '../experimental/v2';
const history: unknown = JSON.parse(readFileSync(new URL('../../../../examples/v2/assessment-documentation.json', import.meta.url), 'utf8'));
const context: unknown = JSON.parse(readFileSync(new URL('../../../../examples/v2/acquisition-context.json', import.meta.url), 'utf8'));

test('matching product names do not create an implicit acquisition binding', async () => {
  const bindings = {kind:'acquisition_bindings',schemaVersion:'0.1.0',id:'b',historyId:'profile-example',observationId:'synthetic',contextId:'synthetic-context',sources:[],products:[]};
  const result = await evaluateAcquisitionBindings(history, context, bindings);
  expect(result.checks.semantic).toBe('passed');
  expect(result.checks.profile).toBe('failed');
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'BINDING.PRODUCT_REQUIRED'})]));
});
test('invalid inputs prevent dependent binding checks', async () => {
  const result = await evaluateAcquisitionBindings({}, {}, {});
  expect(result.checks.structural).toBe('failed');
  expect(result.checks.semantic).toBe('not_checked');
  expect(result.checks.profile).toBe('not_checked');
});
