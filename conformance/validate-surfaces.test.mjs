import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSurfaces } from './validate-surfaces.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./observation-fixtures.json', import.meta.url)));
const fixture = id => fixtures.find(f => f.id === id);

test('namespaced extensions and input values survive independent validation unchanged', () => {
  const input = fixture('namespaced-extension-preserved');
  const before = structuredClone(input);
  const result = validateSurfaces(input);
  assert.equal(result.runtime, true);
  assert.equal(result.jsonSchema, true);
  assert.equal(result.cli.accepts, true);
  assert.deepEqual(input, before);
});

test('real CLI warnings are captured separately from exit status', () => {
  const result = validateSurfaces(fixture('dangling-reference'));
  assert.equal(result.cli.accepts, true);
  assert.equal(result.cli.warnings, 1);
  assert.equal(result.cliStrict.accepts, true);
  assert.ok(result.cliStrict.warnings > result.cli.warnings);
});

test('independent schema exposes nested-key disagreement and valid zero coordinates', () => {
  const bad = validateSurfaces(fixture('unknown-nested-property'));
  assert.equal(bad.runtime, true);
  assert.equal(bad.jsonSchema, false);
  const zero = validateSurfaces(fixture('minimal-v1-record'));
  assert.equal(zero.runtime, true);
  assert.equal(zero.jsonSchema, true);
});

test('unsupported document kinds fail as harness errors', () => {
  assert.throws(() => validateSurfaces({ kind: 'unknown', input: {} }), /Unsupported fixture kind/);
});
