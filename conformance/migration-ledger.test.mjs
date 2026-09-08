import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
  chmodSync,
  symlinkSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { migrationReviewExample } from "../examples/v2/migration-review-demo.mjs";
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
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  return { ...r, body: JSON.parse(r.stdout) };
};
function setup(fn) {
  const root = mkdtempSync(join(tmpdir(), "migration-ledger-"));
  let index = 0;
  const bundle = (edit = () => {}) => {
    const v = migrationReviewExample();
    edit(v);
    const source = JSON.stringify(v.legacy);
    v.plan.source = pin(source);
    const n = index++,
      s = join(root, `source-${n}.json`),
      p = join(root, `review-${n}.json`),
      out = join(root, `bundle-${n}`);
    writeFileSync(s, source);
    writeFileSync(p, JSON.stringify(v.plan));
    const result = run(["export", s, p, "--out", out]);
    assert.ok([0, 1].includes(result.status), result.stdout);
    return out;
  };
  const out = join(root, "ledger"),
    ledger = (paths) => run(["ledger", ...paths, "--out", out]),
    verify = () => run(["ledger-verify", out]);
  try {
    fn({ root, out, bundle, ledger, verify });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const read = (out) => JSON.parse(readFileSync(join(out, "ledger.json")));

test("self-contained staging receipts pin inputs and survive original bundle removal", () =>
  setup((v) => {
    const b = v.bundle(),
      result = v.ledger([b]);
    assert.equal(result.status, 0, result.stdout);
    const l = read(v.out);
    assert.equal(l.counts.stagedRows, 1);
    assert.equal(l.counts.migrated, 0);
    assert.equal(l.receipts.length, 1);
    assert.equal(l.identities[0].status, "ready_for_import_review");
    assert.equal(statSync(v.out).mode & 0o777, 0o700);
    for (const f of l.files) {
      assert.deepEqual(pin(readFileSync(join(v.out, f.path))), {
        sha256: f.sha256,
        byteLength: f.byteLength,
      });
      assert.equal(statSync(join(v.out, f.path)).mode & 0o777, 0o600);
    }
    rmSync(b, { recursive: true });
    assert.equal(v.verify().status, 0);
  }));

test("repeated identical bundles deduplicate and exact reruns do not rewrite", () =>
  setup((v) => {
    const b = v.bundle();
    assert.equal(v.ledger([b, b]).status, 0);
    const l = read(v.out);
    assert.equal(l.counts.bundles, 1);
    assert.equal(l.counts.input, 1);
    const before = statSync(join(v.out, "ledger.json")).mtimeMs;
    assert.equal(v.ledger([b]).body.action, "reused");
    assert.equal(statSync(join(v.out, "ledger.json")).mtimeMs, before);
  }));

test("different revisions conflict on all affected rows, retain both versions and are order independent", () =>
  setup((v) => {
    const a = v.bundle(),
      b = v.bundle((f) => (f.plan.decisions[0].rationale += " Revised."));
    const result = v.ledger([a, b]);
    assert.equal(result.status, 1, result.stdout);
    const l = read(v.out);
    assert.equal(l.counts.conflictingIdentities, 1);
    assert.equal(l.counts.conflictRows, 2);
    assert.equal(l.counts.stagedRows, 0);
    assert.equal(l.identities[0].revisions.length, 2);
    assert.ok(l.receipts.every((r) => r.rows[0].status === "conflict"));
    assert.equal(v.ledger([b, a]).body.action, "reused");
    assert.equal(v.verify().status, 1);
  }));

test("same original ID in different namespaces remains distinct", () =>
  setup((v) => {
    const a = v.bundle(),
      b = v.bundle((f) => (f.plan.namespace = "other-archive"));
    assert.equal(v.ledger([a, b]).status, 0);
    assert.equal(read(v.out).counts.identities, 2);
    assert.equal(read(v.out).counts.conflictingIdentities, 0);
  }));

test("adding another batch never overwrites an existing snapshot", () =>
  setup((v) => {
    const a = v.bundle(),
      b = v.bundle((f) => (f.plan.namespace = "other"));
    v.ledger([a]);
    const before = readFileSync(join(v.out, "ledger.json"));
    assert.equal(v.ledger([a, b]).status, 2);
    assert.deepEqual(readFileSync(join(v.out, "ledger.json")), before);
    assert.equal(v.verify().status, 0);
  }));

test("pending and quarantined rows reconcile with staged and conflicting rows", () =>
  setup((v) => {
    const a = v.bundle(
      (f) => (f.legacy = [f.legacy, { ...f.legacy, id: "pending" }, null])
    );
    const result = v.ledger([a]);
    assert.equal(result.status, 1, result.stdout);
    const c = read(v.out).counts;
    assert.equal(
      c.input,
      c.stagedRows + c.conflictRows + c.pendingReview + c.quarantined
    );
    assert.equal(c.pendingReview, 1);
    assert.equal(c.quarantined, 1);
    assert.equal(v.verify().status, 1);
  }));

test("invalid source bundle is rejected before ledger creation", () =>
  setup((v) => {
    const b = v.bundle();
    writeFileSync(join(b, "manifest.json"), "{}");
    assert.equal(v.ledger([b]).status, 2);
    assert.equal(existsSync(v.out), false);
  }));

for (const part of ["ledger", "candidate", "review"])
  test(part + " tampering is detected without repair", () =>
    setup((v) => {
      v.ledger([v.bundle()]);
      const l = read(v.out);
      const path =
        part === "ledger"
          ? "ledger.json"
          : part === "candidate"
          ? l.identities[0].revisions[0].occurrences[0].path
          : `inputs/${l.receipts[0].bundleId}/review.json`;
      writeFileSync(join(v.out, path), "{}");
      assert.equal(v.verify().status, 2);
      assert.equal(readFileSync(join(v.out, path), "utf8"), "{}");
    })
  );

test("unexpected entries and renamed input directories are rejected", () =>
  setup((v) => {
    v.ledger([v.bundle()]);
    writeFileSync(join(v.out, "extra"), "keep");
    assert.equal(v.verify().status, 2);
    rmSync(join(v.out, "extra"));
    mkdirSync(join(v.out, "inputs", "invalid"), { mode: 0o700 });
    assert.equal(v.verify().status, 2);
  }));

test("symlink roots and public ledger artifacts are rejected", () =>
  setup((v) => {
    const b = v.bundle();
    v.ledger([b]);
    const alias = join(v.root, "alias");
    symlinkSync(v.out, alias);
    assert.equal(run(["ledger-verify", alias]).status, 2);
    assert.equal(run(["ledger", b, "--out", alias]).status, 2);
    chmodSync(join(v.out, "ledger.json"), 0o644);
    assert.equal(v.verify().status, 2);
  }));

test("usage and input-count budgets fail without creating output", () =>
  setup((v) => {
    assert.equal(v.ledger([]).status, 2);
    assert.equal(v.ledger(Array(17).fill("absent")).status, 2);
    assert.equal(existsSync(v.out), false);
  }));
