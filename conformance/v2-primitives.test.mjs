import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parsePrimitiveRecord, primitivesJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const artifact = JSON.parse(readFileSync(new URL('../packages/disclosureos-records/schema/experimental/v2-primitives.schema.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('./v2-primitives-fixtures.json', import.meta.url)));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(artifact);

test('experimental JSON Schema matches the built emitter', () => {
  assert.deepEqual(artifact, primitivesJsonSchema());
});

for (const fixture of fixtures) {
  test(`v2 primitives: ${fixture.id}`, () => {
    const before = structuredClone(fixture.input);
    const result = parsePrimitiveRecord(fixture.input);
    assert.equal(validate(fixture.input), fixture.structural, JSON.stringify(validate.errors));
    assert.equal(!result.issues.some(i => i.stage === 'structural'), fixture.structural);
    assert.equal(result.success, fixture.structural && fixture.semantic === true);
    assert.deepEqual(fixture.input, before);
    if (!fixture.structural) assert.ok(result.issues.every(i => i.stage === 'structural'));
    for (const code of fixture.codes) assert.ok(result.issues.some(i => i.code === code), `Missing ${code}`);
    if (result.success) {
      assert.deepEqual(result.data, before);
      assert.deepEqual(parsePrimitiveRecord(JSON.parse(JSON.stringify(result.data))), result);
    }
  });
}
