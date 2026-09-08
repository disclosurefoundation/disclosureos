import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateAssessmentSummaryEvaluation as evaluate,
  summarizeClaimHistory,
  AssessmentSummaryEvaluationSchema,
  assessmentSummaryEvaluationJsonSchema,
} from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";
import {
  summaryEvaluationExample as example,
  pin,
} from "../examples/v2/summary-evaluation-demo.mjs";
import { replayAssessmentSummary } from "../scripts/replay-assessment-summary.mjs";
const verifier = new URL(
  "../scripts/verify-research-receipt.py",
  import.meta.url
).pathname;
const run = (v = example()) => evaluate(v.manifest, v.options);
function history(v, h) {
  v.options.historyBytes = new TextEncoder().encode(JSON.stringify(h));
  v.manifest.history = pin(v.options.historyBytes);
  return v;
}
const corpus = JSON.parse(
  readFileSync(new URL("./v2-claim-history-fixtures.json", import.meta.url))
);
for (const fixture of corpus.cases)
  test("summary provenance preserves corpus: " + fixture.id, async () => {
    const h = structuredClone(corpus.bases[fixture.base]);
    for (const c of fixture.changes) {
      let t = h;
      for (const k of c.path.slice(0, -1)) t = t[k];
      const k = c.path.at(-1);
      if (c.op === "remove") delete t[k];
      else if (c.op === "append") t[k].push(structuredClone(c.value));
      else
        Object.defineProperty(t, k, {
          value: structuredClone(c.value),
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
    const v = history(example(), h),
      before = structuredClone(v),
      r = await run(v);
    assert.deepEqual(r.summary, summarizeClaimHistory(h));
    assert.ok(r.receipt);
    assert.equal(r.success, r.summary.success);
    assert.deepEqual(v, before);
  });
test("receipt hashes exact strings and preserves summary limits", async () => {
  const v = example(),
    r = await run(v);
  assert.equal(r.success, true);
  for (const name of ["request", "output"])
    assert.deepEqual(
      pin(Buffer.from(r.receipt[name + "Json"])),
      r.receipt[name]
    );
  assert.deepEqual(JSON.parse(r.receipt.outputJson), { summary: r.summary });
  const request = JSON.parse(r.receipt.requestJson);
  assert.deepEqual(request.manifest, v.manifest);
  assert.equal(request.rules.summary.id, r.summary.policy.id);
  for (const k of [
    "sourceArtifactIntegrity",
    "vocabularyMembership",
    "scientificEligibility",
    "statisticalIndependence",
  ])
    assert.equal(r[k], "not_checked");
  assert.equal(r.summary.artifactIntegrity, "not_checked");
  assert.equal(r.summary.reproducibility, "not_checked");
  assert.equal("score" in r.summary, false);
});
test("same bytes and reordered manifest object keys produce identical receipts", async () => {
  const v = example(),
    a = await run(v);
  v.manifest = Object.fromEntries(Object.entries(v.manifest).reverse());
  assert.deepEqual((await run(v)).receipt, a.receipt);
});
test("history byte formatting changes request pin without changing declarations", async () => {
  const v = example(),
    a = await run(v),
    h = JSON.parse(Buffer.from(v.options.historyBytes));
  v.options.historyBytes = new TextEncoder().encode(JSON.stringify(h));
  v.manifest.history = pin(v.options.historyBytes);
  const b = await run(v);
  assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
  assert.deepEqual(a.summary, b.summary);
});
test("changed declarations change both receipt identities", async () => {
  const v = example(),
    a = await run(v),
    h = JSON.parse(Buffer.from(v.options.historyBytes));
  h.claims[0].text += " changed";
  history(v, h);
  const b = await run(v);
  assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
  assert.notEqual(a.receipt.output.sha256, b.receipt.output.sha256);
});
for (const role of ["vocabularies", "implementation", "environment"])
  test("changed dependency version: " + role, async () => {
    const v = example(),
      a = await run(v);
    (role === "vocabularies"
      ? v.manifest.dependencies[role][0]
      : v.manifest.dependencies[role]
    ).version = "changed";
    const b = await run(v);
    assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
    assert.deepEqual(a.summary, b.summary);
  });
for (const ref of ["history", "vocabulary", "implementation", "environment"])
  for (const mode of ["missing", "size", "digest"])
    test(mode + " " + ref + " blocks receipt", async () => {
      const v = example();
      if (ref === "history") {
        if (mode === "missing") delete v.options.historyBytes;
        else if (mode === "size") v.options.historyBytes = new Uint8Array();
        else v.options.historyBytes[0] ^= 1;
      } else {
        if (mode === "missing") v.options.dependencyFiles.delete(ref);
        else if (mode === "size")
          v.options.dependencyFiles.set(ref, new Uint8Array());
        else v.options.dependencyFiles.get(ref)[0] ^= 1;
      }
      const r = await run(v);
      assert.equal(r.receipt, null);
      assert.equal(r.summary, null);
      assert.equal(
        r.checks.external,
        mode === "missing" ? "not_checked" : "failed"
      );
    });
for (const [name, edit] of [
  ["custom workflow", (v) => (v.workflow = "callback")],
  ["injected output", (v) => (v.output = { success: true })],
  ["empty vocabularies", (v) => (v.dependencies.vocabularies = [])],
  ["missing version", (v) => delete v.dependencies.implementation.version],
  [
    "duplicate refs",
    (v) => (v.dependencies.environment.ref = "implementation"),
  ],
  [
    "duplicate vocabulary identity",
    (v) =>
      v.dependencies.vocabularies.push({
        ...v.dependencies.vocabularies[0],
        ref: "other",
      }),
  ],
])
  test("rejects " + name, async () => {
    const v = example();
    edit(v.manifest);
    const r = await run(v);
    assert.equal(r.receipt, null);
    assert.ok(r.issues.length);
  });
test("invalid JSON, BOM and invalid UTF-8 cannot be receipted", async () => {
  for (const bytes of [
    Buffer.from("no JSON"),
    Buffer.from("\uFEFF{}"),
    Buffer.from([255]),
  ]) {
    const v = example();
    v.options.historyBytes = bytes;
    v.manifest.history = pin(bytes);
    const r = await run(v);
    assert.equal(r.receipt, null);
    assert.equal(r.checks.external, "passed");
    assert.ok(r.issues.some((i) => i.code === "SUMMARY_EVALUATION.JSON"));
  }
});
test("caller bytes and manifest are snapshotted before hashing", async () => {
  const v = example(),
    a = await run(v),
    pending = run(v);
  v.manifest.dependencies.vocabularies = [];
  v.options.historyBytes.fill(0);
  for (const b of v.options.dependencyFiles.values()) b.fill(0);
  assert.deepEqual((await pending).receipt, a.receipt);
});
test("unavailable hashing stays unchecked, final hash failure preserves summary", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    original = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const r = await run();
    assert.equal(r.receipt, null);
    assert.equal(r.checks.external, "not_checked");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: (a, b) =>
            new TextDecoder().decode(b).startsWith('{"limits":')
              ? Promise.reject(Error("receipt hashing failed"))
              : original.subtle.digest(a, b),
        },
      },
    });
    const final = await run();
    assert.equal(final.summary.success, true);
    assert.equal(final.receipt, null);
    assert.equal(final.success, false);
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
test("no network retrieval or automatic source verification", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    const r = await run();
    assert.equal(r.success, true);
    assert.equal(r.sourceArtifactIntegrity, "not_checked");
  } finally {
    globalThis.fetch = old;
  }
});
test("committed schema, runtime and independent validator agree", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-scoring/schema/experimental/assessment-summary-evaluation-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, assessmentSummaryEvaluationJsonSchema());
  const validate = new Ajv2020({ strict: false }).compile(schema);
  for (const edit of [
    (v) => {},
    (v) => (v.kind = "bad"),
    (v) => (v.history.byteLength = 0),
    (v) => (v.dependencies.vocabularies = []),
    (v) => (v.history.sha256 = "x"),
    (v) => (v.workflow = "other"),
    (v) => (v.extra = true),
  ]) {
    const v = example().manifest;
    edit(v);
    assert.equal(
      validate(v),
      AssessmentSummaryEvaluationSchema.safeParse(v).success
    );
  }
});
async function bundle(fn, edit = () => {}) {
  const v = example();
  edit(v);
  const r = await run(v);
  assert.ok(r.receipt);
  const root = mkdtempSync(join(tmpdir(), "disclosureos-summary-"));
  try {
    mkdirSync(join(root, "dependencies"));
    writeFileSync(join(root, "receipt.json"), JSON.stringify(r.receipt));
    writeFileSync(join(root, "history.json"), v.options.historyBytes);
    for (const [ref, bytes] of v.options.dependencyFiles)
      writeFileSync(join(root, "dependencies", ref), bytes);
    await fn(root, r.receipt);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("independent Python and local replay agree on the saved summary", () =>
  bundle(async (root, r) => {
    const p = spawnSync("python3", [verifier, join(root, "receipt.json")], {
      encoding: "utf8",
    });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    assert.equal(JSON.parse(p.stdout).evaluationSemantics, "not_checked");
    const replay = await replayAssessmentSummary(root);
    assert.equal(replay.success, true);
    assert.equal(replay.summarySuccess, true);
    assert.equal(replay.limits.sourceArtifactIntegrity, "not_checked");
  }));
test("invalid history replays as a recorded failure without becoming valid", () =>
  bundle(
    async (root) => {
      const r = await replayAssessmentSummary(root);
      assert.equal(r.success, true);
      assert.equal(r.summaryStatus, "failed");
      assert.equal(r.summarySuccess, false);
    },
    (v) => history(v, {})
  ));
test("rehashed fabricated output cannot pass replay", () =>
  bundle(async (root, r) => {
    const output = JSON.parse(r.outputJson);
    output.summary.success = false;
    r.outputJson = JSON.stringify(output);
    r.output = pin(Buffer.from(r.outputJson));
    writeFileSync(join(root, "receipt.json"), JSON.stringify(r));
    assert.equal(
      spawnSync("python3", [verifier, join(root, "receipt.json")]).status,
      0
    );
    const replay = await replayAssessmentSummary(root);
    assert.equal(replay.success, false);
    assert.equal(replay.checks.outputReplay, "failed");
  }));
for (const path of ["history.json", "dependencies/vocabulary"])
  for (const mode of ["missing", "corrupt", "symlink"])
    test("replay rejects " + mode + " " + path, () =>
      bundle(async (root) => {
        const f = join(root, path);
        if (mode === "corrupt") writeFileSync(f, "bad");
        else {
          rmSync(f);
          if (mode === "symlink") symlinkSync(join(root, "receipt.json"), f);
        }
        assert.equal((await replayAssessmentSummary(root)).success, false);
      })
    );
test("summary export and real replay CLI work and refuse overwrite", async () => {
  const parent = mkdtempSync(join(tmpdir(), "disclosureos-summary-export-"));
  try {
    const root = join(parent, "bundle"),
      script = new URL(
        "../examples/v2/summary-evaluation-demo.mjs",
        import.meta.url
      ).pathname,
      cli = new URL("../scripts/replay-assessment-summary.mjs", import.meta.url)
        .pathname;
    const e = spawnSync(process.execPath, [script, root], { encoding: "utf8" });
    assert.equal(e.status, 0, e.stderr);
    const p = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    assert.equal(JSON.parse(p.stdout).success, true);
    assert.notEqual(spawnSync(process.execPath, [script, root]).status, 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
