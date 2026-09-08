import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateInstrumentResearchCompletion as complete,
  evaluateInstrumentResearchPrerequisites as validate,
  INSTRUMENT_RESEARCH_COMPLETION_POLICY as policy,
  INSTRUMENT_RESEARCH_REQUIREMENTS as catalog,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const corpus = JSON.parse(
  readFileSync(
    new URL("./v2-research-prerequisites-fixtures.json", import.meta.url)
  )
);
const input = () => structuredClone(corpus.base);
const assets = () =>
  Object.fromEntries(
    Object.entries(corpus.assets).map(([ns, items]) => [
      ns,
      new Map(
        Object.entries(items).map(([ref, text]) => [
          ref,
          new TextEncoder().encode(text),
        ])
      ),
    ])
  );
const run = (v = input(), a = assets(), fn = complete) =>
  fn(v.history, v.context, v.bindings, v.mapping, v.review, a);
const row = (r, id) => r.requirements.find((x) => x.id === id);
function fixture(id) {
  const v = input();
  for (const c of corpus.cases.find((c) => c.id === id).changes) {
    let t = v;
    for (const k of c.path.slice(0, -1)) t = t[k];
    Object.defineProperty(t, c.path.at(-1), {
      value: structuredClone(c.value),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return v;
}
for (const c of corpus.cases)
  test(`authoritative parity: ${c.id}`, async () => {
    const v = fixture(c.id),
      before = structuredClone(v),
      r = await run(v);
    assert.deepEqual(r.validation, await run(v, assets(), validate));
    assert.deepEqual(v, before);
    assert.equal(
      Object.values(r.counts).reduce((a, b) => a + b, 0),
      6
    );
    assert.ok(r.actions.every((a) => a.nextAction.length > 0));
    assert.deepEqual(
      r.actions.map(({ nextAction, measurementRef, ...i }) => i),
      r.validation.issues
    );
    for (const k of [
      "scientificEligibility",
      "calibrationAdequacy",
      "timingModel",
      "reviewerAuthenticity",
    ])
      assert.equal(r[k], "not_checked");
    if (!r.validation.documentation)
      assert.equal(row(r, "assessment_documentation").status, "not_checked");
    if (!r.validation.measurements)
      assert.equal(row(r, "measurement_acquisition").status, "not_checked");
  });
test("complete declared prerequisites, fixed frozen catalog, no scientific grade", async () => {
  const r = await run();
  assert.equal(r.counts.satisfied, 6);
  assert.equal(r.validation.success, true);
  assert.equal(r.applicability.state, "selected");
  assert.deepEqual(r.policy, policy);
  assert.ok(
    Object.isFrozen(policy) &&
      Object.isFrozen(catalog) &&
      catalog.every(Object.isFrozen)
  );
  for (const k of ["score", "percentage", "confidence", "grade"])
    assert.equal(k in r, false);
});
for (const [name, expected] of [
  ["calibration unreviewed", "missing"],
  ["calibration rejected", "failed"],
  ["calibration inconclusive", "failed"],
  ["calibrationUse unreviewed", "missing"],
  ["calibrationUse rejected", "failed"],
  ["timing/review unreviewed", "missing"],
  ["timing/review inconclusive", "failed"],
  ["unknown timing", "missing"],
])
  test(`actionable reviewed context: ${name}`, async () => {
    const r = await run(fixture(name));
    assert.equal(row(r, "reviewed_context").status, expected);
    for (const id of [
      "assessment_documentation",
      "measurement_acquisition",
      "report_integrity",
    ]) {
      assert.equal(row(r, id).status, "not_checked");
      assert.ok(row(r, id).blockedBy.length);
    }
    if (name.startsWith("calibration ")) {
      const a = r.actions.find((a) => a.code === "RESEARCH.CALIBRATION_REVIEW");
      assert.equal(a.measurementRef, "measurement:velocity");
      assert.match(
        a.nextAction,
        expected === "failed" ? /Preserve the rejected/ : /Obtain the review/
      );
    }
  });
test("missing review inventory remains required", async () => {
  const r = await run(fixture("missing reviews"));
  assert.equal(row(r, "review_scope").status, "missing");
  assert.equal(row(r, "reviewed_context").status, "not_checked");
});
test("empty mapped and review inventories never exempt selected profile", async () => {
  const v = input();
  v.review.measurements = [];
  v.mapping.measurements = [];
  const r = await run(v);
  assert.notEqual(row(r, "review_scope").status, "satisfied");
  assert.equal(r.applicability.state, "selected");
  assert.equal(row(r, "report_integrity").status, "not_checked");
});
for (const [ns, id] of [
  ["observationAssets", "assessment_documentation"],
  ["contextAssets", "measurement_acquisition"],
  ["reviewAssets", "report_integrity"],
]) {
  test(`missing bytes: ${ns}`, async () => {
    const a = assets();
    delete a[ns];
    const r = await run(input(), a);
    assert.equal(row(r, id).status, "missing");
    assert.equal(row(r, "reviewed_context").status, "satisfied");
  });
  test(`corrupt bytes: ${ns}`, async () => {
    const a = assets();
    for (const b of a[ns].values()) b[0] ^= 1;
    const r = await run(input(), a);
    assert.equal(row(r, id).status, "failed");
  });
}
test("report length mismatch fails and preserves corrective guidance", async () => {
  const a = assets();
  a.reviewAssets.set("measurement:velocity/timing", new Uint8Array());
  const r = await run(input(), a);
  assert.equal(row(r, "report_integrity").status, "failed");
  assert.match(
    r.actions.find((a) => a.code === "RESEARCH.REPORT_SIZE").nextAction,
    /do not change/
  );
});
test("nested documentary pointers retained exactly", async () => {
  const r = await run(input(), {});
  const list = row(r, "assessment_documentation").actions;
  assert.deepEqual(
    list.map(({ nextAction, measurementRef, ...i }) => i),
    r.validation.documentation.issues.map((i) => ({
      ...i,
      pointer: "/documentation" + i.pointer,
    }))
  );
  assert.ok(
    list.every((a) =>
      r.actions.some((b) => b.code === a.code && b.pointer === a.pointer)
    )
  );
});
test("snapshot caller documents and byte maps before asynchronous work", async () => {
  const v = input(),
    a = assets(),
    pending = run(v, a);
  v.review.measurements = [];
  v.mapping.measurements = [];
  v.context.calibrations = [];
  v.history.claims = [];
  v.bindings.products = [];
  for (const map of Object.values(a)) for (const b of map.values()) b.fill(0);
  const r = await pending;
  assert.equal(r.counts.satisfied, 6);
});
test("no implicit network retrieval", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected retrieval");
    };
    const r = await run(input(), {});
    assert.equal(r.validation.success, false);
    assert.equal(row(r, "report_integrity").status, "missing");
  } finally {
    globalThis.fetch = old;
  }
});

test("shifted timing fails consistency and blocks dependent phases", async () => {
  const r = await run(fixture("shifted interval"));
  assert.equal(row(r, "input_consistency").status, "failed");
  assert.equal(row(r, "reviewed_context").status, "not_checked");
  assert.match(
    r.actions.find((a) => a.code === "RESEARCH.NOMINAL_ENCLOSURE").nextAction,
    /do not shift/
  );
});

test("unavailable hashing leaves byte verification unchecked", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    const r = await run();
    for (const id of [
      "assessment_documentation",
      "measurement_acquisition",
      "report_integrity",
    ])
      assert.equal(row(r, id).status, "not_checked");
    assert.ok(r.actions.some((a) => a.code === "RESEARCH.HASH_UNAVAILABLE"));
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
