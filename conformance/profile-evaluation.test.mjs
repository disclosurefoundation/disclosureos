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
  evaluateProfileEvaluation as evaluate,
  ProfileEvaluationSchema,
  profileEvaluationJsonSchema,
  evaluateReleasedDocuments,
  evaluateHistoricalTestimony,
  evaluatePhysicalSamples,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  profileEvaluationExample as example,
  pin,
} from "../examples/v2/profile-evaluation-demo.mjs";
import { replayProfileEvaluation as replay } from "../scripts/replay-profile-evaluation.mjs";
const verifier = new URL(
  "../scripts/verify-research-receipt.py",
  import.meta.url
).pathname;
const workflows = [
  "released-documents:0.1.0",
  "historical-testimony:0.1.0",
  "physical-samples:0.1.0",
];
const evaluators = [
  evaluateReleasedDocuments,
  evaluateHistoricalTestimony,
  evaluatePhysicalSamples,
];
const run = (v = example()) => evaluate(v.manifest, v.options);
const decode = (b) => JSON.parse(Buffer.from(b));
function update(v, name, value) {
  v.options[name + "Bytes"] = Buffer.from(JSON.stringify(value));
  v.manifest[name] = pin(v.options[name + "Bytes"]);
}
function failedSelection(v) {
  const s = decode(v.options.selectionBytes);
  if (s.documents)
    s.documents[0].release = {
      state: "unknown",
      reason: "No release citation",
    };
  else if (s.accounts)
    s.accounts[0].recording = {
      state: "unknown",
      reason: "No recording citation",
    };
  else s.samples[0].custody = { state: "unknown", reason: "No custody record" };
  update(v, "selection", s);
}
function verify(receipt) {
  return spawnSync("python3", [verifier, "-"], {
    input: typeof receipt === "string" ? receipt : JSON.stringify(receipt),
    encoding: "utf8",
  });
}
function bundle(v, r, root) {
  writeFileSync(join(root, "receipt.json"), JSON.stringify(r.receipt));
  writeFileSync(join(root, "history.json"), v.options.historyBytes);
  writeFileSync(join(root, "selection.json"), v.options.selectionBytes);
  mkdirSync(join(root, "dependencies"));
  mkdirSync(join(root, "assets"));
  for (const [ref, bytes] of v.options.dependencyFiles)
    writeFileSync(join(root, "dependencies", ref), bytes);
  for (const a of v.manifest.assets)
    writeFileSync(
      join(root, "assets", a.fileRef),
      v.options.assetFiles.get(a.fileRef)
    );
}
for (const [index, workflow] of workflows.entries()) {
  test(
    workflow +
      " preserves the full existing profile output and verifies receipt hashes",
    async () => {
      const v = example(workflow),
        r = await run(v);
      assert.equal(r.success, true, JSON.stringify(r.issues));
      const assets = new Map(
        v.manifest.assets.map((a) => [
          a.ref,
          v.options.assetFiles.get(a.fileRef),
        ])
      );
      assert.deepEqual(
        r.profile,
        await evaluators[index](
          decode(v.options.historyBytes),
          decode(v.options.selectionBytes),
          { assets }
        )
      );
      assert.deepEqual(decode(Buffer.from(r.receipt.outputJson)), {
        profile: r.profile,
      });
      for (const name of ["request", "output"])
        assert.deepEqual(
          r.receipt[name],
          pin(Buffer.from(r.receipt[name + "Json"]))
        );
      const request = JSON.parse(r.receipt.requestJson);
      assert.deepEqual(request.manifest, v.manifest);
      assert.deepEqual(request.rules.profile, r.profile.profile);
      assert.equal(r.implementationExecution, "not_attested");
      assert.equal(r.environmentExecution, "not_attested");
      assert.equal(r.unselectedArtifactIntegrity, "not_checked");
      assert.equal(r.scientificEligibility, "not_checked");
      assert.equal(verify(r.receipt).status, 0);
    }
  );
  test(
    workflow + " omitted source bytes produce a reproducible unchecked result",
    async () => {
      const v = example(workflow);
      v.manifest.assets = [];
      const r = await run(v);
      assert.equal(r.success, false);
      assert.equal(r.checks.external, "passed");
      assert.equal(r.checks.profile, "not_checked");
      assert.equal(r.profile.checks.external, "not_checked");
      assert.ok(r.receipt);
      assert.equal(verify(r.receipt).status, 0);
    }
  );
  test(
    workflow +
      " changed source bytes can be pinned to reproduce a failed profile",
    async () => {
      const v = example(workflow);
      v.options.assetFiles.get("record")[0] ^= 1;
      Object.assign(
        v.manifest.assets[0],
        pin(v.options.assetFiles.get("record"))
      );
      const r = await run(v);
      assert.equal(r.checks.external, "passed");
      assert.equal(r.checks.profile, "failed");
      assert.equal(r.profile.checks.external, "failed");
      assert.equal(r.success, false);
      assert.ok(r.receipt);
    }
  );
  test(
    workflow + " missing required declarations retain failed output",
    async () => {
      const v = example(workflow);
      failedSelection(v);
      const r = await run(v);
      assert.equal(r.success, false);
      assert.equal(r.checks.profile, "failed");
      assert.ok(r.receipt);
      assert.equal(r.profile.success, false);
    }
  );
  for (const mode of ["passed", "failed", "unchecked"])
    test(workflow + " local replay of " + mode, async () => {
      const v = example(workflow);
      if (mode === "failed") failedSelection(v);
      if (mode === "unchecked") v.manifest.assets = [];
      const r = await run(v),
        root = mkdtempSync(join(tmpdir(), "profile-replay-"));
      try {
        bundle(v, r, root);
        const result = await replay(root);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(
          result.profileStatus,
          mode === "unchecked" ? "not_checked" : mode
        );
        assert.equal(
          result.profileSuccess,
          mode === "unchecked" ? null : mode === "passed"
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
}
for (const name of ["history", "selection"]) {
  test(
    "well-formed invalid " + name + " produces a failed receipt",
    async () => {
      const v = example();
      update(v, name, {});
      const r = await run(v);
      assert.equal(r.checks.profile, "failed");
      assert.ok(r.receipt);
    }
  );
  for (const bytes of [
    Buffer.from("{"),
    Buffer.from([255]),
    Buffer.from([239, 187, 191, 123, 125]),
  ])
    test(
      "malformed UTF8/JSON " + name + " " + bytes.toString("hex"),
      async () => {
        const v = example();
        v.options[name + "Bytes"] = bytes;
        v.manifest[name] = pin(bytes);
        const r = await run(v);
        assert.equal(r.receipt, null);
        assert.equal(r.checks.semantic, "failed");
        assert.ok(
          r.issues.some(
            (i) =>
              i.code === "PROFILE_EVALUATION.JSON" && i.pointer === "/" + name
          )
        );
      }
    );
  test(
    "exact formatting of " +
      name +
      " is pinned independently of semantic output",
    async () => {
      const v = example(),
        a = await run(v);
      update(v, name, decode(v.options[name + "Bytes"]));
      const b = await run(v);
      assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
      assert.deepEqual(a.profile, b.profile);
    }
  );
}
for (const role of ["history", "selection", "asset", "dependency"])
  for (const mode of ["missing", "corrupt", "length"])
    test(role + " " + mode + " cannot produce a receipt", async () => {
      const v = example();
      let bytes;
      if (role === "history" || role === "selection") {
        bytes = v.options[role + "Bytes"];
        if (mode === "missing") delete v.options[role + "Bytes"];
        else if (mode === "length") v.options[role + "Bytes"] = bytes.slice(1);
        else bytes[0] ^= 1;
      } else {
        const map =
            role === "asset" ? v.options.assetFiles : v.options.dependencyFiles,
          ref = role === "asset" ? "record" : "implementation";
        bytes = map.get(ref);
        if (mode === "missing") map.delete(ref);
        else if (mode === "length") map.set(ref, bytes.slice(1));
        else bytes[0] ^= 1;
      }
      const r = await run(v);
      assert.equal(r.success, false);
      assert.equal(r.receipt, null);
      assert.equal(
        r.checks.external,
        mode === "missing" ? "not_checked" : "failed"
      );
    });
for (const [name, edit] of [
  ["unknown workflow", (v) => (v.manifest.workflow = "custom:1")],
  ["extra manifest success", (v) => (v.manifest.success = true)],
  [
    "duplicate asset source",
    (v) =>
      v.manifest.assets.push({ ...v.manifest.assets[0], fileRef: "other" }),
  ],
  [
    "duplicate asset file",
    (v) =>
      v.manifest.assets.push({ ...v.manifest.assets[0], ref: "source:other" }),
  ],
  [
    "duplicate dependency",
    (v) => (v.manifest.dependencies.environment.ref = "implementation"),
  ],
  [
    "duplicate vocabulary id",
    (v) =>
      v.manifest.dependencies.vocabularies.push({
        ...v.manifest.dependencies.vocabularies[0],
        ref: "other",
      }),
  ],
  ["unsafe asset file", (v) => (v.manifest.assets[0].fileRef = "../escape")],
  ["unsafe source", (v) => (v.manifest.assets[0].ref = "source:../escape")],
])
  test("invalid manifest: " + name, async () => {
    const v = example();
    edit(v);
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(r.receipt, null);
    assert.ok(r.issues.length);
  });
test("wrong profile selection is retained as a failing result", async () => {
  const v = example();
  v.manifest.workflow = "historical-testimony:0.1.0";
  const r = await run(v);
  assert.equal(r.checks.profile, "failed");
  assert.ok(r.receipt);
});
test("all bytes and manifest are snapshotted before hashing", async () => {
  const v = example(),
    before = structuredClone(v);
  const a = await run(v);
  assert.deepEqual(v, before);
  const pending = run(v);
  v.options.selectionBytes.fill(0);
  v.options.historyBytes.fill(0);
  v.options.assetFiles.get("record").fill(0);
  v.options.dependencyFiles.get("implementation").fill(0);
  v.manifest.assets = [];
  assert.deepEqual((await pending).receipt, a.receipt);
});
test("manifest object-key order does not change receipt", async () => {
  const v = example(),
    a = await run(v);
  v.manifest = Object.fromEntries(Object.entries(v.manifest).reverse());
  assert.deepEqual((await run(v)).receipt, a.receipt);
});
for (const role of ["vocabulary", "implementation", "environment"])
  test("dependency version is pinned: " + role, async () => {
    const v = example(),
      a = await run(v);
    (role === "vocabulary"
      ? v.manifest.dependencies.vocabularies[0]
      : v.manifest.dependencies[role]
    ).version = "changed";
    const b = await run(v);
    assert.notEqual(a.receipt.request.sha256, b.receipt.request.sha256);
    assert.deepEqual(a.profile, b.profile);
  });
test("unavailable hashing yields no receipt and does not fetch or execute dependencies", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    fetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    const v = example();
    v.options.dependencyFiles.set(
      "implementation",
      Buffer.from('throw new Error("DO NOT EXECUTE")')
    );
    Object.assign(
      v.manifest.dependencies.implementation,
      pin(v.options.dependencyFiles.get("implementation"))
    );
    assert.equal((await run(v)).success, true);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const r = await run(v);
    assert.equal(r.receipt, null);
    assert.equal(r.checks.external, "not_checked");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
    globalThis.fetch = fetch;
  }
});
for (const file of [
  "history.json",
  "selection.json",
  "assets/record",
  "dependencies/implementation",
])
  test("replay rejects changed " + file, async () => {
    const v = example(),
      r = await run(v),
      root = mkdtempSync(join(tmpdir(), "profile-replay-"));
    try {
      bundle(v, r, root);
      writeFileSync(join(root, file), "changed");
      assert.equal((await replay(root)).success, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
for (const file of [
  "receipt.json",
  "history.json",
  "selection.json",
  "assets/record",
  "dependencies/implementation",
])
  test("replay refuses symlink " + file, async () => {
    const v = example(),
      r = await run(v),
      root = mkdtempSync(join(tmpdir(), "profile-replay-"));
    try {
      bundle(v, r, root);
      const bytes = readFileSync(join(root, file));
      writeFileSync(join(root, "target"), bytes);
      rmSync(join(root, file));
      symlinkSync(join(root, "target"), join(root, file));
      assert.equal((await replay(root)).success, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
for (const section of ["request", "output"])
  test(
    "replay rejects rehashed " + section + " tampering after integrity passes",
    async () => {
      const v = example(),
        r = await run(v),
        root = mkdtempSync(join(tmpdir(), "profile-replay-"));
      try {
        const payload = JSON.parse(r.receipt[section + "Json"]);
        if (section === "request") payload.rules.profile.version = "tampered";
        else payload.profile.success = false;
        r.receipt[section + "Json"] = JSON.stringify(payload);
        r.receipt[section] = pin(Buffer.from(r.receipt[section + "Json"]));
        assert.equal(verify(r.receipt).status, 0);
        bundle(v, r, root);
        const result = await replay(root);
        assert.equal(result.success, false);
        assert.equal(result.checks.receiptIntegrity, "passed");
        assert.equal(result.checks[section + "Replay"], "failed");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
test("independent verifier rejects duplicated receipt keys", async () => {
  const r = await run(),
    encoded = JSON.stringify(r.receipt);
  const response = verify('{"format":"bad",' + encoded.slice(1));
  assert.equal(response.status, 1);
  assert.match(response.stdout, /Duplicate JSON key/);
});
test("independent verifier rejects altered unpinned payload", async () => {
  const r = await run();
  r.receipt.outputJson += " ";
  assert.equal(verify(r.receipt).status, 1);
});
test("runtime and schema artifact agree", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/profile-evaluation-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, profileEvaluationJsonSchema());
  const check = new Ajv2020({ strict: false }).compile(schema);
  for (const [edit, expected] of [
    [(m) => {}, true],
    [(m) => (m.assets = []), true],
    [(m) => (m.workflow = "other"), false],
    [(m) => (m.selection.byteLength = 0), false],
    [(m) => (m.assets[0].fileRef = "../bad"), false],
    [(m) => (m.assets[0].extra = true), false],
  ]) {
    const m = example().manifest;
    edit(m);
    assert.equal(check(m), expected);
    assert.equal(ProfileEvaluationSchema.safeParse(m).success, expected);
  }
});
for (const mode of ["budget", "file-count"])
  test("replay enforces " + mode, async () => {
    const v = example(),
      r = await run(v),
      root = mkdtempSync(join(tmpdir(), "profile-replay-"));
    try {
      const payload = JSON.parse(r.receipt.requestJson);
      if (mode === "budget")
        payload.manifest.history.byteLength = 256 * 1024 * 1024;
      else
        payload.manifest.assets = Array.from({ length: 4096 }, (_, i) => ({
          ...v.manifest.assets[0],
          ref: "source:r" + i,
          fileRef: "f" + i,
        }));
      r.receipt.requestJson = JSON.stringify(payload);
      r.receipt.request = pin(Buffer.from(r.receipt.requestJson));
      bundle(v, r, root);
      const result = await replay(root);
      assert.equal(result.success, false);
      assert.equal(result.checks.receiptIntegrity, "passed");
      assert.match(
        JSON.stringify(result.issues),
        mode === "budget" ? /budget/ : /file limit/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
for (const dir of ["assets", "dependencies"])
  test("replay refuses symlink directory " + dir, async () => {
    const v = example(),
      r = await run(v),
      root = mkdtempSync(join(tmpdir(), "profile-replay-"));
    try {
      bundle(v, r, root);
      rmSync(join(root, dir), { recursive: true });
      mkdirSync(join(root, "target"));
      symlinkSync(join(root, "target"), join(root, dir));
      assert.equal((await replay(root)).success, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
test("undeclared local files do not silently become profile inputs", async () => {
  const v = example();
  v.manifest.assets = [];
  const a = await run(v);
  v.options.assetFiles.get("record").fill(0);
  v.options.assetFiles.set("extra", Buffer.from("unused"));
  assert.deepEqual((await run(v)).receipt, a.receipt);
  assert.equal(a.checks.profile, "not_checked");
});
