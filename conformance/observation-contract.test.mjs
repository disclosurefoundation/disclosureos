import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseExperimentalObservation, experimentalObservationJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const corpus = JSON.parse(readFileSync(new URL('./v2-observation-fixtures.json', import.meta.url)));
const artifact = JSON.parse(readFileSync(new URL('../packages/disclosureos-records/schema/experimental/observation-0.1.0.schema.json', import.meta.url)));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(artifact);

function inputFor(fixture) {
  const input = structuredClone(corpus.bases[fixture.base]);
  assert.ok(input, 'Unknown fixture base');
  for (const change of fixture.changes) {
    assert.ok(change.path.length);
    let target = input;
    for (const segment of change.path.slice(0, -1)) {
      assert.ok(Object.hasOwn(target, segment), `Invalid fixture path: ${change.path.join('/')}`);
      target = target[segment];
    }
    const key = change.path.at(-1);
    assert.ok(!['__proto__', 'constructor', 'prototype'].includes(key));
    if (change.op === 'remove') {
      assert.ok(Object.hasOwn(target, key));
      delete target[key];
    } else if (change.op === 'append') {
      assert.ok(Array.isArray(target[key]));
      target[key].push(structuredClone(change.value));
    } else {
      assert.equal(change.op, 'replace');
      target[key] = structuredClone(change.value);
    }
  }
  return input;
}

test('Observation artifact matches the emitter and fixture IDs are unique', () => {
  assert.deepEqual(artifact, experimentalObservationJsonSchema());
  assert.equal(new Set(corpus.cases.map(c => c.id)).size, corpus.cases.length);
});

for (const fixture of corpus.cases) {
  test(`Observation: ${fixture.id}`, () => {
    const input = inputFor(fixture);
    const original = structuredClone(input);
    const result = parseExperimentalObservation(input);
    assert.equal(validate(input), fixture.structural, JSON.stringify(validate.errors));
    assert.equal(result.checks.structural, fixture.structural ? 'passed' : 'failed');
    assert.equal(result.checks.semantic, !fixture.structural ? 'not_checked' : fixture.semantic ? 'passed' : 'failed');
    assert.equal(result.checks.profile, 'not_checked');
    assert.equal(result.checks.external, 'not_checked');
    assert.equal(result.success, fixture.structural && fixture.semantic === true);
    for (const code of fixture.codes) assert.ok(result.issues.some(issue => issue.code === code), `Missing ${code}`);
    assert.deepEqual(input, original);
    if (result.success) {
      assert.deepEqual(result.data, original);
      assert.deepEqual(parseExperimentalObservation(JSON.parse(JSON.stringify(result.data))), result);
    }
  });
}

test('synthetic example is exactly the integrated fixture and adds no confidence assumptions', () => {
  const example = JSON.parse(readFileSync(new URL('../examples/v2/observation.json', import.meta.url)));
  assert.deepEqual(example, corpus.bases.integrated);
  const result = parseExperimentalObservation(example);
  assert.equal(result.success, true);
  assert.ok(!Object.hasOwn(result.data.measurements[0].value.uncertainty, 'coverageProbability'));
  assert.ok(result.uncheckedRefs.includes('product:summary'));
  assert.ok(result.uncheckedRefs.includes('method:reduction'));
});

test('long processing histories do not require recursive graph traversal', () => {
  const input = structuredClone(corpus.bases.minimal);
  input.sources = [{ id: 's', kind: 'instrument_data', access: 'unknown' }];
  input.methods = [{ id: 'm', version: '1' }];
  input.products = [{ id: 'p0', kind: 'raw', format: 'JSON', access: 'unknown', sourceRefs: ['source:s'] }];
  for (let i = 1; i <= 2000; i++) {
    input.products.push({ id: `p${i}`, kind: 'derived', format: 'JSON', access: 'unknown', generatedBy: `process:r${i}` });
    input.processing.push({ id: `r${i}`, methodRef: 'method:m', methodVersion: '1', performedBy: 'agent:synthetic', performedAt: input.createdAt,
      inputRefs: [`product:p${i - 1}`], outputRefs: [`product:p${i}`] });
  }
  assert.equal(parseExperimentalObservation(input).success, true);
  input.processing[0].inputRefs = ['product:p2000'];
  assert.ok(parseExperimentalObservation(input).issues.some(issue => issue.code === 'PROCESS.CYCLE'));
});

test('parsing metadata never retrieves external sources', () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('Unexpected network access'); };
    const input = structuredClone(corpus.bases.integrated);
    input.sources[0].uri = 'https://example.invalid/unavailable.json';
    const result = parseExperimentalObservation(input);
    assert.equal(result.success, true);
    assert.equal(result.checks.external, 'not_checked');
  } finally { globalThis.fetch = originalFetch; }
});
