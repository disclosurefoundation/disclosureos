import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  MigrationResolutionSchema,
  migrationResolutionJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
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
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ...r, body: JSON.parse(r.stdout) };
};
function setup(fn, { single = false, mixed = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "migration-resolution-")),
    bundles = [];
  for (let i = 0; i < (single ? 1 : 2); i++) {
    const v = migrationReviewExample();
    v.plan.decisions[0].rationale += " Batch " + i;
    const source = Buffer.from(
      JSON.stringify(
        mixed ? [v.legacy, { ...v.legacy, id: "pending" }, null] : v.legacy
      )
    );
    v.plan.source = pin(source);
    const s = join(root, "source" + i),
      p = join(root, "review" + i),
      b = join(root, "bundle" + i);
    writeFileSync(s, source);
    writeFileSync(p, JSON.stringify(v.plan));
    const result = run(["export", s, p, "--out", b]);
    assert.ok([0, 1].includes(result.status), result.stdout);
    bundles.push(b);
  }
  const ledger = join(root, "ledger"),
    r = run(["ledger", ...bundles, "--out", ledger]);
  assert.ok([0, 1].includes(r.status), r.stdout);
  const ledgerBytes = readFileSync(join(ledger, "ledger.json")),
    inventory = JSON.parse(ledgerBytes),
    identity = inventory.identities[0];
  const plan = {
    kind: "legacy_migration_resolution",
    schemaVersion: "0.1.0",
    ledger: pin(ledgerBytes),
    decidedBy: "Synthetic reviewer",
    decidedAt: "2026-09-08T00:00:00Z",
    decisions: [
      {
        identity: identity.identity,
        action: "select",
        revision: identity.revisions[0].sha256,
        rationale:
          "Synthetic application choice; no scientific preference implied.",
      },
    ],
  };
  const path = join(root, "resolution.json");
  const resolve = (p = plan, raw) => {
    writeFileSync(path, raw ?? JSON.stringify(p));
    return run(["resolve", ledger, path]);
  };
  try {
    fn({ root, ledger, ledgerBytes, inventory, identity, plan, path, resolve });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("schema artifact and independent plan validation agree", () => {
  const schema = migrationResolutionJsonSchema();
  assert.deepEqual(
    schema,
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/migration-resolution-0.1.0.schema.json",
          import.meta.url
        )
      )
    )
  );
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const check = ajv.compile(schema);
  const p = {
    kind: "legacy_migration_resolution",
    schemaVersion: "0.1.0",
    ledger: { sha256: "a".repeat(64), byteLength: 1 },
    decidedBy: "Synthetic",
    decidedAt: "2026-09-08T00:00:00Z",
    decisions: [],
  };
  assert.equal(check(p), true);
  assert.equal(MigrationResolutionSchema.safeParse(p).success, true);
  for (const change of [
    (p) => (p.decidedAt = "2026-09-08T00:00:00.1Z"),
    (p) => (p.extra = true),
    (p) => (p.decidedBy = " "),
  ]) {
    const bad = structuredClone(p);
    change(bad);
    assert.equal(check(bad), false);
    assert.equal(MigrationResolutionSchema.safeParse(bad).success, false);
  }
});

test("explicit selection retains competing revisions and exact plan without changing the ledger", () =>
  setup((v) => {
    const before = readdirSync(v.ledger),
      result = v.resolve();
    assert.equal(result.status, 0, result.stdout);
    const report = result.body;
    assert.equal(report.counts.selectedCandidates, 1);
    assert.equal(report.counts.selectedRows, 1);
    assert.equal(report.counts.notSelectedRows, 1);
    assert.equal(report.counts.migrated, 0);
    assert.equal(report.identities[0].ledgerStatus, "conflict");
    assert.equal(report.identities[0].revisions.length, 2);
    assert.equal(
      report.selected[0].candidate.sha256,
      v.plan.decisions[0].revision
    );
    assert.deepEqual(
      pin(readFileSync(join(v.ledger, report.selected[0].path))),
      report.selected[0].candidate
    );
    assert.deepEqual(
      Buffer.from(report.plan.bytes, "base64"),
      readFileSync(v.path)
    );
    assert.deepEqual(report.ledger, pin(v.ledgerBytes));
    assert.deepEqual(
      readFileSync(join(v.ledger, "ledger.json")),
      v.ledgerBytes
    );
    assert.deepEqual(readdirSync(v.ledger), before);
    assert.equal(report.decisionIdentity, "not_authenticated");
    assert.equal(report.applicationStatus, "not_imported");
    assert.deepEqual(v.resolve().body, report);
  }));

test("deferring keeps every revision and produces no selected candidate", () =>
  setup((v) => {
    v.plan.decisions = [
      {
        identity: v.identity.identity,
        action: "defer",
        rationale: "Need additional provenance.",
      },
    ];
    const r = v.resolve();
    assert.equal(r.status, 1);
    assert.equal(r.body.counts.deferredRows, 2);
    assert.deepEqual(r.body.selected, []);
  }));

test("omitted conflicts remain unresolved", () =>
  setup((v) => {
    v.plan.decisions = [];
    const r = v.resolve();
    assert.equal(r.status, 1);
    assert.equal(r.body.counts.unresolvedRows, 2);
    assert.deepEqual(r.body.selected, []);
  }));

test("nonconflicting identity is not automatically selected", () =>
  setup(
    (v) => {
      v.plan.decisions = [];
      const r = v.resolve();
      assert.equal(r.status, 1);
      assert.equal(
        r.body.identities[0].ledgerStatus,
        "ready_for_import_review"
      );
      assert.equal(r.body.counts.unresolvedRows, 1);
    },
    { single: true }
  ));

for (const [name, change] of [
  ["stale digest", (p) => (p.ledger.sha256 = "b".repeat(64))],
  ["stale byte length", (p) => p.ledger.byteLength++],
  [
    "unknown identity",
    (p) => (p.decisions[0].identity = "legacy-" + "b".repeat(64)),
  ],
  ["unknown revision", (p) => (p.decisions[0].revision = "b".repeat(64))],
  ["duplicate decision", (p) => p.decisions.push(p.decisions[0])],
  ["blank rationale", (p) => (p.decisions[0].rationale = " ")],
  ["unsupported action", (p) => (p.decisions[0].action = "merge")],
])
  test(name + " rejects the complete plan", () =>
    setup(
      (v) => {
        change(v.plan);
        const r = v.resolve();
        assert.equal(r.status, 2, r.stdout);
        assert.equal(r.body.stage, "migration_resolution");
        assert.equal(r.body.selected, undefined);
      },
      { single: true }
    )
  );

test("pending and quarantined input rows survive resolution accounting", () =>
  setup(
    (v) => {
      const r = v.resolve();
      assert.equal(r.status, 1);
      const c = r.body.counts;
      assert.equal(
        c.input,
        c.selectedRows +
          c.notSelectedRows +
          c.deferredRows +
          c.unresolvedRows +
          c.pendingReview +
          c.quarantined
      );
      assert.equal(c.pendingReview, 1);
      assert.equal(c.quarantined, 1);
      assert.equal(r.body.receipts[0].rows.length, 3);
    },
    { single: true, mixed: true }
  ));

test("tampered ledger blocks a pinned plan", () =>
  setup(
    (v) => {
      writeFileSync(join(v.ledger, "ledger.json"), "{}");
      assert.equal(v.resolve().status, 2);
    },
    { single: true }
  ));

test("duplicate JSON keys and oversized plans are rejected", () =>
  setup(
    (v) => {
      const raw = JSON.stringify(v.plan).replace(
        '"decidedBy":',
        '"decidedBy":"Other", "decidedBy":'
      );
      assert.equal(v.resolve(v.plan, raw).status, 2);
      assert.equal(
        v.resolve(v.plan, " ".repeat(2 * 1024 * 1024 + 1)).status,
        2
      );
    },
    { single: true }
  ));

test("symlink plans and ledger roots are rejected", () =>
  setup(
    (v) => {
      v.resolve();
      const p = join(v.root, "plan-link");
      symlinkSync(v.path, p);
      assert.equal(run(["resolve", v.ledger, p]).status, 2);
      const l = join(v.root, "ledger-link");
      symlinkSync(v.ledger, l);
      assert.equal(run(["resolve", l, v.path]).status, 2);
    },
    { single: true }
  ));
