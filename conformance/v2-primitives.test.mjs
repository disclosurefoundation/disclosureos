import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parsePrimitiveRecord, primitivesJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const artifact = JSON.parse(readFileSync(new URL('../packages/disclosureos-records/schema/experimental/v2-primitives-0.2.0.schema.json', import.meta.url)));
const fixtures = [
  ...JSON.parse(readFileSync(new URL('./v2-primitives-fixtures.json', import.meta.url))),
  ...JSON.parse(readFileSync(new URL('./v2-selection-fixtures.json', import.meta.url))),
];
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


test('JSON Pointer escapes and hostile-length inputs agree across runtime and schema', () => {
  const cases = [
    ['', true], ['/', true], ['/a~0b/~1/', true], ['/line\nbreak', true],
    ['\n', false], ['/~', false], ['/~2', false],
    ['/'.repeat(100_000), true], [`${'/'.repeat(100_000)}~`, false],
  ];
  for (const [pointer, expected] of cases) {
    const input = structuredClone(fixtures[0].input);
    input.assertions = [{ id: 'pointer-test', field: 'position', value: input.position.value,
      provenance: { sourceRef: 'source:original', locator: { kind: 'json_pointer', pointer } } }];
    assert.equal(validate(input), expected);
    assert.equal(parsePrimitiveRecord(input).success, expected);
  }
});


test('historical experimental 0.1 artifact remains byte-identical', () => {
  const bytes = readFileSync(new URL('../packages/disclosureos-records/schema/experimental/v2-primitives.schema.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ac8495258b7d8f9e394b40d5819a1b59b8a4d5544402d674de86e81bf19f2ee3');
});
