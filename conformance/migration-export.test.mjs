import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
  symlinkSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { migrationReviewExample } from "../examples/v2/migration-review-demo.mjs";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: Buffer.byteLength(bytes),
});
const run = (args) => {
  const r = spawnSync(process.execPath, [cli, "migrate", ...args, "--json"], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  return { ...r, body: JSON.parse(r.stdout) };
};
function setup(fn) {
  const root = mkdtempSync(join(tmpdir(), "migration-export-"));
  const v = migrationReviewExample(),
    source = join(root, "source.json"),
    review = join(root, "review.json"),
    out = join(root, "bundle");
  writeFileSync(source, v.sourceBytes);
  writeFileSync(review, JSON.stringify(v.plan));
  try {
    fn({
      ...v,
      root,
      source,
      review,
      out,
      export: () => run(["export", source, review, "--out", out]),
      verify: () => run(["verify", out]),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("private export pins every artifact, retains source bytes and exports validated reviewed candidates", () =>
  setup((v) => {
    const result = v.export();
    assert.equal(result.status, 0, result.stdout);
    assert.equal(result.body.action, "created");
    const manifest = JSON.parse(readFileSync(join(v.out, "manifest.json")));
    assert.deepEqual(manifest.counts, {
      input: 1,
      exported: 1,
      pendingReview: 0,
      quarantined: 0,
      migrated: 0,
    });
    assert.deepEqual(
      result.body.manifest,
      pin(readFileSync(join(v.out, "manifest.json")))
    );
    assert.equal(statSync(v.out).mode & 0o777, 0o700);
    for (const file of manifest.files) {
      const bytes = readFileSync(join(v.out, file.path));
      assert.deepEqual(pin(bytes), {
        sha256: file.sha256,
        byteLength: file.byteLength,
      });
      assert.equal(statSync(join(v.out, file.path)).mode & 0o777, 0o600);
    }
    assert.deepEqual(readFileSync(join(v.out, "source.json")), v.sourceBytes);
    const candidate = JSON.parse(
      readFileSync(join(v.out, manifest.rows[0].path))
    );
    assert.equal(parseExperimentalClaimHistory(candidate).success, true);
    assert.deepEqual(candidate.claims, []);
    assert.equal(v.verify().body.action, "verified");
  }));

test("identical rerun reuses files without changing content or modification times", () =>
  setup((v) => {
    v.export();
    const file = join(v.out, "manifest.json"),
      before = statSync(file).mtimeMs,
      bytes = readFileSync(file);
    const result = v.export();
    assert.equal(result.status, 0);
    assert.equal(result.body.action, "reused");
    assert.equal(statSync(file).mtimeMs, before);
    assert.deepEqual(readFileSync(file), bytes);
  }));

test("changed review conflicts with an existing bundle without overwriting", () =>
  setup((v) => {
    v.export();
    const before = readFileSync(join(v.out, "manifest.json"));
    v.plan.decisions[0].rationale += " Revised.";
    writeFileSync(v.review, JSON.stringify(v.plan));
    assert.equal(v.export().status, 2);
    assert.deepEqual(readFileSync(join(v.out, "manifest.json")), before);
    assert.equal(v.verify().status, 0);
  }));

for (const file of [
  "source.json",
  "review.json",
  "report.json",
  "manifest.json",
  "candidate",
])
  test(file + " tampering is detected without repairs", () =>
    setup((v) => {
      v.export();
      const manifest = JSON.parse(readFileSync(join(v.out, "manifest.json")));
      const path = join(
        v.out,
        file === "candidate" ? manifest.rows[0].path : file
      );
      writeFileSync(path, "{}");
      assert.equal(v.verify().status, 2);
      assert.equal(v.export().status, 2);
      assert.equal(readFileSync(path, "utf8"), "{}");
    })
  );

test("mixed rows reconcile exported, pending and quarantined without omissions", () =>
  setup((v) => {
    const bytes = Buffer.from(
      JSON.stringify([v.legacy, { ...v.legacy, id: "pending" }, null])
    );
    v.plan.source = pin(bytes);
    writeFileSync(v.source, bytes);
    writeFileSync(v.review, JSON.stringify(v.plan));
    const result = v.export();
    assert.equal(result.status, 1, result.stdout);
    assert.equal(result.body.success, true);
    assert.deepEqual(result.body.counts, {
      input: 3,
      exported: 1,
      pendingReview: 1,
      quarantined: 1,
      migrated: 0,
    });
    const manifest = JSON.parse(readFileSync(join(v.out, "manifest.json")));
    assert.deepEqual(
      manifest.rows.map((row) => row.sourcePointer),
      ["/0", "/1", "/2"]
    );
    assert.deepEqual(
      manifest.rows.map((row) => row.disposition),
      ["exported", "pending_review", "quarantined"]
    );
    assert.equal(readdirSync(join(v.out, "candidates")).length, 1);
    assert.equal(v.verify().status, 1);
    assert.equal(v.export().body.action, "reused");
  }));

test("rejected reviews export no candidate, but preserve the quarantine report", () =>
  setup((v) => {
    v.plan.decisions[1].frames = [];
    writeFileSync(v.review, JSON.stringify(v.plan));
    const result = v.export();
    assert.equal(result.status, 1);
    assert.equal(result.body.counts.exported, 0);
    assert.deepEqual(readdirSync(join(v.out, "candidates")), []);
    assert.equal(v.verify().status, 1);
  }));

test("invalid source pin creates no directory", () =>
  setup((v) => {
    writeFileSync(v.source, "{}");
    assert.equal(v.export().status, 2);
    assert.equal(existsSync(v.out), false);
  }));

test("existing nonbundle directory is a conflict and survives unchanged", () =>
  setup((v) => {
    mkdirSync(v.out, { mode: 0o700 });
    writeFileSync(join(v.out, "keep"), "original");
    assert.equal(v.export().status, 2);
    assert.deepEqual(readdirSync(v.out), ["keep"]);
  }));

test("unexpected files and missing candidates are conflicts", () =>
  setup((v) => {
    v.export();
    const extra = join(v.out, "extra");
    writeFileSync(extra, "keep");
    assert.equal(v.verify().status, 2);
    rmSync(extra);
    const candidate = readdirSync(join(v.out, "candidates"))[0];
    rmSync(join(v.out, "candidates", candidate));
    assert.equal(v.export().status, 2);
  }));

test("symlink bundles, symlink artifacts and public permissions are rejected", () =>
  setup((v) => {
    v.export();
    const alias = join(v.root, "alias");
    symlinkSync(v.out, alias);
    assert.equal(run(["verify", alias]).status, 2);
    assert.equal(run(["export", v.source, v.review, "--out", alias]).status, 2);
    chmodSync(join(v.out, "manifest.json"), 0o644);
    assert.equal(v.verify().status, 2);
    chmodSync(join(v.out, "manifest.json"), 0o600);
    rmSync(join(v.out, "source.json"));
    symlinkSync(v.source, join(v.out, "source.json"));
    assert.equal(v.verify().status, 2);
  }));

test("usage mistakes do not create a bundle", () =>
  setup((v) => {
    assert.equal(run(["export", v.source, v.review]).status, 2);
    assert.equal(run(["verify", v.out, "--out", "elsewhere"]).status, 2);
    assert.equal(existsSync(v.out), false);
  }));
