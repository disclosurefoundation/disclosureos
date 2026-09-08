import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { evaluateDatasetRelease } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const cli = fileURLToPath(
    new URL("../packages/disclosureos-cli/dist/index.js", import.meta.url)
  ),
  source = fileURLToPath(
    new URL("../examples/v2/dataset-demo/", import.meta.url)
  );
const run = (args) =>
  spawnSync(process.execPath, [cli, "dataset", ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
function temp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-dataset-"));
  try {
    cpSync(source, dir, { recursive: true });
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("CLI preserves the exact dataset validator result", async () => {
  const release = JSON.parse(readFileSync(join(source, "dataset.json")));
  const packets = new Map(
    release.packets.map((e) => {
      const folder = join(source, "packets", e.id),
        manifest = new Uint8Array(readFileSync(join(folder, "packet.json"))),
        p = JSON.parse(new TextDecoder().decode(manifest));
      return [
        e.id,
        {
          manifest,
          files: new Map(
            p.files.map((f) => [
              f.id,
              new Uint8Array(readFileSync(join(folder, "files", f.id))),
            ])
          ),
        },
      ];
    })
  );
  const expected = await evaluateDatasetRelease(release, { packets });
  const r = run(["validate", join(source, "dataset.json"), "--json"]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout).validation, expected);
});
test("inspect reads no packet assets", () =>
  temp((dir) => {
    rmSync(join(dir, "packets"), { recursive: true });
    const r = run(["inspect", join(dir, "dataset.json"), "--json"]);
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).inspection.membership, "not_checked");
  }));
test("missing packet exits nonzero and stays unchecked", () =>
  temp((dir) => {
    rmSync(join(dir, "packets", "background"), { recursive: true });
    const r = run(["validate", join(dir, "dataset.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).validation.checks.profile, "not_checked");
  }));
test("corrupt packet never passes", () =>
  temp((dir) => {
    writeFileSync(join(dir, "packets", "background", "packet.json"), "{}");
    const r = run(["validate", join(dir, "dataset.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).validation.checks.profile, "failed");
  }));
test("member directory symlinks are rejected", () =>
  temp((dir) => {
    rmSync(join(dir, "packets", "background"), { recursive: true });
    symlinkSync(
      join(source, "packets", "background"),
      join(dir, "packets", "background")
    );
    const r = run(["validate", join(dir, "dataset.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.ok(JSON.parse(r.stdout).issues.length);
  }));
for (const args of [
  [],
  ["reproduce"],
  ["validate"],
  ["validate", "--strict", "x"],
  ["inspect", "a", "b"],
])
  test(`usage ${args}`, () => {
    const r = run([...args, "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.USAGE");
  });
test("help explains layout and limitations", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /packets\/<entry ID>/);
});
test("structured manifest error", () => {
  const r = run(["validate", "/nonexistent/dataset.json", "--json"]);
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.MANIFEST");
});
test("release packet count is bounded", () =>
  temp((dir) => {
    const p = JSON.parse(readFileSync(join(dir, "dataset.json")));
    p.packets = Array.from({ length: 129 }, (_, i) => ({
      ...p.packets[0],
      id: `p${i}`,
      packetId: `p${i}`,
    }));
    writeFileSync(join(dir, "dataset.json"), JSON.stringify(p));
    const r = run(["validate", join(dir, "dataset.json"), "--json"]);
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).issues[0].code, "CLI.LIMIT");
  }));
