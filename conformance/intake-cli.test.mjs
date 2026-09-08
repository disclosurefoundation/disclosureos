import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { evaluateSourceIntake } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const cli = fileURLToPath(
  new URL("../packages/disclosureos-cli/dist/index.js", import.meta.url)
);
const run = (args) =>
  spawnSync(process.execPath, [cli, "intake", ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
async function temp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-intake-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function create(dir) {
  const input = join(dir, "source.json"),
    out = join(dir, "receipt");
  writeFileSync(input, Buffer.from([0, 255, 128, 10]));
  const r = run(["create", input, "--out", out, "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return {
    input,
    out,
    path: join(out, "intake.json"),
    result: JSON.parse(r.stdout),
  };
}
test("create preserves exact opaque bytes, unknown context and private permissions", () =>
  temp((dir) => {
    const { input, out, path, result } = create(dir),
      receipt = JSON.parse(readFileSync(path));
    assert.deepEqual(
      readFileSync(input),
      readFileSync(join(out, "files/file-1"))
    );
    assert.equal(receipt.artifacts[0].originalName, "source.json");
    assert.equal(receipt.artifacts[0].role, "unknown");
    assert.equal(receipt.artifacts[0].format.state, "unknown");
    assert.equal(receipt.source.publisher.state, "unknown");
    assert.equal(receipt.license.state, "unknown");
    assert.equal(result.validation.success, true);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(out).mode & 0o777, 0o700);
    assert.ok(Number.isFinite(Date.parse(receipt.receivedAt)));
    assert.ok(!readFileSync(path, "utf8").includes(dir));
  }));
test("CLI and public API results agree", () =>
  temp(async (dir) => {
    const { out, path } = create(dir),
      receipt = JSON.parse(readFileSync(path)),
      files = new Map(
        receipt.artifacts.map((a) => [
          a.id,
          new Uint8Array(readFileSync(join(out, "files", a.id))),
        ])
      );
    const r = run(["validate", path, "--json"]);
    assert.equal(r.status, 0);
    assert.deepEqual(
      JSON.parse(r.stdout).validation,
      await evaluateSourceIntake(receipt, { files })
    );
  }));
test("inspect reads only manifest and declares unchecked file identity", () =>
  temp((dir) => {
    const { out, path } = create(dir);
    rmSync(join(out, "files"), { recursive: true });
    const r = run(["inspect", path, "--json"]);
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).fileIdentity, "not_checked");
    assert.equal(run(["validate", path, "--json"]).status, 1);
  }));
test("existing destination and original source remain untouched", () =>
  temp((dir) => {
    const { input, out, path } = create(dir),
      before = readFileSync(path),
      source = readFileSync(input);
    const r = run(["create", input, "--out", out, "--json"]);
    assert.equal(r.status, 2);
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(readFileSync(input), source);
  }));
test("failed source read creates nothing", () =>
  temp((dir) => {
    const out = join(dir, "absent");
    const r = run(["create", join(dir, "missing"), "--out", out, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(existsSync(out), false);
  }));
test("duplicate basenames receive distinct identities including empty file", () =>
  temp((dir) => {
    mkdirSync(join(dir, "a"));
    mkdirSync(join(dir, "b"));
    const a = join(dir, "a/data"),
      b = join(dir, "b/data"),
      out = join(dir, "receipt");
    writeFileSync(a, "");
    writeFileSync(b, "synthetic");
    const r = run(["create", a, b, "--out", out, "--json"]);
    assert.equal(r.status, 0);
    const v = JSON.parse(r.stdout).validation;
    assert.equal(v.files.length, 2);
    assert.ok(v.gaps.some((g) => g.pointer.endsWith("/byteLength")));
    assert.equal(
      run(["validate", join(out, "intake.json"), "--json"]).status,
      0
    );
  }));
for (const [name, change, code] of [
  [
    "missing file",
    (v) => rmSync(join(v.out, "files/file-1")),
    "INTAKE.FILE_UNAVAILABLE",
  ],
  [
    "corrupt file",
    (v) =>
      writeFileSync(join(v.out, "files/file-1"), Buffer.from([0, 0, 0, 0])),
    "INTAKE.DIGEST",
  ],
  [
    "oversize declared file",
    (v) => {
      const p = JSON.parse(readFileSync(v.path));
      p.artifacts[0].byteLength = 256 * 1024 * 1024 + 1;
      writeFileSync(v.path, JSON.stringify(p));
    },
    "CLI.LIMIT",
  ],
  [
    "invalid schema",
    (v) => {
      const p = JSON.parse(readFileSync(v.path));
      p.score = 1;
      writeFileSync(v.path, JSON.stringify(p));
    },
    "INTAKE.STRUCTURE",
  ],
  [
    "symlink artifact",
    (v) => {
      rmSync(join(v.out, "files/file-1"));
      symlinkSync(v.input, join(v.out, "files/file-1"));
    },
    "CLI.FILE_READ",
  ],
  [
    "symlink files directory",
    (v) => {
      rmSync(join(v.out, "files"), { recursive: true });
      symlinkSync(dirname(v.input), join(v.out, "files"));
    },
    "CLI.FILES_DIRECTORY",
  ],
])
  test(name, () =>
    temp((dir) => {
      const v = create(dir);
      change(v);
      const r = run(["validate", v.path, "--json"]);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const output = JSON.parse(r.stdout);
      assert.ok(
        [...output.issues, ...(output.validation?.issues ?? [])].some(
          (i) => i.code === code
        )
      );
    })
  );
test("source symlinks are rejected without output", () =>
  temp((dir) => {
    writeFileSync(join(dir, "source"), "test");
    symlinkSync(join(dir, "source"), join(dir, "link"));
    const out = join(dir, "receipt");
    assert.equal(
      run(["create", join(dir, "link"), "--out", out, "--json"]).status,
      2
    );
    assert.equal(existsSync(out), false);
  }));
for (const args of [
  [],
  ["create"],
  ["validate"],
  ["inspect", "x", "--out", "y"],
  ["create", "x", "--out"],
  ["create", "x", "--out", "y", "--unknown"],
])
  test(`usage: ${args.join(" ")}`, () => {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.USAGE");
  });
test("malformed manifest returns structured read failure", () =>
  temp((dir) => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "{");
    const r = run(["validate", path, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.MANIFEST");
  }));
test("help explains receipt limits", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /256 MiB/);
});
