import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ProviderScorePolicySchema,
  ProviderScoreResultSchema,
  providerScorePolicyJsonSchema,
  providerScoreResultJsonSchema,
  validateProviderScorePolicy,
  evaluateProviderScore,
  compareProviderScores,
  providerScoreGrade,
} from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";

const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
const bytes = (value) => Buffer.from(JSON.stringify(value));
function fixture() {
  const method = bytes({
    rule: "A reviewer assigns coverage points; this fixture does not calculate them.",
  });
  const input = bytes({ id: "case-1", source: "synthetic" });
  const derivation = bytes({ reasons: "Declared documentation review" });
  const policy = {
    kind: "provider_score_policy",
    schemaVersion: "0.1.0",
    id: "urn:example:coverage",
    version: "1.0.0",
    title: "Example coverage",
    metric: {
      id: "coverage",
      label: "Coverage",
      question: "How much documentation was retained?",
    },
    subjectKinds: ["case"],
    method: {
      description: "Inspect the retained record.",
      artifacts: [
        {
          ref: "method",
          id: "urn:example:method",
          version: "1.0.0",
          mediaType: "application/json",
          ...pin(method),
        },
      ],
    },
    applicability: "Synthetic case records.",
    missingData: {
      handling: "withhold",
      description: "Required inputs must be present.",
    },
    limitations: ["No anomaly judgment."],
    scale: {
      kind: "numeric",
      min: 0,
      max: 100,
      direction: "higher",
      unit: "points",
      grades: [
        { id: "c", label: "C", min: 0, max: 50 },
        { id: "b", label: "B", min: 50, max: 80 },
        { id: "a", label: "A", min: 80, max: 100 },
      ],
    },
  };
  const policyBytes = bytes(policy);
  const result = {
    kind: "provider_score_result",
    schemaVersion: "0.1.0",
    id: "review-1",
    provider: { id: "urn:provider:one", name: "Fictional reviewer" },
    producedAt: "2026-10-13T12:00:00Z",
    policy: { id: policy.id, version: policy.version, ...pin(policyBytes) },
    subject: { kind: "case", id: "case-1" },
    inputScope: { id: "case-snapshot", description: "Retained case record" },
    inputs: [
      {
        ref: "case",
        title: "Case snapshot",
        mediaType: "application/json",
        ...pin(input),
      },
    ],
    derivation: [
      {
        ref: "worksheet",
        title: "Review worksheet",
        mediaType: "application/json",
        ...pin(derivation),
      },
    ],
    applicability: {
      status: "applicable",
      reason: "The case meets the scope.",
    },
    missingInputs: [],
    limitations: ["Synthetic fixture."],
    outcome: {
      status: "scored",
      value: 75,
      gradeId: "b",
      explanation: "A declared review result.",
    },
  };
  return {
    policy,
    result,
    options: {
      policyBytes,
      methodFiles: new Map([["method", method]]),
      inputFiles: new Map([["case", input]]),
      derivationFiles: new Map([["worksheet", derivation]]),
    },
  };
}
function setPolicy(f) {
  f.options.policyBytes = bytes(f.policy);
  f.result.policy = {
    id: f.policy.id,
    version: f.policy.version,
    ...pin(f.options.policyBytes),
  };
  return f;
}
const evaluate = (f) => evaluateProviderScore(f.result, f.options);

test("a verified declaration retains all evaluation boundaries and never executes the method", async () => {
  const f = fixture(),
    before = structuredClone(f),
    evaluation = await evaluate(f);
  assert.equal(evaluation.success, true);
  assert.deepEqual(evaluation.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
  });
  assert.deepEqual(evaluation.grade, { id: "b", label: "B" });
  for (const key of [
    "policyExecution",
    "providerAuthentication",
    "scientificValidity",
    "subjectResolution",
  ])
    assert.equal(evaluation[key], "not_checked");
  assert.equal("computedScore" in evaluation, false);
  assert.deepEqual(structuredClone(f), before);
});

test("zero is a valid score while unavailable has no score or grade", async () => {
  const f = fixture();
  f.result.outcome = {
    status: "scored",
    value: 0,
    gradeId: "c",
    explanation: "Zero assigned.",
  };
  assert.equal((await evaluate(f)).success, true);
  f.result.outcome = {
    status: "unavailable",
    reasonCode: "not_calculated",
    explanation: "No review yet.",
  };
  const unavailable = await evaluate(f);
  assert.equal(unavailable.success, true);
  assert.equal(unavailable.grade, null);
  assert.equal("value" in unavailable.result.outcome, false);
  f.result.outcome.value = 0;
  assert.equal((await evaluate(f)).checks.structural, "failed");
});

test("grade boundaries are deterministic including both scale endpoints", () => {
  const { policy } = fixture();
  for (const [value, expected] of [
    [0, "c"],
    [49.999, "c"],
    [50, "b"],
    [79.999, "b"],
    [80, "a"],
    [100, "a"],
  ])
    assert.equal(providerScoreGrade(policy, value).id, expected);
  assert.equal(providerScoreGrade(policy, 101), null);
});

for (const [name, edit] of [
  ["overlap", (s) => (s.grades[1].min = 49)],
  ["gap", (s) => (s.grades[1].min = 51)],
  ["empty band", (s) => (s.grades[1].max = 50)],
  ["outside scale", (s) => (s.grades[2].max = 101)],
  ["uncovered start", (s) => (s.grades[0].min = 1)],
  ["uncovered end", (s) => (s.grades[2].max = 99)],
  ["duplicate grade", (s) => (s.grades[1].id = "c")],
  ["reversed scale", (s) => (s.min = 101)],
])
  test(`invalid policy: ${name}`, async () => {
    const f = fixture();
    edit(f.policy.scale);
    setPolicy(f);
    assert.equal(validateProviderScorePolicy(f.policy).success, false);
    assert.equal((await evaluate(f)).success, false);
  });

for (const [name, edit] of [
  ["above bound", (r) => (r.outcome.value = 101)],
  ["below bound", (r) => (r.outcome.value = -1)],
  ["wrong value type", (r) => (r.outcome.value = "b")],
  ["wrong grade", (r) => (r.outcome.gradeId = "a")],
  ["duplicate input", (r) => r.inputs.push({ ...r.inputs[0] })],
  ["duplicate derivation", (r) => (r.derivation[0].ref = "case")],
  [
    "contradictory missing input",
    (r) =>
      r.missingInputs.push({ ref: "case", description: "Claimed missing" }),
  ],
  ["wrong policy identity", (r) => (r.policy.id = "urn:different")],
  ["wrong policy revision", (r) => (r.policy.version = "2")],
  [
    "inapplicable scored result",
    (r) => (r.applicability.status = "not_applicable"),
  ],
  [
    "unresolved applicability",
    (r) => (r.applicability.status = "undetermined"),
  ],
  ["unsupported subject kind", (r) => (r.subject.kind = "claim")],
  [
    "withheld score with missing input",
    (r) =>
      r.missingInputs.push({ ref: "absent", description: "Missing source" }),
  ],
  [
    "missing input reason without missing input",
    (r) =>
      (r.outcome = {
        status: "unavailable",
        reasonCode: "missing_inputs",
        explanation: "Incomplete",
      }),
  ],
])
  test(`invalid declaration: ${name}`, async () => {
    const f = fixture();
    edit(f.result);
    assert.equal((await evaluate(f)).checks.semantic, "failed");
  });

for (const role of ["policy", "method", "input", "derivation"])
  for (const mode of ["missing", "changed", "length"])
    test(`${mode} ${role} bytes block verification`, async () => {
      const f = fixture();
      const key = {
        policy: "policyBytes",
        method: "methodFiles",
        input: "inputFiles",
        derivation: "derivationFiles",
      }[role];
      if (mode === "missing") delete f.options[key];
      else if (role === "policy")
        f.options.policyBytes =
          mode === "length"
            ? Buffer.from("x")
            : Buffer.from(f.options.policyBytes).fill(32);
      else {
        const [ref, old] = [...f.options[key]][0];
        f.options[key].set(
          ref,
          mode === "length" ? Buffer.from("x") : Buffer.from(old).fill(32)
        );
      }
      const evaluation = await evaluate(f);
      assert.equal(evaluation.success, false);
      assert.equal(
        evaluation.checks.external,
        mode === "missing" ? "not_checked" : "failed"
      );
    });

test("ordinal policies preserve explicit labels without inventing numeric distances", async () => {
  const f = fixture();
  f.policy.scale = {
    kind: "ordinal",
    direction: "higher",
    levels: [
      { id: "limited", label: "Limited", description: "Little documentation" },
      {
        id: "extensive",
        label: "Extensive",
        description: "More documentation",
      },
    ],
  };
  f.result.outcome = {
    status: "scored",
    value: "extensive",
    explanation: "Reviewer selected the level",
  };
  setPolicy(f);
  assert.equal((await evaluate(f)).success, true);
  assert.deepEqual((await evaluate(f)).grade, {
    id: "extensive",
    label: "Extensive",
  });
  f.result.outcome.value = 1;
  assert.equal((await evaluate(f)).success, false);
  f.policy.scale.levels[1].id = "limited";
  assert.equal(validateProviderScorePolicy(f.policy).success, false);
});

test("missing inputs may be declared without substituting zero, and partial results require policy permission", async () => {
  const f = fixture();
  f.result.missingInputs = [
    { ref: "timing", description: "Timing table not supplied" },
  ];
  f.result.outcome = {
    status: "unavailable",
    reasonCode: "missing_inputs",
    explanation: "The required timing is absent",
  };
  assert.equal((await evaluate(f)).success, true);
  f.policy.missingData.handling = "allow_partial";
  setPolicy(f);
  f.result.outcome = {
    status: "scored",
    value: 25,
    explanation: "Partial coverage",
  };
  assert.equal((await evaluate(f)).success, true);
  assert.equal(
    (
      await compareProviderScores(f.result, f.result, {
        left: f.options,
        right: f.options,
      })
    ).eligibleForComparison,
    false
  );
});

test("same method and common inputs permit inspecting differing provider results without merging", async () => {
  const left = fixture(),
    right = fixture();
  right.result.id = "review-2";
  right.result.provider = {
    id: "urn:provider:two",
    name: "Other fictional reviewer",
  };
  right.result.outcome = {
    status: "scored",
    value: 45,
    explanation: "Different documented review",
  };
  const review = bytes({ reason: "Another reviewer reached another result" });
  Object.assign(right.result.derivation[0], pin(review));
  right.options.derivationFiles.set("worksheet", review);
  const comparison = await compareProviderScores(left.result, right.result, {
    left: left.options,
    right: right.options,
  });
  assert.equal(comparison.status, "eligible_for_comparison");
  assert.equal(comparison.left.result.outcome.value, 75);
  assert.equal(comparison.right.result.outcome.value, 45);
  assert.equal(comparison.sharedInputDigests.length, 1);
  assert.equal(comparison.statisticalIndependence, "not_checked");
  assert.equal("winner" in comparison, false);
  assert.equal("average" in comparison, false);
});

for (const [name, edit, reason] of [
  [
    "policy despite equal scale",
    (f) => {
      f.policy.method.description += " Different rule";
      setPolicy(f);
    },
    "different_policy",
  ],
  ["subject", (f) => (f.result.subject.id = "other"), "different_subject"],
  ["scope", (f) => (f.result.inputScope.id = "other"), "different_input_scope"],
  [
    "scope description",
    (f) => (f.result.inputScope.description = "Another scope"),
    "different_input_scope",
  ],
  [
    "evidence",
    (f) => {
      const changed = bytes({ id: "case-1", revision: 2 });
      Object.assign(f.result.inputs[0], pin(changed));
      f.options.inputFiles.set("case", changed);
    },
    "different_inputs",
  ],
  [
    "unavailable",
    (f) =>
      (f.result.outcome = {
        status: "unavailable",
        reasonCode: "not_calculated",
        explanation: "Not reviewed",
      }),
    "unavailable_result",
  ],
  ["unverified", (f) => f.options.inputFiles.clear(), "unverified_result"],
])
  test(`comparison blocks different ${name}`, async () => {
    const left = fixture(),
      right = fixture();
    edit(right);
    const comparison = await compareProviderScores(left.result, right.result, {
      left: left.options,
      right: right.options,
    });
    assert.equal(comparison.eligibleForComparison, false);
    assert.ok(comparison.reasons.includes(reason));
  });

test("portable JSON Schema artifacts match exports and reject structural corruptions", () => {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const f = fixture();
  for (const [name, getter, schema, value] of [
    [
      "provider-score-policy",
      providerScorePolicyJsonSchema,
      ProviderScorePolicySchema,
      f.policy,
    ],
    [
      "provider-score-result",
      providerScoreResultJsonSchema,
      ProviderScoreResultSchema,
      f.result,
    ],
  ]) {
    const expected = getter();
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-scoring/schema/experimental/${name}-0.1.0.schema.json`,
            import.meta.url
          )
        )
      ),
      expected
    );
    const validate = ajv.compile(expected);
    assert.equal(validate(value), true);
    assert.equal(schema.safeParse(value).success, true);
    const bad = structuredClone(value);
    bad.unrecognized = true;
    assert.equal(validate(bad), false);
    assert.equal(schema.safeParse(bad).success, false);
  }
});

test("non-JSON, BOM and invalid UTF-8 policies are rejected without executing content", async () => {
  for (const bad of [
    Buffer.from("import('node:fs')"),
    Buffer.from("\uFEFF{}"),
    Buffer.from([255]),
  ]) {
    const f = fixture();
    f.options.policyBytes = bad;
    Object.assign(f.result.policy, pin(bad));
    assert.equal((await evaluate(f)).checks.structural, "failed");
  }
});

test("provider URL cannot contain an executable or non-web scheme", () => {
  const f = fixture();
  for (const url of [
    "javascript:alert(1)",
    "data:text/plain,test",
    "file:///tmp/provider",
    "ftp://example.org",
  ]) {
    f.result.provider.url = url;
    assert.equal(ProviderScoreResultSchema.safeParse(f.result).success, false);
  }
  f.result.provider.url = "https://example.org";
  assert.equal(ProviderScoreResultSchema.safeParse(f.result).success, true);
});

test("a missing pin is invalid structure, not an unchecked file", async () => {
  for (const target of ["policy", "input", "derivation"]) {
    const f = fixture();
    const entry =
      target === "policy"
        ? f.result.policy
        : target === "input"
        ? f.result.inputs[0]
        : f.result.derivation[0];
    delete entry.sha256;
    assert.equal((await evaluate(f)).checks.structural, "failed");
  }
  const f = fixture();
  delete f.policy.method.artifacts[0].sha256;
  assert.equal(
    validateProviderScorePolicy(f.policy).checks.structural,
    "failed"
  );
});

test("unavailable hashing remains explicitly unchecked", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      subtle: {
        digest: async () => {
          throw new Error("unavailable");
        },
      },
    },
  });
  try {
    const evaluation = await evaluate(fixture());
    assert.equal(evaluation.success, false);
    assert.equal(evaluation.checks.external, "not_checked");
    assert.ok(
      evaluation.issues.some(
        (entry) => entry.code === "PROVIDER_SCORE.HASH_UNAVAILABLE"
      )
    );
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

test("evaluation snapshots declarations and all supplied byte arrays before asynchronous checks", async () => {
  const f = fixture();
  const pending = evaluate(f);
  f.result.outcome.value = 999;
  f.options.policyBytes.fill(0);
  f.options.methodFiles.get("method").fill(0);
  f.options.inputFiles.get("case").fill(0);
  f.options.derivationFiles.get("worksheet").fill(0);
  assert.equal((await pending).success, true);
});
