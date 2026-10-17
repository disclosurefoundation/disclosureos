import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlan, validatePackage, verifySchemaBaseline } from './release-candidate.mjs';
const plan = { version: '2.0.0-beta.0', tag: 'beta', packages: ['records', 'schema'], zod: '4.4.3' };
const pkg = { name: '@disclosureos/schema', version: plan.version, publishConfig: { tag: 'beta', access: 'public' }, dependencies: { '@disclosureos/records': plan.version, zod: '4.4.3' } };
test('accepts packed dependencies only at the exact beta versions', () => {
  validatePackage(pkg, plan, true);
  for (const dependency of ['workspace:*', '^2.0.0-beta.0', '1.1.0']) {
    assert.throws(() => validatePackage({ ...pkg, dependencies: { '@disclosureos/records': dependency } }, plan, true));
  }
  assert.throws(() => validatePackage({ ...pkg, dependencies: { zod: '^4.4.3' } }, plan, true));
});
test('rejects latest-tag publication and incomplete versioning', () => {
  assert.throws(() => validatePackage({ ...pkg, publishConfig: { tag: 'latest', access: 'public' } }, plan, true));
  assert.throws(() => validatePackage({ ...pkg, version: '1.1.0' }, plan, true));
});
test('the frozen beta candidate, package versions and changelogs agree', () => {
  assert.equal(checkPlan().packages.length, 7);
  assert.equal(checkPlan().plan.version, '2.0.0-beta.4');
  assert.equal(checkPlan({ sourceOnly: true }).packages.length, 7);
});

test('source verification does not waive the frozen release schema baseline', () => {
  const readCommitted = revision => Buffer.from(revision === 'frozen-release' ? 'old schema' : 'current schema');
  const readCurrent = () => Buffer.from('current schema');
  assert.throws(() => verifySchemaBaseline('frozen-release', ['schema.json'], readCommitted, readCurrent), /Schema changed during packaging/);
  verifySchemaBaseline('source-head', ['schema.json'], readCommitted, readCurrent);
  assert.throws(() => verifySchemaBaseline('source-head', ['schema.json'], readCommitted, () => Buffer.from('uncommitted schema')), /Schema changed during packaging/);
});
