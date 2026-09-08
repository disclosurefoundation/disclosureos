import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  cpSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  mkdirSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { evaluateReproductionPacket } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const cli = fileURLToPath(
  new URL("../packages/disclosureos-cli/dist/index.js", import.meta.url)
);
const example = fileURLToPath(
  new URL("../examples/v2/reproduction-demo", import.meta.url)
);
const run = (args) =>
  spawnSync(process.execPath, [cli, "packet", ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
function temp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-packet-cli-"));
  try {
    cpSync(example, dir, { recursive: true });
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const read = (dir) => JSON.parse(readFileSync(join(dir, "packet.json")));
const save = (dir, p) =>
  writeFileSync(join(dir, "packet.json"), JSON.stringify(p));
function replace(dir, p, id, text) {
  const bytes = Buffer.from(text);
  writeFileSync(join(dir, "files", id), bytes);
  const f = p.files.find((f) => f.id === id);
  f.byteLength = bytes.length;
  f.sha256 = createHash("sha256").update(bytes).digest("hex");
  save(dir, p);
}
test("inspect explicitly leaves validation unchecked", () => {
  const r = run(["inspect", join(example, "packet.json"), "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.equal(o.inspection.fileIdentity, "not_checked");
  assert.equal(o.validation, undefined);
});
test("inspect needs no asset files", () =>
  temp((dir) => {
    rmSync(join(dir, "files"), { recursive: true });
    assert.equal(
      run(["inspect", join(dir, "packet.json"), "--json"]).status,
      0
    );
  }));
test("validate exactly preserves shared API result", async () => {
  const p = read(example),
    files = new Map(
      p.files.map((f) => [
        f.id,
        new Uint8Array(readFileSync(join(example, "files", f.id))),
      ])
    );
  const expected = await evaluateReproductionPacket(p, { files });
  const r = run(["validate", "--json", join(example, "packet.json")]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).validation, expected);
});
test("reproduce emits result and actual executor identity", () => {
  const r = run(["reproduce", join(example, "packet.json"), "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.equal(o.reproduction.status, "passed");
  assert.equal(o.reproduction.value, -3);
  assert.equal(o.reproduction.absoluteTolerance, 0);
  assert.match(o.reproduction.executorSha256, /^[a-f0-9]{64}$/);
  assert.equal(o.validation.methodExecution, "not_checked");
  assert.equal(o.scientificEligibility, "not_checked");
});
for (const args of [
  [],
  ["unknown"],
  ["validate"],
  ["validate", "a", "b"],
  ["validate", "--strict", "x"],
])
  test(`usage ${args.join(" ")}`, () => {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.USAGE");
  });
test("missing manifest returns structured error", () => {
  const r = run([
    "validate",
    "/nonexistent/disclosureos/packet.json",
    "--json",
  ]);
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.MANIFEST");
});
test("help documents stages and exit behavior", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Exit codes/);
  assert.match(r.stdout, /never bundled code/);
});
test("malformed JSON returns structured error", () =>
  temp((dir) => {
    writeFileSync(join(dir, "packet.json"), "{");
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.MANIFEST");
  }));
test("schema-invalid path IDs never reach asset reads", () =>
  temp((dir) => {
    const p = read(dir);
    p.files[0].id = "../escape";
    save(dir, p);
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    const o = JSON.parse(r.stdout);
    assert.equal(r.status, 1);
    assert.equal(o.validation.checks.structural, "failed");
    assert.deepEqual(o.issues, []);
  }));
test("missing asset preserves not_checked and fails exit status", () =>
  temp((dir) => {
    rmSync(join(dir, "files", "history"));
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    const o = JSON.parse(r.stdout);
    assert.equal(r.status, 1);
    assert.equal(o.validation.checks.profile, "not_checked");
    assert.ok(
      o.validation.issues.some((i) => i.code === "PACKET.MISSING_FILE")
    );
  }));
test("corrupt files prevent reproduction", () =>
  temp((dir) => {
    writeFileSync(join(dir, "files", "history"), "corrupt");
    const r = run(["reproduce", join(dir, "packet.json"), "--json"]);
    const o = JSON.parse(r.stdout);
    assert.equal(r.status, 1);
    assert.equal(o.validation.checks.profile, "failed");
    assert.equal(o.reproduction, undefined);
  }));
test("unsupported methods are not executed", () =>
  temp((dir) => {
    const p = read(dir);
    p.method.id = "unknown-code";
    save(dir, p);
    const r = run(["reproduce", join(dir, "packet.json"), "--json"]);
    const o = JSON.parse(r.stdout);
    assert.equal(r.status, 1);
    assert.equal(o.validation.success, true);
    assert.equal(o.reproduction.status, "not_checked");
  }));
test("bundled method contents are inert", () =>
  temp((dir) => {
    const p = read(dir);
    replace(dir, p, "typescript-source", 'throw Error("NEVER EXECUTE");');
    const r = run(["reproduce", join(dir, "packet.json"), "--json"]);
    assert.equal(r.status, 0, r.stdout);
  }));
for (const kind of ["file", "directory"])
  test(`rejects ${kind} symlink`, () =>
    temp((dir) => {
      if (kind === "file") {
        rmSync(join(dir, "files", "history"));
        symlinkSync(
          join(example, "files", "history"),
          join(dir, "files", "history")
        );
      } else {
        rmSync(join(dir, "files"), { recursive: true });
        symlinkSync(join(example, "files"), join(dir, "files"));
      }
      const r = run(["validate", join(dir, "packet.json"), "--json"]);
      assert.equal(r.status, 1);
      assert.ok(JSON.parse(r.stdout).issues.length);
    }));
test("rejects nonregular asset", () =>
  temp((dir) => {
    rmSync(join(dir, "files", "history"));
    mkdirSync(join(dir, "files", "history"));
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /regular file/);
  }));
test("declared packet limit", () =>
  temp((dir) => {
    const p = read(dir);
    p.files[0].byteLength = 300 * 1024 * 1024;
    save(dir, p);
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.LIMIT");
  }));
test("actual file size cannot bypass declared size limit", () =>
  temp((dir) => {
    truncateSync(join(dir, "files", "history"), 300 * 1024 * 1024);
    const r = run(["validate", join(dir, "packet.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /memory limit/);
  }));
test("plain diagnostics expose the same missing-file code", () =>
  temp((dir) => {
    rmSync(join(dir, "files", "history"));
    const r = run(["validate", join(dir, "packet.json")]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /PACKET.MISSING_FILE/);
    assert.match(r.stdout, /Scientific eligibility: not checked/);
  }));
test("wrong output reaches the explicit comparison", () =>
  temp((dir) => {
    const p = read(dir);
    const changed = '{"velocity":-4}\n';
    replace(dir, p, "observation-product-summary", changed);
    const history = JSON.parse(readFileSync(join(dir, "files", "history")));
    history.observation.products.find((v) => v.id === "summary").digest.value =
      createHash("sha256").update(changed).digest("hex");
    replace(dir, p, "history", JSON.stringify(history));
    const r = run(["reproduce", join(dir, "packet.json"), "--json"]);
    const o = JSON.parse(r.stdout);
    assert.equal(o.validation.success, true, JSON.stringify(o));
    assert.equal(r.status, 1);
    assert.equal(o.reproduction.status, "failed");
    assert.match(o.reproduction.message, /beyond the declared tolerance/);
  }));
