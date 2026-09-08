import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateDocumentationCompletion,
  evaluateAssessmentDocumentation,
  DOCUMENTATION_COMPLETION_POLICY,
  DOCUMENTATION_REQUIREMENTS,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const corpus = JSON.parse(
  readFileSync(
    new URL("./v2-assessment-documentation-fixtures.json", import.meta.url)
  )
);
function input(fixture = { changes: [] }) {
  const value = structuredClone(corpus.base);
  for (const change of fixture.changes) {
    let target = value;
    for (const part of change.path.slice(0, -1)) target = target[part];
    const key = change.path.at(-1);
    if (change.op === "remove") delete target[key];
    else target[key] = structuredClone(change.value);
  }
  return value;
}
const assets = (fixture = { omitAssets: [], assetOverrides: {} }) =>
  new Map(
    Object.entries({ ...corpus.assets, ...fixture.assetOverrides })
      .filter(([ref]) => !fixture.omitAssets.includes(ref))
      .map(([ref, text]) => [ref, new TextEncoder().encode(text)])
  );
const named = (name) => corpus.cases.find((c) => c.id === name);
async function run(name) {
  const f = named(name);
  return evaluateDocumentationCompletion(input(f), { assets: assets(f) });
}
const row = (r, id) => r.assessments[0].requirements.find((v) => v.id === id);
for (const fixture of corpus.cases)
  test(`completion parity: ${fixture.id}`, async () => {
    const history = input(fixture),
      bytes = assets(fixture),
      before = structuredClone(history);
    const report = await evaluateDocumentationCompletion(history, {
        assets: bytes,
      }),
      expected = await evaluateAssessmentDocumentation(history, {
        assets: bytes,
      });
    assert.deepEqual(report.validation, expected);
    assert.deepEqual(history, before);
    assert.equal(report.scientificEligibility, "not_checked");
    assert.equal(report.methodExecution, "not_checked");
    assert.equal(report.artifactContents, "not_checked");
    assert.equal(report.actions.length, expected.issues.length);
    assert.ok(report.actions.every((a) => a.nextAction.trim().length > 0));
    for (const a of report.assessments) {
      const original = expected.assessments.find(
        (x) => x.claimRef === a.claimRef
      );
      assert.equal(a.documentationStatus, original.status);
      assert.equal(a.requirements.length, 9);
      assert.equal(
        Object.values(a.counts).reduce((n, v) => n + v, 0),
        9
      );
      assert.ok(
        a.requirements.every((r) => r.reason && r.importance === "required")
      );
      if (original.status === "passed")
        assert.ok(
          a.requirements.every((r) =>
            ["satisfied", "not_applicable"].includes(r.status)
          )
        );
      for (const r of a.requirements)
        if (r.status === "not_applicable")
          assert.equal(r.applicability, "not_applicable");
    }
  });
test("catalog and policy are immutable", () => {
  assert.ok(Object.isFrozen(DOCUMENTATION_COMPLETION_POLICY));
  assert.ok(Object.isFrozen(DOCUMENTATION_REQUIREMENTS));
  assert.ok(DOCUMENTATION_REQUIREMENTS.every(Object.isFrozen));
});
test("confirmed fixture satisfies eight groups; undeclared frame is excluded", async () => {
  const r = await run("confirmed-documentation-with-local-bytes");
  assert.deepEqual(r.assessments[0].counts, {
    satisfied: 8,
    missing: 0,
    failed: 0,
    not_checked: 0,
    not_applicable: 1,
  });
  assert.equal(row(r, "reference_frames").status, "not_applicable");
  assert.match(row(r, "reference_frames").reason, /scientifically unnecessary/);
});
for (const name of [
  "reported-with-source-passage",
  "inconclusive-with-source-passage",
  "assessed-absence-is-not-unassessed",
])
  test(`${name} has no instrument penalty`, async () => {
    const r = await run(name);
    assert.equal(r.assessments[0].counts.satisfied, 4);
    assert.equal(r.assessments[0].counts.not_applicable, 5);
    assert.equal(r.assessments[0].documentationStatus, "passed");
  });
test("missing matched measurement blocks dependent checks without false passes", async () => {
  const r = await run("no-inputs");
  assert.equal(row(r, "measurement").status, "missing");
  for (const id of [
    "measurement_uncertainty",
    "raw_product_lineage",
    "reference_frames",
  ]) {
    assert.equal(row(r, id).status, "not_checked");
    assert.deepEqual(row(r, id).blockedBy, ["measurement"]);
  }
  assert.deepEqual(row(r, "content_integrity").blockedBy, [
    "documentary_support",
  ]);
});
test("missing bytes and corrupt bytes are distinguished", async () => {
  const missing = await run("missing-one-asset"),
    corrupt = await run("wrong-bytes");
  assert.equal(row(missing, "content_integrity").status, "missing");
  assert.equal(row(corrupt, "content_integrity").status, "failed");
  assert.match(
    row(corrupt, "content_integrity").actions[0].nextAction,
    /Do not replace a pin/
  );
});
test("missing pin blocks verification, without inventing a completed byte check", async () => {
  const r = await run("unpinned-product");
  assert.equal(row(r, "content_digests").status, "missing");
  assert.equal(row(r, "content_integrity").status, "not_checked");
  assert.deepEqual(row(r, "content_integrity").blockedBy, ["content_digests"]);
});
test("unassessed is retained, rather than treated as an assessed absence", async () => {
  const r = await run("unassessed");
  assert.equal(r.assessments[0].documentationStatus, "not_checked");
  assert.equal(row(r, "assessment").status, "missing");
  assert.equal(row(r, "measurement").applicability, "not_checked");
  assert.deepEqual(row(r, "measurement").blockedBy, ["assessment"]);
  assert.match(row(r, "assessment").actions[0].nextAction, /Retain unassessed/);
});
test("a source-only history is inapplicable, not a demand to invent assessments", async () => {
  const r = await run("archive-statements-only");
  assert.equal(r.applicability.state, "not_applicable");
  assert.deepEqual(r.assessments, []);
  assert.match(r.actions[0].nextAction, /do not fabricate/);
});
test("invalid input never becomes an inapplicable or complete report", async () => {
  const r = await run("missing-evaluator");
  assert.equal(r.applicability.state, "not_checked");
  assert.deepEqual(r.assessments, []);
  assert.equal(r.validation.checks.structural, "failed");
});
test("unknown time, uncertainty and frame have targeted next actions", async () => {
  for (const [name, id, pattern] of [
    ["unknown-time", "event_time", /default date/],
    ["unknown-uncertainty", "measurement_uncertainty", /Keep unknown/],
    ["unknown-declared-frame", "reference_frames", /unknown frame/],
  ]) {
    const r = await run(name),
      item = row(r, id);
    assert.equal(item.status, "missing");
    assert.match(item.actions[0].nextAction, pattern);
  }
});
test("an unassessed second topic does not change the completed first checklist", async () => {
  const v = input(),
    before = await evaluateDocumentationCompletion(v, { assets: assets() });
  v.claims.push({
    id: "unassessed-biology",
    kind: "assessment",
    recordedAt: "2026-09-07T00:00:00Z",
    topic: "biologics",
    subject: { kind: "observation" },
    status: "unassessed",
    inputRefs: [],
    rationale: "Not evaluated.",
  });
  const after = await evaluateDocumentationCompletion(v, { assets: assets() });
  assert.deepEqual(after.assessments[0], before.assessments[0]);
  assert.equal(after.validation.checks.profile, "not_checked");
});
test("exact copies produce the same per-assessment checklist, with no aggregate score", async () => {
  const v = input();
  v.claims.push({ ...structuredClone(v.claims[1]), id: "copy" });
  const r = await evaluateDocumentationCompletion(v, { assets: assets() });
  assert.deepEqual(
    r.assessments[0].requirements,
    r.assessments[1].requirements
  );
  assert.deepEqual(r.assessments[0].counts, r.assessments[1].counts);
  for (const key of ["score", "percentage", "grade", "overallCompletion"])
    assert.equal(key in r, false);
});
test("confidence has no effect on completion", async () => {
  const v = input(),
    before = await evaluateDocumentationCompletion(v, { assets: assets() });
  v.claims[1].confidence = 0;
  assert.deepEqual(
    (await evaluateDocumentationCompletion(v, { assets: assets() }))
      .assessments,
    before.assessments
  );
});
test("runtime hash failure stays unchecked and supplies a recovery action", async () => {
  const original = globalThis.crypto.subtle.digest;
  globalThis.crypto.subtle.digest = async () => {
    throw Error("Unavailable");
  };
  try {
    const r = await evaluateDocumentationCompletion(input(), {
      assets: assets(),
    });
    assert.equal(row(r, "content_integrity").status, "not_checked");
    assert.match(
      row(r, "content_integrity").actions[0].nextAction,
      /runtime with SHA-256/
    );
  } finally {
    globalThis.crypto.subtle.digest = original;
  }
});
test("input applicability and bytes are captured before asynchronous checks", async () => {
  const history = input(),
    bytes = assets(),
    expected = await evaluateDocumentationCompletion(history, {
      assets: bytes,
    });
  const pending = evaluateDocumentationCompletion(history, { assets: bytes });
  history.claims[1].outcome = "reported";
  for (const b of bytes.values()) b.fill(0);
  assert.deepEqual(await pending, expected);
});
test("no implicit network requests", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Network forbidden");
  };
  try {
    assert.equal(
      (await evaluateDocumentationCompletion(input(), { assets: assets() }))
        .validation.success,
      true
    );
  } finally {
    globalThis.fetch = original;
  }
});
