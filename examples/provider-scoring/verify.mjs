import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  evaluateProviderScore,
  compareProviderScores,
} from "../../packages/disclosureos-scoring/dist/experimental/v2/index.js";
import {
  parseExperimentalObservation,
  parseCaseRecord,
} from "../../packages/disclosureos-records/dist/experimental/v2/index.js";
import { computeWorksheet } from "./methods/compute.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function verifyExample() {
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.fictional, true);
  const files = new Map();
  const refs = new Map();
  for (const entry of manifest.files) {
    assert.match(entry.file, /^[a-z0-9./-]+$/);
    assert.ok(!entry.file.split("/").includes(".."));
    assert.ok(!files.has(entry.file), "Duplicate file path");
    assert.ok(!refs.has(entry.ref), "Duplicate artifact reference");
    const bytes = await readFile(path.join(root, entry.file));
    assert.equal(bytes.length, entry.byteLength, entry.file);
    assert.equal(digest(bytes), entry.sha256, entry.file);
    files.set(entry.file, bytes);
    refs.set(entry.ref, bytes);
  }
  const json = (file) => {
    assert.ok(files.has(file), `Unlisted file ${file}`);
    return JSON.parse(files.get(file).toString());
  };
  const observation = parseExperimentalObservation(json("inputs/observation.json"));
  const caseRecord = parseCaseRecord(json("inputs/case.json"));
  assert.equal(observation.success, true);
  assert.equal(caseRecord.success, true);
  assert.equal(observation.data.id, "meridian-reviewed-specimens-v1");
  assert.ok(caseRecord.data.observationRefs.some((entry) => entry.documentId === observation.data.id && entry.sha256 === digest(files.get("inputs/observation.json"))));
  for (const file of ["collection-sheet.md", "handling-log.md", "preparation-protocol.md", "laboratory-report.md", "laboratory-replicates.csv"]) {
    assert.ok(observation.data.sources.some((source) => source.title === `sources/${file}` && source.digest?.value === digest(files.get(`inputs/${file}`))), `Selected source must match the observation: ${file}`);
  }
  const results = new Map();
  for (const entry of manifest.results) {
    const result = json(entry.result);
    const policy = json(entry.policy);
    const method = json(entry.method);
    const worksheet = json(entry.worksheet);
    const computed = computeWorksheet(method, worksheet);
    assert.equal(result.subject.id, observation.data.id);
    assert.equal(result.policy.id, method.id);
    assert.equal(result.policy.version, method.version);
    assert.deepEqual(policy.scale.grades, method.grades);
    assert.equal(result.outcome.status, computed.status);
    if (computed.status === "scored") {
      assert.equal(result.outcome.value, computed.value);
      assert.equal(result.outcome.gradeId, computed.grade);
    } else {
      assert.ok(!("value" in result.outcome), "Unavailable is not zero");
      assert.equal(result.outcome.reasonCode, "missing_inputs");
      assert.deepEqual(result.missingInputs.map((input) => input.ref), computed.missing.map((id) => `criterion-${id}`));
    }
    const options = { policyBytes: files.get(entry.policy), inputFiles: refs, derivationFiles: refs, methodFiles: refs };
    const evaluated = await evaluateProviderScore(result, options);
    assert.equal(evaluated.success, true, JSON.stringify(evaluated.issues));
    assert.deepEqual(evaluated.checks, { structural: "passed", semantic: "passed", external: "passed" });
    assert.equal(evaluated.policyExecution, "not_checked", "Contract checking is distinct from the example's arithmetic replay");
    assert.equal(evaluated.providerAuthentication, "not_checked");
    assert.equal(evaluated.scientificValidity, "not_checked");
    results.set(entry.id, { result, computed, evaluated, options });
  }
  assert.equal(results.get("team-a").computed.value, 85);
  assert.equal(results.get("team-b").computed.value, 70);
  assert.equal(results.get("priority").computed.value, 75);
  assert.equal(results.get("incomplete").computed.value, null);
  const comparisons = [];
  for (const entry of manifest.comparisons) {
    const left = results.get(entry.left), right = results.get(entry.right);
    assert.ok(left && right);
    const result = await compareProviderScores(left.result, right.result, { left: left.options, right: right.options });
    assert.equal(result.eligibleForComparison, entry.id === "shared");
    assert.equal(result.statisticalIndependence, "not_checked");
    assert.equal(result.sharedInputDigests.length, 7);
    if (entry.id === "different") assert.deepEqual(result.reasons, ["different_policy"]);
    if (entry.id === "incomplete") assert.deepEqual(result.reasons, ["unavailable_result", "incomplete_inputs"]);
    comparisons.push({ id: entry.id, eligible: result.eligibleForComparison, reasons: result.reasons });
  }
  return { files: files.size, results: results.size, comparisons, fictional: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyExample(), null, 2));
}
