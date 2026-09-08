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
  existsSync,
  chmodSync,
  mkdirSync,
  renameSync,
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
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  return { ...r, body: JSON.parse(r.stdout) };
};
function setup(fn, { conflict = false, mixed = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "migration-read-")),
    bundles = [];
  for (let i = 0; i < (conflict ? 2 : 1); i++) {
    const v = migrationReviewExample();
    v.plan.decisions[0].rationale += " " + i;
    const bytes = Buffer.from(
      JSON.stringify(
        mixed ? [v.legacy, { ...v.legacy, id: "pending" }, null] : v.legacy
      )
    );
    v.plan.source = pin(bytes);
    const s = join(root, "source" + i),
      p = join(root, "review" + i),
      b = join(root, "bundle" + i);
    writeFileSync(s, bytes);
    writeFileSync(p, JSON.stringify(v.plan));
    const result = run(["export", s, p, "--out", b]);
    assert.ok([0, 1].includes(result.status), result.stdout);
    bundles.push(b);
  }
  const ledger = join(root, "ledger");
  const l = run(["ledger", ...bundles, "--out", ledger]);
  assert.ok([0, 1].includes(l.status));
  const bytes = readFileSync(join(ledger, "ledger.json")),
    inventory = JSON.parse(bytes),
    identity = inventory.identities[0];
  const plan = {
    kind: "legacy_migration_resolution",
    schemaVersion: "0.1.0",
    ledger: pin(bytes),
    decidedBy: "Synthetic",
    decidedAt: "2026-09-08T00:00:00Z",
    decisions: [
      {
        identity: identity.identity,
        action: "select",
        revision: identity.revisions[0].sha256,
        rationale: "Synthetic local application choice.",
      },
    ],
  };
  const path = join(root, "resolution.json"),
    out = join(root, "store");
  writeFileSync(path, JSON.stringify(plan));
  const args = ["apply", ledger, path, "--out", out],
    apply = () => run(args),
    verify = () => run(["apply-verify", out]);
  try {
    fn({ root, ledger, plan, path, out, args, apply, verify });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const ok = (r) => {
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.body;
};
function selector(v) {
  const path = join(v.root, "selector");
  const initial = ok(run(["read-init", "--out", path]));
  ok(v.apply());
  const activate = (head = initial.head, store = v.out) =>
    run(["read-activate", path, store, "--id", head]);
  const rollback = (head, earlier = initial.head) =>
    run(["read-rollback", path, earlier, "--id", head]);
  const read = () => run(["read-path", path]);
  return { path, initial, activate, rollback, read };
}
test("activate returns exact verified candidates and rollback retains all store bytes", () =>
  setup(
    (v) => {
      const s = selector(v),
        before = readFileSync(join(v.out, "receipt.json"));
      assert.equal(s.initial.target.kind, "legacy");
      assert.deepEqual(s.initial.candidates, []);
      const active = ok(s.activate());
      assert.equal(active.target.kind, "local_store");
      const receipt = JSON.parse(before);
      assert.deepEqual(
        active.candidates[0].candidate,
        JSON.parse(readFileSync(join(v.out, receipt.candidates[0].path)))
      );
      assert.equal(
        parseExperimentalClaimHistory(active.candidates[0].candidate).success,
        true
      );
      const back = ok(s.rollback(active.head));
      assert.equal(back.target.kind, "legacy");
      assert.equal(back.history.length, 3);
      assert.deepEqual(readFileSync(join(v.out, "receipt.json")), before);
      assert.equal(v.verify().status, 0);
      const restored = ok(s.rollback(back.head, active.head));
      assert.deepEqual(restored.candidates, active.candidates);
      assert.equal(restored.indexImported, 0);
    },
    { conflict: true }
  ));

test("stale activation and rollback cannot change the current head", () =>
  setup((v) => {
    const s = selector(v),
      a = ok(s.activate());
    assert.equal(s.activate().status, 2);
    assert.equal(s.rollback(s.initial.head).status, 2);
    assert.equal(ok(s.read()).head, a.head);
  }));

test("read fails closed for changed active data but legacy rollback remains possible", () =>
  setup((v) => {
    const s = selector(v),
      a = ok(s.activate());
    const receipt = JSON.parse(readFileSync(join(v.out, "receipt.json")));
    writeFileSync(join(v.out, receipt.candidates[0].path), "{}");
    assert.equal(s.read().status, 2);
    const back = ok(s.rollback(a.head));
    assert.equal(back.target.kind, "legacy");
    assert.equal(s.rollback(back.head, a.head).status, 2);
    assert.equal(ok(s.read()).head, back.head);
  }));

test("incomplete store cannot activate", () =>
  setup((v) => {
    const s = selector(v);
    rmSync(join(v.out, "receipt.json"));
    assert.equal(s.activate().status, 2);
    assert.equal(ok(s.read()).head, s.initial.head);
  }));

test("unknown and current rollback targets fail without a transition", () =>
  setup((v) => {
    const s = selector(v),
      a = ok(s.activate());
    assert.equal(s.rollback(a.head, "f".repeat(64)).status, 2);
    assert.equal(s.rollback(a.head, a.head).status, 2);
    assert.equal(ok(s.read()).history.length, 2);
  }));

for (const mode of ["changed", "gap", "extra", "public", "symlink"])
  test("selector integrity rejects " + mode, () =>
    setup((v) => {
      const s = selector(v);
      ok(s.activate());
      const file = join(s.path, "000000.json");
      if (mode === "changed") {
        const data = JSON.parse(readFileSync(file));
        data.extra = true;
        writeFileSync(file, JSON.stringify(data));
      }
      if (mode === "gap") rmSync(file);
      if (mode === "extra") writeFileSync(join(s.path, "other"), "{}");
      if (mode === "public") chmodSync(file, 0o644);
      if (mode === "symlink") {
        const dest = join(v.root, "saved");
        writeFileSync(dest, readFileSync(file), { mode: 0o600 });
        rmSync(file);
        symlinkSync(dest, file);
      }
      assert.equal(s.read().status, 2);
    })
  );

test("initialization never overwrites existing directories", () =>
  setup((v) => {
    const s = selector(v);
    assert.equal(run(["read-init", "--out", s.path]).status, 2);
    assert.equal(ok(s.read()).head, s.initial.head);
  }));

for (const after of [false, true])
  test(
    "actual process interruption " +
      (after ? "after" : "before") +
      " transition publication",
    () =>
      setup((v) => {
        const s = selector(v),
          shim = join(v.root, "stop.cjs");
        writeFileSync(
          shim,
          `const fs=require('node:fs');const link=fs.linkSync;fs.linkSync=function(a,b){if(b.endsWith('000001.json')){${
            after ? "link(a,b);" : ""
          }process.exit(91);}return link(a,b);};require('node:module').syncBuiltinESMExports();`
        );
        const r = spawnSync(
          process.execPath,
          [
            "--require",
            shim,
            cli,
            "migrate",
            "read-activate",
            s.path,
            v.out,
            "--id",
            s.initial.head,
            "--json",
          ],
          { encoding: "utf8", timeout: 20000 }
        );
        assert.equal(r.status, 91, r.stderr);
        const current = ok(s.read());
        assert.equal(current.target.kind, after ? "local_store" : "legacy");
        if (!after) ok(s.activate());
        else assert.equal(s.activate().status, 2);
      })
  );

test("concurrent transitions using the same expected head have exactly one winner", () =>
  setup((v) => {
    const s = selector(v),
      script = join(v.root, "race.cjs");
    writeFileSync(
      script,
      `const {spawn}=require('node:child_process');const args=${JSON.stringify([
        cli,
        "migrate",
        "read-activate",
        s.path,
        v.out,
        "--id",
        s.initial.head,
        "--json",
      ])};Promise.all([0,1].map(()=>new Promise(resolve=>{const c=spawn(process.execPath,args);c.stdout.resume();c.stderr.resume();c.on('exit',resolve);}))).then(codes=>console.log(JSON.stringify(codes)));`
    );
    const r = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).sort(), [0, 2]);
    assert.equal(ok(s.read()).history.length, 2);
  }));

test("a different valid application at the same path fails the original receipt pin", () =>
  setup((v) => {
    const s = selector(v),
      a = ok(s.activate());
    renameSync(v.out, join(v.root, "retained-original"));
    v.plan.decisions[0].rationale += " Another explicit decision.";
    writeFileSync(v.path, JSON.stringify(v.plan));
    ok(v.apply());
    assert.equal(v.verify().status, 0);
    const failed = s.read();
    assert.equal(failed.status, 2);
    assert.match(failed.body.error, /receipt/);
    assert.equal(failed.body.head, a.head);
    assert.equal(ok(s.rollback(a.head)).target.kind, "legacy");
  }));
