import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import { profileEvaluationExample as example } from "../examples/v2/profile-evaluation-demo.mjs";
import {
  ProfilePreparationSchema,
  profilePreparationJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { replayProfileEvaluation } from "../scripts/replay-profile-evaluation.mjs";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const run = (args) =>
  spawnSync(process.execPath, [cli, "profile", ...args], {
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
async function temp(fn) {
  const root = mkdtempSync(join(tmpdir(), "prepare-"));
  try {
    return await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function setup(root, workflow = "released-documents:0.1.0") {
  const v = example(workflow),
    input = join(root, "input"),
    out = join(root, "output");
  mkdirSync(input);
  mkdirSync(join(input, "assets"));
  mkdirSync(join(input, "dependencies"));
  writeFileSync(join(input, "history.json"), v.options.historyBytes);
  writeFileSync(join(input, "selection.json"), v.options.selectionBytes);
  for (const [ref, b] of v.options.assetFiles)
    writeFileSync(join(input, "assets", ref), b);
  for (const [ref, b] of v.options.dependencyFiles)
    writeFileSync(join(input, "dependencies", ref), b);
  const dependency = ({ ref, id, version }) => ({
    ref,
    id,
    version,
    path: "dependencies/" + ref,
  });
  const plan = {
    kind: "profile_preparation",
    schemaVersion: "0.1.0",
    id: v.manifest.id,
    workflow,
    history: "history.json",
    selection: "selection.json",
    assets: v.manifest.assets.map(({ ref, fileRef }) => ({
      ref,
      fileRef,
      path: "assets/" + fileRef,
    })),
    dependencies: {
      vocabularies: v.manifest.dependencies.vocabularies.map(dependency),
      implementation: dependency(v.manifest.dependencies.implementation),
      environment: dependency(v.manifest.dependencies.environment),
    },
  };
  const path = join(input, "plan.json");
  const save = () => writeFileSync(path, JSON.stringify(plan));
  save();
  return { v, input, out, plan, path, save };
}
for (const workflow of [
  "released-documents:0.1.0",
  "historical-testimony:0.1.0",
  "physical-samples:0.1.0",
])
  for (const mode of ["passed", "failed", "unchecked"])
    test(workflow + " prepares " + mode + " without changing inputs", () =>
      temp(async (root) => {
        const s = setup(root, workflow);
        if (mode === "failed") {
          const selection = JSON.parse(
            readFileSync(join(s.input, "selection.json"))
          );
          if (selection.documents)
            selection.documents[0].release = {
              state: "unknown",
              reason: "No citation",
            };
          else if (selection.accounts)
            selection.accounts[0].recording = {
              state: "unknown",
              reason: "No recording",
            };
          else
            selection.samples[0].custody = {
              state: "unknown",
              reason: "No custody",
            };
          writeFileSync(
            join(s.input, "selection.json"),
            JSON.stringify(selection)
          );
        }
        if (mode === "unchecked") {
          s.plan.assets = [];
          s.save();
        }
        const original = readFileSync(join(s.input, "selection.json"));
        const r = run(["prepare", s.path, "--out", s.out, "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const o = JSON.parse(r.stdout);
        assert.equal(o.success, true);
        assert.equal(
          o.profileStatus,
          mode === "unchecked" ? "not_checked" : mode
        );
        assert.equal(o.profileSuccess, mode === "passed");
        assert.equal(o.receiptCreated, true);
        assert.deepEqual(readFileSync(join(s.out, "selection.json")), original);
        assert.deepEqual(
          readFileSync(join(s.input, "selection.json")),
          original
        );
        assert.deepEqual(
          readFileSync(join(s.out, "history.json")),
          Buffer.from(s.v.options.historyBytes)
        );
        assert.equal(statSync(s.out).mode & 0o777, 0o700);
        for (const f of [
          "history.json",
          "selection.json",
          "evaluation.json",
          "receipt.json",
        ])
          assert.equal(statSync(join(s.out, f)).mode & 0o777, 0o600);
        assert.equal((await replayProfileEvaluation(s.out)).success, true);
        const check = run(["check", join(s.out, "evaluation.json"), "--json"]);
        assert.equal(check.status, mode === "passed" ? 0 : 1);
        assert.deepEqual(
          JSON.parse(check.stdout).evaluation.receipt,
          JSON.parse(readFileSync(join(s.out, "receipt.json")))
        );
      })
    );
for (const file of [
  "history.json",
  "selection.json",
  "assets/record",
  "dependencies/implementation",
])
  test("missing " + file + " leaves no output", () =>
    temp((root) => {
      const s = setup(root);
      rmSync(join(s.input, file));
      assert.equal(
        run(["prepare", s.path, "--out", s.out, "--json"]).status,
        2
      );
      assert.equal(existsSync(s.out), false);
    })
  );
for (const file of ["history.json", "selection.json"])
  test("invalid JSON " + file + " leaves no output", () =>
    temp((root) => {
      const s = setup(root);
      writeFileSync(join(s.input, file), "{");
      assert.equal(
        run(["prepare", s.path, "--out", s.out, "--json"]).status,
        2
      );
      assert.equal(existsSync(s.out), false);
    })
  );
for (const file of [
  "plan.json",
  "assets/record",
  "dependencies/implementation",
])
  test("symlink " + file + " is rejected", () =>
    temp((root) => {
      const s = setup(root),
        target = join(root, "target");
      writeFileSync(target, readFileSync(join(s.input, file)));
      rmSync(join(s.input, file));
      symlinkSync(target, join(s.input, file));
      assert.notEqual(
        run(["prepare", s.path, "--out", s.out, "--json"]).status,
        0
      );
      assert.equal(existsSync(s.out), false);
    })
  );
test("nested symlink directory cannot escape the input root", () =>
  temp((root) => {
    const s = setup(root);
    mkdirSync(join(root, "other"));
    writeFileSync(join(root, "other", "record"), "outside");
    rmSync(join(s.input, "assets"), { recursive: true });
    symlinkSync(join(root, "other"), join(s.input, "assets"));
    assert.equal(run(["prepare", s.path, "--out", s.out, "--json"]).status, 2);
    assert.equal(existsSync(s.out), false);
  }));
test("existing destination is untouched", () =>
  temp((root) => {
    const s = setup(root);
    mkdirSync(s.out);
    writeFileSync(join(s.out, "keep"), "keep");
    assert.equal(run(["prepare", s.path, "--out", s.out, "--json"]).status, 2);
    assert.equal(readFileSync(join(s.out, "keep"), "utf8"), "keep");
    assert.equal(existsSync(join(s.out, "evaluation.json")), false);
  }));
for (const [name, edit] of [
  ["path traversal", (p) => (p.history = "../outside")],
  ["absolute path", (p) => (p.selection = "/tmp/selection")],
  ["URL", (p) => (p.history = "https://example.org/file")],
  ["unknown workflow", (p) => (p.workflow = "auto")],
  ["extra pin", (p) => (p.assets[0].sha256 = "a".repeat(64))],
  ["duplicate asset", (p) => p.assets.push({ ...p.assets[0] })],
  [
    "duplicate dependency",
    (p) => (p.dependencies.environment.ref = "implementation"),
  ],
])
  test("invalid plan " + name, () =>
    temp((root) => {
      const s = setup(root);
      edit(s.plan);
      s.save();
      assert.notEqual(
        run(["prepare", s.path, "--out", s.out, "--json"]).status,
        0
      );
      assert.equal(existsSync(s.out), false);
    })
  );
test("empty artifact is not pinned as a valid file", () =>
  temp((root) => {
    const s = setup(root);
    writeFileSync(join(s.input, "assets/record"), "");
    assert.equal(run(["prepare", s.path, "--out", s.out, "--json"]).status, 2);
    assert.equal(existsSync(s.out), false);
  }));
test("source digest mismatch is retained as a failed profile rather than repinned in history", () =>
  temp((root) => {
    const s = setup(root);
    writeFileSync(join(s.input, "assets/record"), "different record");
    const r = run(["prepare", s.path, "--out", s.out, "--json"]);
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).profileStatus, "failed");
    assert.deepEqual(
      readFileSync(join(s.out, "history.json")),
      Buffer.from(s.v.options.historyBytes)
    );
  }));
for (const args of [
  ["prepare"],
  ["prepare", "plan"],
  ["prepare", "plan", "--out"],
  ["prepare", "plan", "--out", "dest", "--unknown"],
])
  test("usage " + JSON.stringify(args), () => {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.USAGE");
  });
test("schema artifact matches runtime and independent validation", () =>
  temp((root) => {
    const s = setup(root),
      schema = JSON.parse(
        readFileSync(
          new URL(
            "../packages/disclosureos-schema/schema/experimental/profile-preparation-0.1.0.schema.json",
            import.meta.url
          )
        )
      );
    assert.deepEqual(schema, profilePreparationJsonSchema());
    const check = new Ajv2020({ strict: false }).compile(schema);
    for (const [path, expected] of [
      ["history.json", true],
      ["nested/file name.json", true],
      ["../file", false],
      ["nested/../file", false],
      ["/file", false],
      ["https://example.org/file", false],
    ]) {
      s.plan.history = path;
      assert.equal(check(s.plan), expected);
      assert.equal(
        ProfilePreparationSchema.safeParse(s.plan).success,
        expected
      );
    }
  }));
for (const limit of ["count", "metadata"])
  test("preparation enforces " + limit + " budget before writing", () =>
    temp((root) => {
      const s = setup(root);
      if (limit === "count") {
        s.plan.assets = Array.from({ length: 4096 }, (_, i) => ({
          ref: "source:r" + i,
          fileRef: "f" + i,
          path: "assets/record",
        }));
        s.save();
      } else
        writeFileSync(
          join(s.input, "history.json"),
          Buffer.alloc(8 * 1024 * 1024 + 1, 32)
        );
      const result = run(["prepare", s.path, "--out", s.out, "--json"]);
      assert.equal(result.status, 2);
      assert.equal(existsSync(s.out), false);
    })
  );
