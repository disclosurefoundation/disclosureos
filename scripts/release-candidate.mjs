// Pack reviewed beta artifacts and verify them outside the workspace. Never publishes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, cpSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const git = (...args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 20 * 1024 * 1024 }).toString().trim();
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
const walk = path => readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e =>
  e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)]);

export function validatePackage(pkg, plan, packed = false) {
  assert.equal(pkg.version, plan.version, pkg.name);
  assert.equal(pkg.publishConfig?.tag, plan.tag, `${pkg.name}: publish tag`);
  assert.equal(pkg.publishConfig?.access, 'public');
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (name.startsWith('@disclosureos/')) {
      assert.ok(plan.packages.includes(name.slice('@disclosureos/'.length)), `Unknown internal dependency: ${name}`);
      assert.equal(version, packed ? plan.version : 'workspace:*', `${pkg.name} dependency ${name}`);
    } else if (packed) assert.ok(!version.startsWith('workspace:') && !version.startsWith('catalog:'), `Unresolved dependency: ${name}`);
  }
  if (packed && pkg.dependencies?.zod) assert.equal(pkg.dependencies.zod, plan.zod);
}

export function checkPlan() {
  const plan = read(join(root, 'docs/releases/beta-plan.json'));
  assert.match(plan.version, /^2\.0\.0-beta\.\d+$/);
  assert.equal(plan.tag, 'beta');
  assert.match(plan.implementationRevision, /^[a-f0-9]{40}$/);
  const baselineSchemas = git('ls-tree', '-r', '--name-only', plan.implementationRevision, '--', 'packages')
    .split('\n').filter(path => /\/schema\/.+\.json$/.test(path));
  for (const path of baselineSchemas) {
    const original = execFileSync('git', ['-C', root, 'show', `${plan.implementationRevision}:${path}`]);
    assert.ok(original.equals(readFileSync(join(root, path))), `Schema changed during packaging: ${path}`);
  }
  const pre = read(join(root, '.changeset/pre.json'));
  assert.equal(pre.mode, 'pre'); assert.equal(pre.tag, plan.tag);
  const actual = readdirSync(join(root, 'packages')).filter(p => p.startsWith('disclosureos-')).map(p => p.slice(13)).sort();
  assert.deepEqual([...plan.packages].sort(), actual);
  const packages = plan.packages.map(name => {
    const dir = join(root, `packages/disclosureos-${name}`);
    const pkg = read(join(dir, 'package.json'));
    assert.equal(pkg.name, `@disclosureos/${name}`);
    validatePackage(pkg, plan);
    assert.ok(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8').includes(`## ${plan.version}`));
    return { name, dir, pkg };
  });
  return { plan, packages };
}

async function main() {
  const mode = process.argv[2] ?? '--check';
  assert.ok(['--check', '--pack'].includes(mode), 'Usage: release-candidate.mjs --check | --pack [new-output-directory]');
  const { plan, packages } = checkPlan();
  if (mode === '--check') { console.log(`Beta plan verified: ${packages.length} packages at ${plan.version}, tag ${plan.tag}`); return; }
  // A receipt must name a committed source, not an unrecorded working tree.
  assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Commit candidate changes before packing.');
  const output = process.argv[3] ? resolve(process.argv[3]) : mkdtempSync(join(tmpdir(), 'disclosureos-beta-'));
  if (process.argv[3]) mkdirSync(output); // Refuse to overwrite an existing candidate.
  run('pnpm', ['--filter', '@disclosureos/*', 'build']);
  assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Build changed committed inputs');
  const artifacts = join(output, 'artifacts'); mkdirSync(artifacts);
  const manifest = { kind: 'disclosureos-beta-candidate', status: 'verification-in-progress', version: plan.version, tag: plan.tag,
    repository: 'https://github.com/disclosurefoundation/disclosureos', sourceCommit: git('rev-parse', 'HEAD'),
    implementationRevision: plan.implementationRevision, lockSha256: sha256(readFileSync(join(root, 'pnpm-lock.yaml'))),
    runtime: { node: process.version, pnpm: execFileSync('pnpm', ['--version']).toString().trim() }, packages: [] };
  for (const { name, dir, pkg } of packages) {
    run('pnpm', ['pack', '--pack-destination', artifacts], dir);
    const filename = `disclosureos-${name}-${plan.version}.tgz`;
    const tarball = join(artifacts, filename);
    const packed = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json']));
    validatePackage(packed, plan, true);
    const members = execFileSync('tar', ['-tzf', tarball]).toString().trim().split('\n');
    const exports = packed.exports ?? {};
    for (const target of Object.values(exports).flatMap(entry => typeof entry === 'string' ? [entry] : Object.values(entry))) {
      assert.ok(members.includes(`package/${target.replace(/^\.\//, '')}`), `Missing export target: ${pkg.name} ${target}`);
    }
    const schemas = members.filter(path => path.startsWith('package/schema/') && path.endsWith('.json')).sort().map(path => {
      const bytes = execFileSync('tar', ['-xOf', tarball, path]);
      const sourcePath = `packages/disclosureos-${name}/${path.slice('package/'.length)}`;
      assert.ok(bytes.equals(readFileSync(join(root, sourcePath))), `Packed schema drift: ${sourcePath}`);
      return { path: path.slice('package/'.length), id: JSON.parse(bytes).$id, sha256: sha256(bytes) };
    });
    const trackedSchemas = (existsSync(join(dir, 'schema')) ? walk(join(dir, 'schema')) : []).filter(p => p.endsWith('.json')).map(p => p.slice(dir.length + 1));
    assert.deepEqual(schemas.map(s => s.path).sort(), trackedSchemas.sort(), 'All committed schemas must ship');
    manifest.packages.push({ name: pkg.name, version: pkg.version, tarball: filename, sha256: sha256(readFileSync(tarball)),
      dependencies: packed.dependencies, exports, schemas });
  }
  const consumer = join(output, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), json({ name: 'disclosureos-beta-consumer', private: true, type: 'module' }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...manifest.packages.map(p => join(artifacts, p.tarball))], consumer);
  // Module resolution and type checks run inside the independent install.
  cpSync(join(root, 'scripts/release-consumer.mjs'), join(consumer, 'verify.mjs'));
  writeFileSync(join(consumer, 'candidate.json'), json(manifest));
  cpSync(join(root, 'conformance/v2-observation-fixtures.json'), join(consumer, 'observation-fixtures.json'));
  cpSync(join(root, 'conformance/v2-claim-history-fixtures.json'), join(consumer, 'claim-history-fixtures.json'));
  cpSync(join(root, 'examples/v2/context-demo'), join(consumer, 'context-demo'), { recursive: true });
  cpSync(join(root, 'examples/v2/witness-accounts-demo'), join(consumer, 'witness-accounts-demo'), { recursive: true });
  run(process.execPath, ['verify.mjs'], consumer);
  manifest.definitions = read(join(consumer, 'definitions.json'));
  const tsc = realpathSync(join(root, 'packages/disclosureos-records/node_modules/typescript/bin/tsc'));
  for (const module of ['NodeNext', 'ESNext']) run(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', module,
    '--moduleResolution', module === 'NodeNext' ? 'NodeNext' : 'Bundler', 'consumer.ts'], consumer);
  run(process.execPath, [join(root, 'conformance/migration-closeout.mjs'), '--cli', join(consumer, 'node_modules/@disclosureos/cli/dist/index.js')]);
  manifest.status = 'passed';
  manifest.checks = { exportResolution: 'passed', types: ['NodeNext', 'Bundler'], observationAndClaimCorpus: 'passed', contextSnapshotConsumer: 'passed', witnessAccountsConsumer: 'passed', migrationCloseout: 'passed', scientificValidity: 'not_checked', partnerData: 'not_used' };
  writeFileSync(join(output, 'release-manifest.json'), json(manifest));
  console.log(`Verified candidate artifacts and manifest: ${output}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
