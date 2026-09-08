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
  const root = mkdtempSync(join(tmpdir(), "migration-apply-")),
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
const receipt = (out) => JSON.parse(readFileSync(join(out, "receipt.json")));
function interrupt(v, midWrite = false) {
  const shim = join(v.root, "interrupt.cjs");
  const code = midWrite
    ? `const original=fs.writeFileSync;fs.writeFileSync=function(fd,data,...rest){if(typeof fd==='number' && Buffer.from(data).equals(fs.readFileSync(process.env.RESOLUTION_FILE))){fs.writeSync(fd,Buffer.from(data).subarray(0,20));process.exit(92);}return original.call(this,fd,data,...rest);};`
    : `const original=fs.linkSync;fs.linkSync=function(from,to){const result=original.call(this,from,to);if(to.endsWith('/resolution.json'))process.exit(91);return result;};`;
  writeFileSync(
    shim,
    `const fs=require('node:fs');${code}require('node:module').syncBuiltinESMExports();`
  );
  const r = spawnSync(
    process.execPath,
    ["--require", shim, cli, "migrate", ...v.args, "--json"],
    {
      encoding: "utf8",
      timeout: 20000,
      env: { ...process.env, RESOLUTION_FILE: v.path },
    }
  );
  assert.equal(r.status, midWrite ? 92 : 91, r.stderr);
  assert.equal(existsSync(join(v.out, "receipt.json")), false);
}

test("local apply preserves full history and publishes a pinned receipt last", () =>
  setup(
    (v) => {
      const r = v.apply();
      assert.equal(r.status, 0, r.stdout);
      assert.equal(r.body.action, "applied");
      const p = receipt(v.out);
      assert.equal(p.counts.appliedCandidates, 1);
      assert.equal(p.counts.retainedHistoricalRows, 1);
      assert.equal(p.counts.indexImported, 0);
      assert.equal(p.readPath, "not_activated");
      assert.deepEqual(
        r.body.receipt,
        pin(readFileSync(join(v.out, "receipt.json")))
      );
      for (const f of p.files) {
        assert.deepEqual(pin(readFileSync(join(v.out, f.path))), {
          sha256: f.sha256,
          byteLength: f.byteLength,
        });
        assert.equal(statSync(join(v.out, f.path)).mode & 0o777, 0o600);
      }
      const c = JSON.parse(readFileSync(join(v.out, p.candidates[0].path)));
      assert.equal(parseExperimentalClaimHistory(c).success, true);
      assert.equal(
        JSON.parse(readFileSync(join(v.out, "ledger/ledger.json")))
          .identities[0].revisions.length,
        2
      );
      assert.equal(v.verify().status, 0);
      assert.equal(statSync(v.out).mode & 0o777, 0o700);
    },
    { conflict: true }
  ));

test("exact application rerun is a no-write reuse", () =>
  setup((v) => {
    v.apply();
    const file = join(v.out, "receipt.json"),
      before = statSync(file).mtimeMs;
    assert.equal(v.apply().body.action, "reused");
    assert.equal(statSync(file).mtimeMs, before);
  }));

for (const midWrite of [false, true])
  test(
    "resume after actual process interruption " +
      (midWrite ? "during file write" : "between files"),
    () =>
      setup((v) => {
        interrupt(v, midWrite);
        assert.ok(readdirSync(join(v.out, ".pending")).length);
        const before = statSync(join(v.out, "intent.json")).mtimeMs;
        const r = v.apply();
        assert.equal(r.status, 0, r.stdout);
        assert.equal(r.body.action, "resumed");
        assert.equal(statSync(join(v.out, "intent.json")).mtimeMs, before);
        assert.equal(v.verify().status, 0);
      })
  );

test("completed application verifies without original source directories", () =>
  setup((v) => {
    v.apply();
    rmSync(v.ledger, { recursive: true });
    rmSync(v.path);
    assert.equal(v.verify().status, 0);
  }));

test("changed decisions conflict with existing intent without changing files", () =>
  setup((v) => {
    interrupt(v);
    v.plan.decisions[0].rationale += " Changed.";
    writeFileSync(v.path, JSON.stringify(v.plan));
    const before = readFileSync(join(v.out, "intent.json"));
    assert.equal(v.apply().status, 2);
    assert.deepEqual(readFileSync(join(v.out, "intent.json")), before);
    assert.equal(existsSync(join(v.out, "receipt.json")), false);
  }));

for (const missing of [false, true])
  test(
    "completed store corruption is not automatically repaired " + missing,
    () =>
      setup((v) => {
        v.apply();
        const p = receipt(v.out),
          path = join(v.out, p.candidates[0].path);
        if (missing) rmSync(path);
        else writeFileSync(path, "{}");
        assert.equal(v.apply().status, 2);
        assert.equal(v.verify().status, 2);
        if (!missing) assert.equal(readFileSync(path, "utf8"), "{}");
      })
  );

test("partial store conflicting bytes block all resume writes", () =>
  setup((v) => {
    interrupt(v);
    writeFileSync(join(v.out, "resolution.json"), "{}");
    assert.equal(v.apply().status, 2);
    assert.equal(existsSync(join(v.out, "receipt.json")), false);
  }));

test("unknown or conflicting temporary content is rejected", () =>
  setup((v) => {
    interrupt(v, true);
    const pending = join(
      v.out,
      ".pending",
      readdirSync(join(v.out, ".pending"))[0]
    );
    writeFileSync(pending, "not a prefix");
    assert.equal(v.apply().status, 2);
    assert.equal(existsSync(join(v.out, "receipt.json")), false);
  }));

test("unresolved identities are not applied", () =>
  setup((v) => {
    v.plan.decisions = [];
    writeFileSync(v.path, JSON.stringify(v.plan));
    assert.equal(v.apply().status, 2);
    assert.equal(existsSync(v.out), false);
  }));

test("pending/quarantined source rows block local application", () =>
  setup(
    (v) => {
      assert.equal(v.apply().status, 2);
      assert.equal(existsSync(v.out), false);
    },
    { mixed: true }
  ));

test("unrecognized destination, symlink artifacts and public permissions are rejected", () =>
  setup((v) => {
    const r = v.apply();
    assert.equal(r.status, 0);
    const alias = join(v.root, "alias");
    symlinkSync(v.out, alias);
    assert.equal(run(["apply-verify", alias]).status, 2);
    chmodSync(join(v.out, "intent.json"), 0o644);
    assert.equal(v.verify().status, 2);
  }));

test("two identical resumes can publish without overwriting each other", () =>
  setup((v) => {
    interrupt(v);
    const script = join(v.root, "concurrent.cjs");
    writeFileSync(
      script,
      `const {spawn}=require('node:child_process'); const args=${JSON.stringify(
        [cli, "migrate", ...v.args, "--json"]
      )}; Promise.all([0,1].map(()=>new Promise(resolve=>{const child=spawn(process.execPath,args);let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('exit',code=>resolve({code,output}));}))).then(results=>{console.log(JSON.stringify(results));process.exit(results.some(r=>r.code!==0)?1:0);});`
    );
    const r = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(v.verify().status, 0);
  }));

test("existing unrecognized directory is preserved", () =>
  setup((v) => {
    mkdirSync(v.out, { mode: 0o700 });
    writeFileSync(join(v.out, "keep"), "original");
    assert.equal(v.apply().status, 2);
    assert.deepEqual(readdirSync(v.out), ["keep"]);
  }));
