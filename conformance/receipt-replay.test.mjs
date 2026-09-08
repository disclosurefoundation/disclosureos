import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  researchEvaluationExample,
  pin,
} from "../examples/v2/evaluation-provenance-demo.mjs";
import { evaluateResearchEvaluation } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { replayResearchEvaluation } from "../scripts/replay-research-evaluation.mjs";
const verifier = new URL(
  "../scripts/verify-research-receipt.py",
  import.meta.url
).pathname;
const cli = new URL(
  "../scripts/replay-research-evaluation.mjs",
  import.meta.url
).pathname;
const verify = (receipt) =>
  spawnSync("python3", [verifier, "-"], {
    input: typeof receipt === "string" ? receipt : JSON.stringify(receipt),
    encoding: "utf8",
  });
const repin = (r, name) => (r[name] = pin(Buffer.from(r[name + "Json"])));
async function bundle(fn, edit = () => {}) {
  const v = researchEvaluationExample();
  edit(v);
  const evaluation = await evaluateResearchEvaluation(v.manifest, v.options);
  assert.ok(evaluation.receipt);
  const root = mkdtempSync(join(tmpdir(), "disclosureos-replay-"));
  try {
    mkdirSync(join(root, "files"));
    mkdirSync(join(root, "dependencies"));
    writeFileSync(
      join(root, "receipt.json"),
      JSON.stringify(evaluation.receipt)
    );
    writeFileSync(join(root, "packet.json"), v.options.packetBytes);
    for (const [name, map] of [
      ["files", v.options.files],
      ["dependencies", v.options.dependencyFiles],
    ])
      for (const [id, b] of map) writeFileSync(join(root, name, id), b);
    await fn(root, evaluation.receipt, v);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function rejected(v) {
  const packet = JSON.parse(Buffer.from(v.options.packetBytes));
  const ref = packet.documents.review,
    review = JSON.parse(Buffer.from(v.options.files.get(ref)));
  review.measurements[0].calibrationUse.outcome = "rejected";
  const bytes = Buffer.from(JSON.stringify(review));
  v.options.files.set(ref, bytes);
  Object.assign(
    packet.files.find((f) => f.id === ref),
    pin(bytes)
  );
  v.options.packetBytes = Buffer.from(JSON.stringify(packet));
  v.manifest.packet = pin(v.options.packetBytes);
}
test("independent Python verifies exact strings without claiming semantic replay", () =>
  bundle(async (root, receipt) => {
    const p = verify(receipt);
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const r = JSON.parse(p.stdout);
    assert.equal(r.success, true);
    for (const k of [
      "evaluationSemantics",
      "inputFiles",
      "replay",
      "canonicalSerialization",
      "scientificEligibility",
    ])
      assert.equal(r[k], "not_checked");
    const file = spawnSync("python3", [verifier, join(root, "receipt.json")], {
      encoding: "utf8",
    });
    assert.deepEqual(JSON.parse(file.stdout), r);
  }));
test("complete replay agrees with saved request and output through real CLI", () =>
  bundle(async (root) => {
    const before = readFileSync(join(root, "receipt.json"));
    const p = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const r = JSON.parse(p.stdout);
    assert.equal(r.success, true);
    assert.equal(r.evaluationSuccess, true);
    assert.equal(r.evaluationStatus, "passed");
    assert.deepEqual(r.checks, {
      receiptIntegrity: "passed",
      requestReplay: "passed",
      outputReplay: "passed",
    });
    assert.deepEqual(readFileSync(join(root, "receipt.json")), before);
  }));
test("an accurately reproduced failure is a successful replay, not a passing evaluation", () =>
  bundle(async (root) => {
    const r = await replayResearchEvaluation(root);
    assert.equal(r.success, true);
    assert.equal(r.evaluationSuccess, false);
    assert.equal(r.evaluationStatus, "failed");
    const p = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(p.status, 0);
    assert.equal(JSON.parse(p.stdout).evaluationSuccess, false);
  }, rejected));
for (const name of ["request", "output"])
  for (const fault of ["text", "digest", "length"])
    test(`Python rejects changed ${name} ${fault}`, () =>
      bundle(async (root, r) => {
        if (fault === "text") r[name + "Json"] += " ";
        else if (fault === "digest") r[name].sha256 = "0".repeat(64);
        else r[name].byteLength++;
        assert.equal(verify(r).status, 1);
      }));
for (const [name, edit] of [
  ["version", (r) => (r.format = "unknown")],
  ["serialization", (r) => (r.serialization = "unknown")],
  ["extra field", (r) => (r.callback = true)],
  ["boolean length", (r) => (r.request.byteLength = true)],
  ["string length", (r) => (r.request.byteLength = "10")],
  ["non-string payload", (r) => (r.outputJson = {})],
  [
    "invalid JSON payload",
    (r) => {
      r.outputJson = "NaN";
      repin(r, "output");
    },
  ],
  [
    "duplicate inner key",
    (r) => {
      r.outputJson = '{"packet":{},"packet":{},"completion":{}}';
      repin(r, "output");
    },
  ],
  [
    "missing payload section",
    (r) => {
      r.outputJson = '{"packet":{}}';
      repin(r, "output");
    },
  ],
])
  test(`Python rejects ${name}`, () =>
    bundle(async (root, r) => {
      edit(r);
      assert.equal(verify(r).status, 1);
    }));
test("duplicate outer JSON keys are rejected before replay", () =>
  bundle(async (root, r) => {
    const serialized = JSON.stringify(r);
    // Insert a duplicate key at the root; this constructs invalid test input,
    // rather than escaping or sanitizing any content.
    assert.equal(serialized[0], "{");
    const text = '{"format":"bad",' + serialized.slice(1);
    const verification = verify(text);
    assert.equal(verification.status, 1);
    assert.match(JSON.parse(verification.stdout).error, /Duplicate JSON key: format/);
    writeFileSync(join(root, "receipt.json"), text);
    assert.equal(
      (await replayResearchEvaluation(root)).checks.receiptIntegrity,
      "failed"
    );
  }));
test("rehashing fabricated output passes only byte integrity; replay rejects it", () =>
  bundle(async (root, r) => {
    const output = JSON.parse(r.outputJson);
    output.packet.success = false;
    r.outputJson = JSON.stringify(output);
    repin(r, "output");
    assert.equal(verify(r).status, 0);
    writeFileSync(join(root, "receipt.json"), JSON.stringify(r));
    const replay = await replayResearchEvaluation(root);
    assert.equal(replay.success, false);
    assert.equal(replay.checks.outputReplay, "failed");
    assert.equal(replay.evaluationSuccess, true);
  }));
test("modified rule identity cannot silently replay as the current rule", () =>
  bundle(async (root, r) => {
    const req = JSON.parse(r.requestJson);
    req.rules.completion.version = "999";
    r.requestJson = JSON.stringify(req);
    repin(r, "request");
    writeFileSync(join(root, "receipt.json"), JSON.stringify(r));
    const replay = await replayResearchEvaluation(root);
    assert.equal(replay.checks.requestReplay, "failed");
    assert.equal(replay.success, false);
  }));
for (const path of [
  "packet.json",
  "files/history",
  "dependencies/synthetic-vocabulary",
])
  for (const mode of ["missing", "corrupt", "symlink"])
    test(`${mode} local ${path} prevents successful replay`, () =>
      bundle(async (root) => {
        const file = join(root, path);
        if (mode === "corrupt") writeFileSync(file, "bad");
        else {
          rmSync(file);
          if (mode === "symlink") symlinkSync(join(root, "receipt.json"), file);
        }
        const r = await replayResearchEvaluation(root);
        assert.equal(r.success, false);
        assert.ok(r.issues.length);
      }));
test("path traversal and unsupported workflow are rejected without running them", () =>
  bundle(async (root, r) => {
    for (const edit of [
      (m) => (m.dependencies.implementation.ref = "../receipt.json"),
      (m) => (m.workflow = "custom"),
    ]) {
      const saved = structuredClone(r),
        req = JSON.parse(saved.requestJson);
      edit(req.manifest);
      saved.requestJson = JSON.stringify(req);
      repin(saved, "request");
      writeFileSync(join(root, "receipt.json"), JSON.stringify(saved));
      const result = await replayResearchEvaluation(root);
      assert.equal(result.success, false);
      assert.equal(result.checks.outputReplay, "not_checked");
    }
  }));
test("oversized receipt is rejected without reading unbounded bytes", () =>
  bundle(async (root) => {
    truncateSync(join(root, "receipt.json"), 8 * 1024 * 1024 + 1);
    const p = spawnSync("python3", [verifier, join(root, "receipt.json")], {
      encoding: "utf8",
    });
    assert.equal(p.status, 1);
    assert.equal((await replayResearchEvaluation(root)).success, false);
  }));
test("declared replay byte budget is bounded before data files are read", () =>
  bundle(async (root) => {
    const path = join(root, "packet.json"),
      packet = JSON.parse(readFileSync(path));
    packet.files[0].byteLength = 256 * 1024 * 1024;
    writeFileSync(path, JSON.stringify(packet));
    const r = await replayResearchEvaluation(root);
    assert.equal(r.success, false);
    assert.match(r.issues[0].message, /budget/);
  }));
test("CLI rejects extra arguments and unknown options", () => {
  assert.equal(
    spawnSync(process.execPath, [cli, "--custom"], { encoding: "utf8" }).status,
    1
  );
  assert.equal(
    spawnSync(process.execPath, [cli, "a", "b"], { encoding: "utf8" }).status,
    1
  );
  assert.equal(
    spawnSync("python3", [verifier, "a", "b"], { encoding: "utf8" }).status,
    1
  );
});
test("synthetic export is replayable and refuses to overwrite an existing directory", async () => {
  const parent = mkdtempSync(join(tmpdir(), "disclosureos-export-"));
  try {
    const dir = join(parent, "bundle"),
      exporter = new URL(
        "../examples/v2/export-evaluation-replay-demo.mjs",
        import.meta.url
      ).pathname;
    const p = spawnSync(process.execPath, [exporter, dir], {
      encoding: "utf8",
    });
    assert.equal(p.status, 0, p.stderr);
    assert.equal((await replayResearchEvaluation(dir)).success, true);
    assert.notEqual(
      spawnSync(process.execPath, [exporter, dir], { encoding: "utf8" }).status,
      0
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("replay stays offline and does not execute pinned implementation bytes", () =>
  bundle(
    async (root) => {
      const old = globalThis.fetch;
      try {
        globalThis.fetch = () => {
          throw Error("Unexpected network access");
        };
        assert.equal((await replayResearchEvaluation(root)).success, true);
      } finally {
        globalThis.fetch = old;
      }
    },
    (v) => {
      const packet = JSON.parse(Buffer.from(v.options.packetBytes)),
        ref = packet.method.implementations[0].artifactRef,
        bytes = Buffer.from('throw new Error("Supplied code must not run");');
      v.options.files.set(ref, bytes);
      Object.assign(
        packet.files.find((f) => f.id === ref),
        pin(bytes)
      );
      v.options.packetBytes = Buffer.from(JSON.stringify(packet));
      v.manifest.packet = pin(v.options.packetBytes);
    }
  ));
test("missing Python verifier stops replay rather than skipping integrity", () =>
  bundle(async (root) => {
    const old = process.env.PATH;
    try {
      process.env.PATH = "/nonexistent-disclosureos-test";
      const r = await replayResearchEvaluation(root);
      assert.equal(r.success, false);
      assert.equal(r.checks.receiptIntegrity, "not_checked");
      assert.equal(r.checks.outputReplay, "not_checked");
    } finally {
      process.env.PATH = old;
    }
  }));

test("independent checker measures UTF-8 bytes rather than string characters", () =>
  bundle(async (root, r) => {
    const req = JSON.parse(r.requestJson);
    req.limits.unicodeExample = "é 🚀";
    r.requestJson = JSON.stringify(req);
    repin(r, "request");
    assert.equal(verify(r).status, 0);
    r.request.byteLength = r.requestJson.length;
    assert.equal(verify(r).status, 1);
  }));
