import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeClaimHistory,
  ASSESSMENT_SUMMARY_POLICY,
} from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const base = JSON.parse(
  readFileSync(new URL("../examples/v2/claim-history.json", import.meta.url))
);
const fixture = () => structuredClone(base);
function assessment(id, changes = {}) {
  const a = structuredClone(base.claims[2]);
  delete a.supersedes;
  return { ...a, id, ...changes };
}
const group = (r) =>
  r.groups.find(
    (g) =>
      g.topic === "synthetic radial motion" && g.subject.kind === "measurement"
  );
const check = (v) => {
  const r = summarizeClaimHistory(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  return r;
};
test("synthetic history preserves declarations and policy scope", () => {
  const r = check(fixture());
  assert.equal(r.policy.version, "0.1.0");
  assert.deepEqual(r.policy, ASSESSMENT_SUMMARY_POLICY);
  assert.deepEqual(r.supersededClaimRefs, ["claim:review-1"]);
  assert.equal(group(r).sourceAssertions.length, 1);
  assert.equal(group(r).unassessed.length, 0);
  assert.deepEqual(group(r).declaredOutcomes, ["inconclusive"]);
  for (const key of [
    "scientificEligibility",
    "artifactIntegrity",
    "vocabularyMembership",
    "statisticalIndependence",
    "reproducibility",
  ])
    assert.equal(r[key], "not_checked");
  assert.equal(r.checks.profile, "not_checked");
  assert.equal("score" in r, false);
});
test("missing confidence stays omitted and zero remains zero", () => {
  const v = fixture();
  v.claims.push(assessment("zero", { confidence: 0 }));
  const g = group(check(v));
  assert.equal(
    g.assessments.find((a) => a.claimRefs.includes("claim:review-2"))
      .declaration.confidence,
    undefined
  );
  assert.equal(
    g.assessments.find((a) => a.claimRefs.includes("claim:zero")).declaration
      .confidence,
    0
  );
});
test("identical declarations collapse; repeated copies do not change outcomes or become shared votes", () => {
  const v = fixture(),
    before = group(check(v));
  v.claims.push(
    assessment("duplicate", { recordedAt: "2026-09-07T01:00:00Z" })
  );
  const r = check(v),
    after = group(r);
  assert.equal(after.assessments.length, 1);
  assert.deepEqual(after.declaredOutcomes, before.declaredOutcomes);
  assert.equal(after.disagreement, before.disagreement);
  assert.deepEqual(after.assessments[0].claimRefs, [
    "claim:duplicate",
    "claim:review-2",
  ]);
  assert.equal(r.sharedInputs.length, 0);
});
test("input reference order does not prevent deduplication", () => {
  const v = fixture();
  v.claims.push(
    assessment("copy", { inputRefs: [...v.claims[2].inputRefs].reverse() })
  );
  assert.equal(group(check(v)).assessments.length, 1);
});
for (const [key, value] of [
  ["evaluatedBy", "person:another"],
  ["evaluatedAt", "2026-09-06T23:00:00Z"],
  ["rationale", "A different explanation."],
  ["confidence", 0.5],
  ["outcome", "confirmed"],
  ["inputRefs", ["source:s1"]],
])
  test(`different ${key} is not silently deduplicated`, () => {
    const v = fixture();
    v.claims.push(assessment("different", { [key]: value }));
    assert.equal(group(check(v)).assessments.length, 2);
  });
test("superseded confirmed declarations do not remain current", () => {
  const v = fixture();
  v.claims[2].outcome = "confirmed";
  v.claims.push(
    assessment("revision", {
      outcome: "absent",
      supersedes: ["claim:review-2"],
    })
  );
  const r = check(v);
  assert.deepEqual(group(r).declaredOutcomes, ["absent"]);
  assert.ok(r.supersededClaimRefs.includes("claim:review-2"));
});
test("both branches of a revision remain visible", () => {
  const v = fixture();
  v.claims.push(
    assessment("branch-a", {
      supersedes: ["claim:review-2"],
      outcome: "confirmed",
    }),
    assessment("branch-b", {
      supersedes: ["claim:review-2"],
      outcome: "absent",
    })
  );
  const g = group(check(v));
  assert.deepEqual(g.declaredOutcomes, ["absent", "confirmed"]);
  assert.equal(g.disagreement, "multiple_declared_outcomes");
  assert.equal("confidenceInterval" in g, false);
});
test("unassessed and absent are distinct", () => {
  const v = fixture();
  v.claims = [v.claims[0], v.claims[1]];
  const g = group(check(v));
  assert.equal(g.unassessed.length, 1);
  assert.equal(g.disagreement, "not_assessed");
  assert.deepEqual(g.declaredOutcomes, []);
  v.claims.push(assessment("negative", { outcome: "absent" }));
  assert.deepEqual(group(check(v)).declaredOutcomes, ["absent"]);
});
test("a source calling something confirmed never becomes a confirmed assessment", () => {
  const v = fixture();
  v.claims = [v.claims[0]];
  const g = group(check(v));
  assert.equal(g.sourceAssertions[0].declaration.reportedLevel, "confirmed");
  assert.deepEqual(g.declaredOutcomes, []);
  assert.equal(g.disagreement, "not_assessed");
});
test("duplicate source assertions and unassessed entries collapse separately", () => {
  const v = fixture();
  v.claims = [
    v.claims[0],
    v.claims[1],
    { ...v.claims[0], id: "copy-source" },
    { ...v.claims[1], id: "copy-unassessed" },
  ];
  const g = group(check(v));
  assert.equal(g.sourceAssertions.length, 1);
  assert.equal(g.unassessed.length, 1);
  assert.equal(g.assessments.length, 0);
});
test("origin-topic labels cannot boost or suppress another topic", () => {
  const v = fixture(),
    before = group(check(v));
  v.claims.push(
    assessment("origin", { topic: "origin:hoax", outcome: "confirmed" }),
    assessment("biology", { topic: "biologics", status: "unassessed" })
  );
  const biology = v.claims.at(-1);
  for (const k of [
    "outcome",
    "evaluatedAt",
    "evaluatedBy",
    "methodRef",
    "methodVersion",
  ])
    delete biology[k];
  assert.deepEqual(group(check(v)), before);
});
test("different subjects never share an outcome group", () => {
  const v = fixture();
  v.claims.push(
    assessment("observation", {
      subject: { kind: "observation" },
      outcome: "confirmed",
    })
  );
  const r = check(v);
  assert.equal(r.groups.length, 2);
  assert.deepEqual(group(r).declaredOutcomes, ["inconclusive"]);
});
test("shared direct inputs are disclosed across distinct evaluators", () => {
  const v = fixture();
  v.claims.push(assessment("other", { evaluatedBy: "person:other" }));
  const r = check(v);
  assert.ok(
    r.sharedInputs.some(
      (s) => s.ref === "measurement:velocity" && s.assessmentRefs.length === 2
    )
  );
});
test("shared processing and source lineage is followed transitively", () => {
  const v = fixture();
  v.claims = [
    assessment("one", { inputRefs: ["measurement:velocity"] }),
    assessment("two", {
      inputRefs: ["source:s1"],
      evaluatedBy: "person:other",
    }),
  ];
  const r = check(v);
  assert.ok(r.sharedInputs.some((s) => s.ref === "source:s1"));
  assert.ok(
    r.groups[0].assessments.some((a) =>
      a.lineageRefs.includes("process:reduce")
    )
  );
});
test("uncertainty annotations do not create primary support", () => {
  const v = fixture();
  v.claims = [
    assessment("one", { inputRefs: ["measurement:velocity"] }),
    assessment("two", {
      inputRefs: ["source:s2"],
      evaluatedBy: "person:other",
    }),
  ];
  v.observation.measurements[0].value.uncertainty.sourceRefs = ["source:s2"];
  v.observation.assertions.find(
    (a) => a.id === "velocity-a"
  ).value.uncertainty.sourceRefs = ["source:s2"];
  assert.equal(
    check(v).sharedInputs.some((s) => s.ref === "source:s2"),
    false
  );
});
test("supersession is not a support edge", () => {
  const v = fixture();
  v.claims = [
    assessment("previous", { inputRefs: ["source:s2"] }),
    assessment("revision", {
      inputRefs: ["source:s1"],
      supersedes: ["claim:previous"],
    }),
    assessment("other", {
      inputRefs: ["source:s2"],
      evaluatedBy: "person:other",
    }),
  ];
  assert.equal(
    check(v).sharedInputs.some((s) => s.ref === "source:s2"),
    false
  );
});
test("explicit support through a superseded claim is retained, without making it current", () => {
  const v = fixture();
  v.claims = [
    assessment("previous", { inputRefs: ["source:s2"] }),
    assessment("revision", {
      inputRefs: ["source:s1"],
      supersedes: ["claim:previous"],
    }),
    assessment("other", {
      inputRefs: ["claim:previous"],
      evaluatedBy: "person:other",
    }),
  ];
  const r = check(v);
  assert.ok(r.supersededClaimRefs.includes("claim:previous"));
  assert.ok(
    r.groups[0].assessments.some((a) => a.lineageRefs.includes("source:s2"))
  );
});
test("same declared digest across aliases discloses dependence without verification", () => {
  const v = fixture();
  for (const s of v.observation.sources)
    s.digest = { algorithm: "sha256", value: "a".repeat(64) };
  v.claims = [
    assessment("one", { inputRefs: ["source:s1"] }),
    assessment("two", {
      inputRefs: ["source:s2"],
      evaluatedBy: "person:other",
    }),
  ];
  const r = check(v);
  assert.equal(r.sharedInputs.length, 0);
  assert.deepEqual(r.sharedDeclaredArtifacts[0].artifactRefs, [
    "source:s1",
    "source:s2",
  ]);
  assert.equal(r.artifactIntegrity, "not_checked");
});
test("shared inputs span topics without combining their outcomes", () => {
  const v = fixture();
  v.claims.push(
    assessment("other-topic", { topic: "another topic", outcome: "absent" })
  );
  const r = check(v);
  assert.ok(r.sharedInputs.length > 0);
  assert.deepEqual(group(r).declaredOutcomes, ["inconclusive"]);
});
test("unsupported confirmed statement remains declared, with empty support", () => {
  const v = fixture();
  v.claims = [
    assessment("unsupported", { outcome: "confirmed", inputRefs: [] }),
  ];
  const r = check(v);
  assert.deepEqual(r.groups[0].assessments[0].lineageRefs, []);
  assert.equal(r.scientificEligibility, "not_checked");
});
test("no claims means no assessment rather than a zero grade", () => {
  const v = fixture();
  v.claims = [];
  const r = check(v);
  assert.deepEqual(r.groups, []);
  assert.equal("grade" in r, false);
});
test("valid results are order invariant and input is not mutated", () => {
  const v = fixture();
  v.claims.push(
    assessment("other", { evaluatedBy: "person:other", outcome: "confirmed" })
  );
  const original = structuredClone(v),
    a = check(v);
  assert.deepEqual(v, original);
  v.claims.reverse();
  for (const c of v.claims) if (c.inputRefs) c.inputRefs.reverse();
  v.observation.sources.reverse();
  assert.deepEqual(check(v), a);
});
for (const [name, mutate] of [
  ["duplicate ID", (v) => v.claims.push({ ...v.claims[2] })],
  ["dangling reference", (v) => (v.claims[2].inputRefs = ["source:missing"])],
  ["invalid date", (v) => (v.claims[2].evaluatedAt = "2026-02-30T00:00:00Z")],
  ["cycle", (v) => (v.claims[2].inputRefs = ["claim:review-2"])],
  ["structural field", (v) => (v.claims[2].score = 100)],
])
  test(`parser parity: ${name}`, () => {
    const v = fixture();
    mutate(v);
    const expected = parseExperimentalClaimHistory(v),
      r = summarizeClaimHistory(v);
    assert.equal(r.success, false);
    assert.deepEqual(r.issues, expected.issues);
    assert.deepEqual(r.checks, expected.checks);
    assert.deepEqual(r.groups, []);
  });
test("long support chain uses iterative traversal", () => {
  const v = fixture();
  v.claims = [];
  for (let i = 0; i < 1500; i++)
    v.claims.push(
      assessment(`chain-${i}`, {
        inputRefs: i ? [`claim:chain-${i - 1}`] : ["source:s1"],
        ...(i ? { supersedes: [`claim:chain-${i - 1}`] } : {}),
      })
    );
  const r = check(v);
  assert.equal(r.groups[0].assessments.length, 1);
  assert.equal(r.groups[0].assessments[0].lineageRefs.length, 1500);
});
test("summary does not fetch declarations or execute methods", () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("network forbidden");
  };
  try {
    check(fixture());
  } finally {
    globalThis.fetch = fetch;
  }
});
