// Copied into a fresh npm consumer by release-candidate.mjs; no workspace imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = realpathSync(fileURLToPath(new URL('.', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('candidate.json', import.meta.url)));
const definitions = [];
const imports = [];
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null, 'Non-JSON definition');
  return value;
};
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
for (const pkg of manifest.packages) {
  const packageRoot = join(root, 'node_modules', pkg.name);
  assert.ok(realpathSync(packageRoot).startsWith(root + '/'), 'Consumer resolved a workspace link');
  const installed = JSON.parse(readFileSync(join(packageRoot, 'package.json')));
  assert.equal(installed.version, manifest.version);
  for (const [key, entry] of Object.entries(pkg.exports)) {
    const specifier = pkg.name + (key === '.' ? '' : key.slice(1));
    const path = realpathSync(require.resolve(specifier));
    assert.ok(path.startsWith(root + '/'), `Export escaped consumer: ${specifier}`);
    if (path.endsWith('.json')) { JSON.parse(readFileSync(path)); continue; }
    const module = await import(specifier);
    imports.push(`import * as Module${imports.length} from ${JSON.stringify(specifier)};`);
    if (key === './experimental/v2' || ['@disclosureos/observables', '@disclosureos/origins'].includes(pkg.name) && key === '.') {
      for (const [name, value] of Object.entries(module)) {
        if (!/(_PROFILE|_POLICY|_RULESET_VERSION)$/.test(name) && !['TECHNOLOGY_OBSERVABLES', 'BIOLOGICS_OBSERVABLES', 'OCS_TAXONOMY'].includes(name)) continue;
        definitions.push({ package: pkg.name, export: key, name, value: canonical(value), sha256: digest(value) });
      }
    }
  }
  for (const schema of pkg.schemas) {
    const bytes = readFileSync(join(packageRoot, schema.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), schema.sha256);
    assert.equal(JSON.parse(bytes).$id, schema.id);
  }
}
assert.ok(definitions.some(d => d.name === 'OCS_TAXONOMY'));
assert.ok(definitions.some(d => d.name === 'PROFILE_EVALUATION_POLICY'));
const { parseExperimentalObservation, parseExperimentalClaimHistory } = await import('@disclosureos/records/experimental/v2');
let cases = 0;
for (const [file, parse] of [['observation-fixtures.json', parseExperimentalObservation], ['claim-history-fixtures.json', parseExperimentalClaimHistory]]) {
  const corpus = JSON.parse(readFileSync(join(root, file)));
  for (const fixture of corpus.cases) {
    const input = structuredClone(corpus.bases[fixture.base]);
    for (const change of fixture.changes) {
      assert.ok(change.path.every(k => !['__proto__', 'prototype', 'constructor'].includes(k)));
      let target = input;
      for (const key of change.path.slice(0, -1)) target = target[key];
      const key = change.path.at(-1);
      if (change.op === 'remove') delete target[key];
      else if (change.op === 'append') target[key].push(structuredClone(change.value));
      else { assert.equal(change.op, 'replace'); target[key] = structuredClone(change.value); }
    }
    const before = structuredClone(input);
    const result = parse(input);
    assert.equal(result.checks.structural, fixture.structural ? 'passed' : 'failed', fixture.id);
    assert.equal(result.checks.semantic, !fixture.structural ? 'not_checked' : fixture.semantic ? 'passed' : 'failed', fixture.id);
    assert.equal(result.checks.profile, 'not_checked'); assert.equal(result.checks.external, 'not_checked');
    assert.equal(result.success, fixture.structural && fixture.semantic === true, fixture.id);
    for (const code of fixture.codes) assert.ok(result.issues.some(issue => issue.code === code), fixture.id);
    assert.deepEqual(input, before);
    if (result.success) assert.deepEqual(result.data, before);
    cases++;
  }
}
const cli = resolve(root, 'node_modules/@disclosureos/cli/dist/index.js');
assert.equal(execFileSync(process.execPath, [cli, '--version']).toString().trim(), manifest.version);
writeFileSync(join(root, 'consumer.ts'), imports.join('\n') + '\n' + `
import type { ExperimentalObservation } from '@disclosureos/records/experimental/v2';
import { parseExperimentalObservation } from '@disclosureos/records/experimental/v2';
const result = parseExperimentalObservation({});
if (result.success) { const observation: ExperimentalObservation = result.data; void observation; }
`);
writeFileSync(join(root, 'definitions.json'), JSON.stringify(definitions, null, 2) + '\n');
console.log(`Fresh consumer: all exports resolved, ${cases} observation/claim fixtures passed, ${definitions.length} definitions inventoried.`);
