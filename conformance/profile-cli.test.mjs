import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  profileEvaluationExample as example,
  pin,
} from "../examples/v2/profile-evaluation-demo.mjs";
import { evaluateProfileEvaluation as evaluate } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const run = (args) =>
  spawnSync(process.execPath, [cli, "profile", ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
async function temp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "profile-cli-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function bundle(v, root) {
  writeFileSync(join(root, "evaluation.json"), JSON.stringify(v.manifest));
  writeFileSync(join(root, "history.json"), v.options.historyBytes);
  writeFileSync(join(root, "selection.json"), v.options.selectionBytes);
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, "dependencies"));
  for (const a of v.manifest.assets)
    writeFileSync(
      join(root, "assets", a.fileRef),
      v.options.assetFiles.get(a.fileRef)
    );
  for (const [ref, b] of v.options.dependencyFiles)
    writeFileSync(join(root, "dependencies", ref), b);
  return join(root, "evaluation.json");
}
function failed(v) {
  const s = JSON.parse(Buffer.from(v.options.selectionBytes));
  if (s.documents)
    s.documents[0].release = { state: "unknown", reason: "No citation" };
  else if (s.accounts)
    s.accounts[0].recording = { state: "unknown", reason: "No citation" };
  else s.samples[0].custody = { state: "unknown", reason: "No custody record" };
  v.options.selectionBytes = Buffer.from(JSON.stringify(s));
  v.manifest.selection = pin(v.options.selectionBytes);
}
test("catalog lists all four domain paths and separates instrument packet checks", () => {
  const r = run(["list", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.equal(o.success, true);
  assert.equal(o.catalog.length, 4);
  assert.equal(o.catalog[0].workflow, null);
  assert.match(o.catalog[0].command, /packet validate/);
  assert.deepEqual(
    o.catalog.slice(1).map((p) => p.workflow),
    [
      "released-documents:0.1.0",
      "historical-testimony:0.1.0",
      "physical-samples:0.1.0",
    ]
  );
  for (const p of o.catalog) {
    assert.ok(p.useWhen);
    assert.ok(p.limits);
    assert.ok(p.profile.id);
  }
});
test("human catalog is readable and help describes exit meanings", () => {
  const r = run(["list"]);
  assert.equal(r.status, 0);
  for (const name of [
    "Instrument research",
    "Released documents",
    "Historical testimony",
    "Physical samples",
  ])
    assert.ok(r.stdout.includes(name));
  assert.match(r.stdout, /no automatic selection/i);
  const h = run(["--help"]);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /1 failed\/unchecked checks/);
});
for (const workflow of [
  "released-documents:0.1.0",
  "historical-testimony:0.1.0",
  "physical-samples:0.1.0",
]) {
  test(
    workflow + " inspect needs only the manifest and claims no validation",
    () =>
      temp((dir) => {
        const v = example(workflow),
          path = join(dir, "evaluation.json");
        writeFileSync(path, JSON.stringify(v.manifest));
        const r = run(["inspect", path, "--json"]);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        const o = JSON.parse(r.stdout);
        assert.equal(o.inspection.workflow, workflow);
        assert.equal(o.inspection.inputIntegrity, "not_checked");
        assert.equal(o.inspection.profileOutcome, "not_checked");
        assert.equal(o.inspection.receipt, "not_created");
        assert.equal("evaluation" in o, false);
        assert.equal(existsSync(join(dir, "assets")), false);
        const human = run(["inspect", path]);
        assert.match(human.stdout, /Manifest inspected/);
        assert.doesNotMatch(human.stdout, /Profile outcome: passed/);
      })
  );
  for (const mode of ["passed", "failed", "unchecked"])
    test(workflow + " CLI preserves " + mode + " API output", () =>
      temp(async (dir) => {
        const v = example(workflow);
        if (mode === "failed") failed(v);
        if (mode === "unchecked") v.manifest.assets = [];
        const path = bundle(v, dir),
          expected = await evaluate(v.manifest, v.options);
        const r = run(["check", path, "--json"]);
        assert.equal(r.status, mode === "passed" ? 0 : 1, r.stdout + r.stderr);
        const o = JSON.parse(r.stdout);
        assert.deepEqual(o.evaluation, expected);
        assert.equal(o.selectedWorkflow, workflow);
        assert.equal(o.success, mode === "passed");
        assert.ok(o.evaluation.receipt);
        assert.equal(
          o.evaluation.checks.profile,
          mode === "unchecked" ? "not_checked" : mode
        );
        assert.equal(existsSync(join(dir, "receipt.json")), false);
      })
    );
  test(
    workflow +
      " human output distinguishes required gaps from receipt creation",
    () =>
      temp((dir) => {
        const v = example(workflow);
        failed(v);
        const path = bundle(v, dir),
          r = run(["check", path]);
        assert.equal(r.status, 1);
        assert.match(r.stdout, /Profile outcome: failed/);
        assert.match(r.stdout, /Receipt: created \(unsigned\)/);
        assert.match(r.stdout, /Required \|/);
        assert.match(r.stdout, /Recommended \|/);
        assert.match(r.stdout, /Next:/);
        assert.match(r.stdout, /Scientific eligibility: not checked/);
        assert.doesNotMatch(r.stdout, /"validation":/);
      })
  );
}
for (const file of [
  "history.json",
  "selection.json",
  "assets/record",
  "dependencies/implementation",
])
  test("missing declared " + file + " cannot pass or produce receipt", () =>
    temp((dir) => {
      const v = example(),
        path = bundle(v, dir);
      rmSync(join(dir, file));
      const r = run(["check", path, "--json"]),
        o = JSON.parse(r.stdout);
      assert.equal(r.status, 1);
      assert.equal(o.success, false);
      assert.equal(o.evaluation.receipt, null);
      assert.ok(
        o.issues.some((i) => i.code === "CLI.INPUT_FILE" && i.pointer === file)
      );
    })
  );
for (const file of [
  "evaluation.json",
  "history.json",
  "selection.json",
  "assets/record",
  "dependencies/implementation",
])
  test("symlink " + file + " is refused", () =>
    temp((dir) => {
      const v = example(),
        path = bundle(v, dir),
        target = join(dir, "target");
      writeFileSync(target, readFileSync(join(dir, file)));
      rmSync(join(dir, file));
      symlinkSync(target, join(dir, file));
      const r = run(["check", path, "--json"]);
      assert.equal(r.status, file === "evaluation.json" ? 2 : 1);
      assert.equal(JSON.parse(r.stdout).success, false);
    })
  );
for (const name of ["assets", "dependencies"])
  test("symlink " + name + " directory is refused", () =>
    temp((dir) => {
      const v = example(),
        path = bundle(v, dir);
      rmSync(join(dir, name), { recursive: true });
      mkdirSync(join(dir, "target"));
      symlinkSync(join(dir, "target"), join(dir, name));
      const r = run(["check", path, "--json"]);
      assert.equal(r.status, 1);
      assert.ok(
        JSON.parse(r.stdout).issues.some((i) => i.code === "CLI.DIRECTORY")
      );
    })
  );
for (const mode of ["budget", "count"])
  test("check enforces " + mode + " before reading inputs", () =>
    temp((dir) => {
      const v = example();
      if (mode === "budget") v.manifest.history.byteLength = 256 * 1024 * 1024;
      else
        v.manifest.assets = Array.from({ length: 4096 }, (_, i) => ({
          ...v.manifest.assets[0],
          ref: "source:r" + i,
          fileRef: "f" + i,
        }));
      const path = join(dir, "evaluation.json");
      writeFileSync(path, JSON.stringify(v.manifest));
      const r = run(["check", path, "--json"]);
      assert.equal(r.status, 1);
      const o = JSON.parse(r.stdout);
      assert.equal(o.issues[0].code, "CLI.LIMIT");
      assert.equal("evaluation" in o, false);
    })
  );
for (const [name, edit] of [
  ["workflow", (m) => (m.workflow = "auto")],
  ["duplicate assets", (m) => m.assets.push({ ...m.assets[0] })],
  ["unsafe path", (m) => (m.assets[0].fileRef = "../escape")],
  ["extra key", (m) => (m.success = true)],
])
  test("invalid manifest " + name + " is rejected without file reads", () =>
    temp((dir) => {
      const v = example();
      edit(v.manifest);
      const path = join(dir, "evaluation.json");
      writeFileSync(path, JSON.stringify(v.manifest));
      for (const command of ["inspect", "check"]) {
        const r = run([command, path, "--json"]);
        assert.equal(r.status, 1);
        const o = JSON.parse(r.stdout);
        assert.equal(o.evaluation.receipt, null);
        assert.equal(o.evaluation.profile, null);
      }
    })
  );
for (const args of [
  [],
  ["guess"],
  ["list", "extra"],
  ["check"],
  ["inspect"],
  ["list", "--unknown"],
  ["check", "file", "extra"],
  ["check", "file", "--workflow", "auto"],
])
  test("invalid usage " + JSON.stringify(args), () => {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.USAGE");
  });
for (const bytes of [
  Buffer.from("{"),
  Buffer.from([255]),
  Buffer.from([239, 187, 191, 123, 125]),
])
  test("malformed manifest " + bytes.toString("hex"), () =>
    temp((dir) => {
      const path = join(dir, "evaluation.json");
      writeFileSync(path, bytes);
      const r = run(["inspect", path, "--json"]);
      assert.equal(r.status, 2);
      assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.MANIFEST");
    })
  );
test("inspect does not modify the manifest", () =>
  temp((dir) => {
    const path = join(dir, "evaluation.json"),
      bytes = Buffer.from(JSON.stringify(example().manifest));
    writeFileSync(path, bytes);
    assert.equal(run(["inspect", path]).status, 0);
    assert.deepEqual(readFileSync(path), bytes);
  }));
test("malformed selection yields clear diagnostics in human output", () =>
  temp((dir) => {
    const v = example();
    v.options.selectionBytes = Buffer.from("{");
    v.manifest.selection = pin(v.options.selectionBytes);
    const path = bundle(v, dir),
      r = run(["check", path]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /PROFILE_EVALUATION.JSON \/selection/);
    assert.match(r.stdout, /Receipt: not created/);
  }));
test("unknown selection contract reports nested profile errors and next action", () =>
  temp((dir) => {
    const v = example();
    v.options.selectionBytes = Buffer.from("{}");
    v.manifest.selection = pin(v.options.selectionBytes);
    const r = run(["check", bundle(v, dir)]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /DOCUMENT.SELECTION/);
    assert.match(r.stdout, /Next:/);
    assert.match(r.stdout, /Profile outcome: failed/);
  }));
