// Copied into a fresh npm consumer by release-candidate.mjs; no workspace imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
    const path = realpathSync(fileURLToPath(import.meta.resolve(specifier)));
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
// Exercise C1 through the independent install, including exact bytes and failure paths.
const { parseObservationContext, parseContextClaimHistory } = await import('@disclosureos/records/experimental/v2');
const { evaluateContextClaimHistory } = await import('@disclosureos/schema/experimental/v2');
const contextFile = name => readFileSync(join(root, 'context-demo', name));
const contextHistory = JSON.parse(contextFile('history.json'));
const context = JSON.parse(contextFile('context.json'));
const documents = new Map(['observation.json', 'context.json', 'acquisition.json'].map(name => {
  const bytes = contextFile(name);
  return [createHash('sha256').update(bytes).digest('hex'), bytes];
}));
assert.equal(parseObservationContext(context).success, true);
assert.equal(parseContextClaimHistory(contextHistory).success, true);
assert.equal(parseExperimentalClaimHistory(contextHistory).success, false, 'Do not dispatch C1 through claim history 0.1');
assert.equal(parseObservationContext(context).checks.external, 'not_checked');
const beforeContextHistory = structuredClone(contextHistory);
const beforeDocuments = structuredClone(documents);
const contextResult = await evaluateContextClaimHistory(contextHistory, { documents });
assert.equal(contextResult.success, true, JSON.stringify(contextResult.issues));
assert.deepEqual(contextResult.checks, { structural: 'passed', semantic: 'passed', profile: 'not_checked', external: 'passed' });
for (const key of ['temporalNormalization', 'sourceArtifactIntegrity', 'scientificInterpretation', 'multiSensorFusion'])
  assert.equal(contextResult[key], 'not_checked');
assert.deepEqual(contextHistory, beforeContextHistory);
assert.deepEqual(structuredClone(documents), beforeDocuments);
assert.equal(context.entities.find(e => e.kind === 'reported_object').fields.shape.length, 2);
assert.equal(context.entities.find(e => e.kind === 'collection').fields.alignmentDescription[0].content.state, 'unknown');
const contextHash = contextHistory.contextRefs[0].sha256;
const missingDocuments = new Map(documents);
missingDocuments.delete(contextHash);
const missing = await evaluateContextClaimHistory(contextHistory, { documents: missingDocuments });
assert.equal(missing.success, false);
assert.ok(missing.issues.some(i => i.code === 'SNAPSHOT.UNAVAILABLE'));
assert.equal(missing.checks.external, 'not_checked');
const alteredDocuments = new Map(documents);
alteredDocuments.set(contextHash, Buffer.from('{}'));
const altered = await evaluateContextClaimHistory(contextHistory, { documents: alteredDocuments });
assert.equal(altered.success, false);
assert.ok(altered.issues.some(i => i.code === 'SNAPSHOT.DIGEST'));
assert.equal(altered.checks.external, 'failed');
const exampleResult = JSON.parse(execFileSync(process.execPath, [join(root, 'context-demo/run.mjs')]).toString());
assert.deepEqual(exampleResult, contextResult, 'Shipped example follows the independent consumer path');
console.log('Fresh C1 consumer: context parsing, exact snapshots, missing/tampered bytes and runnable example passed.');
// C2a exercises the actual tarball consumer rather than a workspace-only fixture.
const { parseResearchEntities, parseResearchClaimHistory } = await import('@disclosureos/records/experimental/v2');
const { evaluateResearchClaimHistory } = await import('@disclosureos/schema/experimental/v2');
const researchFile = name => readFileSync(join(root, 'witness-accounts-demo', name));
const researchHistory = JSON.parse(researchFile('history.json'));
const researchEntities = JSON.parse(researchFile('entities.json'));
const researchDocuments = new Map(['observation.json', 'context.json', 'entities.json'].map(name => {
  const bytes = researchFile(name); return [createHash('sha256').update(bytes).digest('hex'), bytes];
}));
assert.equal(parseResearchEntities(researchEntities).success, true);
assert.equal(parseResearchClaimHistory(researchHistory).success, true);
assert.equal(parseContextClaimHistory(researchHistory).success, false);
const researchResult = await evaluateResearchClaimHistory(researchHistory, { documents: researchDocuments });
assert.equal(researchResult.success, true, JSON.stringify(researchResult.issues));
assert.equal(researchResult.scientificInterpretation, 'not_checked');
assert.equal(researchResult.sourceArtifactIntegrity, 'not_checked');
assert.deepEqual(JSON.parse(execFileSync(process.execPath, [join(root, 'witness-accounts-demo/run.mjs')]).toString()), researchResult);
const missingResearch = new Map(researchDocuments);
missingResearch.delete(researchHistory.entityRefs[0].sha256);
assert.equal((await evaluateResearchClaimHistory(researchHistory, { documents: missingResearch })).success, false);
const alteredResearch = new Map(researchDocuments);
alteredResearch.set(researchHistory.entityRefs[0].sha256, Buffer.from('{}'));
assert.ok((await evaluateResearchClaimHistory(researchHistory, { documents: alteredResearch })).issues.some(i => i.code === 'SNAPSHOT.DIGEST'));
console.log('Fresh C2a consumer: witness/account parsing, exact snapshots, missing/tampered bytes and runnable example passed.');
// C2b runs exclusively against installed tarballs, with no source-artifact fetches.
const { parseArchivalEntities, parseArchivalClaimHistory } = await import('@disclosureos/records/experimental/v2');
const { evaluateArchivalClaimHistory } = await import('@disclosureos/schema/experimental/v2');
const archivalFile = name => readFileSync(join(root, 'archival-editions-demo', name));
const archivalHistory = JSON.parse(archivalFile('history.json'));
const archivalEntities = JSON.parse(archivalFile('entities.json'));
const archivalDocuments = new Map(['observation.json', 'entities.json'].map(name => {
  const bytes = archivalFile(name); return [createHash('sha256').update(bytes).digest('hex'), bytes];
}));
assert.equal(parseArchivalEntities(archivalEntities).success, true);
assert.equal(parseArchivalEntities(archivalEntities).checks.external, 'not_checked');
assert.equal(parseArchivalClaimHistory(archivalHistory).success, true);
assert.equal(parseResearchEntities(archivalEntities).success, false, 'No silent projection into entities 0.1');
assert.equal(parseResearchClaimHistory(archivalHistory).success, false, 'No silent projection into history 0.3');
const beforeArchivalHistory = structuredClone(archivalHistory);
const beforeArchivalDocuments = structuredClone(archivalDocuments);
const archivalResult = await evaluateArchivalClaimHistory(archivalHistory, { documents: archivalDocuments });
assert.equal(archivalResult.success, true, JSON.stringify(archivalResult.issues));
assert.deepEqual(archivalResult.checks, { structural: 'passed', semantic: 'passed', external: 'passed', profile: 'not_checked' });
for (const key of ['temporalNormalization', 'sourceArtifactIntegrity', 'scientificInterpretation', 'multiSensorFusion'])
  assert.equal(archivalResult[key], 'not_checked');
assert.deepEqual(archivalHistory, beforeArchivalHistory);
assert.deepEqual(structuredClone(archivalDocuments), beforeArchivalDocuments);
assert.deepEqual(JSON.parse(execFileSync(process.execPath, [join(root, 'archival-editions-demo/run.mjs')]).toString()), archivalResult);
const edition = id => archivalEntities.entities.find(e => e.id === id);
assert.equal(edition('edition-a').fields.pageCount[0].content.value, 3);
assert.equal(edition('edition-b').fields.pageCount[0].content.value, 4);
assert.equal(edition('declassification-a').fields.occurredAt[0].content.state, 'unknown');
assert.equal(edition('edition-a').fields.redactionPercent[0].content.state, 'unknown');
assert.equal(edition('receive-a').predecessor.kind, 'unknown');
assert.equal(edition('file-a').fields.declaredHashes[0].content.value[0].hash.algorithm, 'md5');
assert.equal(edition('file-a').fields.declaredHashes[0].content.value[0].appliesTo.kind, 'unavailable_original');
const missingArchival = new Map(archivalDocuments);
missingArchival.delete(archivalHistory.entityRefs[0].sha256);
const missingArchivalResult = await evaluateArchivalClaimHistory(archivalHistory, { documents: missingArchival });
assert.equal(missingArchivalResult.success, false);
assert.ok(missingArchivalResult.issues.some(i => i.code === 'SNAPSHOT.UNAVAILABLE'));
const alteredArchival = new Map(archivalDocuments);
alteredArchival.set(archivalHistory.entityRefs[0].sha256, Buffer.from('{}'));
const alteredArchivalResult = await evaluateArchivalClaimHistory(archivalHistory, { documents: alteredArchival });
assert.equal(alteredArchivalResult.success, false);
assert.ok(alteredArchivalResult.issues.some(i => i.code === 'SNAPSHOT.DIGEST'));
const wrongEdition = structuredClone(archivalHistory);
wrongEdition.claims[0].editionCitation.editionId = 'edition-b';
const wrongEditionResult = await evaluateArchivalClaimHistory(wrongEdition, { documents: archivalDocuments });
assert.equal(wrongEditionResult.success, false);
assert.ok(wrongEditionResult.issues.some(i => i.code === 'ARCHIVE.CITATION_SCOPE'));
const wrongPage = structuredClone(archivalHistory);
wrongPage.claims[1].editionInputRefs[0].locator.page = 4;
const wrongPageResult = await evaluateArchivalClaimHistory(wrongPage, { documents: archivalDocuments });
assert.equal(wrongPageResult.success, false);
assert.ok(wrongPageResult.issues.some(i => i.code === 'ARCHIVE.PAGE_BOUNDS'));
console.log('Fresh C2b consumer: exact editions, retained missingness, snapshot failures, citation scope, page bounds and runnable example passed.');
const cli = resolve(root, 'node_modules/@disclosureos/cli/dist/index.js');
assert.equal(execFileSync(process.execPath, [cli, '--version']).toString().trim(), manifest.version);
writeFileSync(join(root, 'consumer.ts'), imports.join('\n') + '\n' + `
import type { ArchivalReviewOptions, ArchivalReviewResult } from '@disclosureos/schema/experimental/v2';
import { evaluateArchivalClaimHistory } from '@disclosureos/schema/experimental/v2';
import { parseArchivalEntities, parseArchivalClaimHistory, type ArchivalEntities, type ArchivalClaimHistory } from '@disclosureos/records/experimental/v2';
const archivalOptions: ArchivalReviewOptions = { documents: new Map<string, Uint8Array>() };
const archivalReview: Promise<ArchivalReviewResult> = evaluateArchivalClaimHistory({}, archivalOptions);
const parsedEntities = parseArchivalEntities({});
if (parsedEntities.success) { const entities: ArchivalEntities = parsedEntities.data; void entities; }
const parsedHistory = parseArchivalClaimHistory({});
if (parsedHistory.success) { const history: ArchivalClaimHistory = parsedHistory.data; void history; }
void archivalReview;
import type { ResearchReviewOptions, ResearchReviewResult } from '@disclosureos/schema/experimental/v2';
import { evaluateResearchClaimHistory } from '@disclosureos/schema/experimental/v2';
import { parseResearchEntities, parseResearchClaimHistory } from '@disclosureos/records/experimental/v2';
const researchOptions: ResearchReviewOptions = { documents: new Map<string, Uint8Array>() };
const researchReview: Promise<ResearchReviewResult> = evaluateResearchClaimHistory({}, researchOptions);
void researchReview; void parseResearchEntities({}); void parseResearchClaimHistory({});
import type { ContextReviewOptions, ContextReviewResult } from '@disclosureos/schema/experimental/v2';
import { evaluateContextClaimHistory } from '@disclosureos/schema/experimental/v2';
import { parseObservationContext, parseContextClaimHistory } from '@disclosureos/records/experimental/v2';
const options: ContextReviewOptions = { documents: new Map<string, Uint8Array>() };
const review: Promise<ContextReviewResult> = evaluateContextClaimHistory({}, options);
void review; void parseObservationContext({}); void parseContextClaimHistory({});
import type { ExperimentalObservation } from '@disclosureos/records/experimental/v2';
import { parseExperimentalObservation } from '@disclosureos/records/experimental/v2';
const result = parseExperimentalObservation({});
if (result.success) { const observation: ExperimentalObservation = result.data; void observation; }
`);
writeFileSync(join(root, 'definitions.json'), JSON.stringify(definitions, null, 2) + '\n');
console.log(`Fresh consumer: all exports resolved, ${cases} observation/claim fixtures passed, ${definitions.length} definitions inventoried.`);
