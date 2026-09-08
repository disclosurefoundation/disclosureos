import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  MigrationCompatibilitySchema,
  migrationCompatibilityJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { migrationReviewExample } from "../examples/v2/migration-review-demo.mjs";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const pin = (b) => ({
  sha256: createHash("sha256").update(b).digest("hex"),
  byteLength: b.length,
});
const blob = (b) => ({ ...pin(b), bytes: b.toString("base64") });
function fixture() {
  const legacy = migrationReviewExample().legacy;
  legacy.sensorEvidence = {
    sensors: [
      {
        id: "radar",
        sensorType: "ground_radar",
        detectionMethod: "radar_primary",
        sensorRef: "synthetic:radar",
        calibrated: true,
        readings: { velocity: 0 },
      },
    ],
  };
  legacy.internalNotes = "Private synthetic notes";
  const source = Buffer.from(JSON.stringify(legacy));
  const context = readFileSync(
    new URL(
      "../examples/v2/acquisition-binding-demo/context.json",
      import.meta.url
    )
  );
  const manifest = readFileSync(
    new URL(
      "../examples/v2/acquisition-binding-demo/assets/manifest-r1.txt",
      import.meta.url
    )
  );
  const plan = {
    kind: "legacy_sensor_revision_review",
    schemaVersion: "0.1.0",
    namespace: "synthetic",
    source: pin(source),
    reviewedBy: "Synthetic reviewer",
    reviewedAt: "2026-09-08T00:00:00Z",
    context: blob(context),
    decisions: [
      {
        sourceId: legacy.id,
        sensorPointer: "/sensorEvidence/sensors/0/sensorRef",
        legacyRef: "synthetic:radar",
        acquisitionRef: "acquisition:a1",
        manifest: blob(manifest),
        provenance: blob(
          Buffer.from(
            "Synthetic association declaration: legacy synthetic:radar used acquisition:a1."
          )
        ),
        provenanceLocator: "Entire synthetic declaration",
        rationale: "Synthetic explicit association; not authenticated.",
      },
    ],
  };
  return { legacy, source, plan };
}
function setup(fn) {
  const root = mkdtempSync(join(tmpdir(), "migration-compat-"));
  const v = fixture();
  const run = (plan = v.plan, source = v.source) => {
    const file = join(root, "source.json");
    writeFileSync(file, source);
    const args = [file];
    if (plan) {
      const p = join(root, "review.json");
      writeFileSync(p, JSON.stringify(plan));
      args.push(p);
    }
    const r = spawnSync(
      process.execPath,
      [cli, "migrate", "compatibility", ...args, "--id", "synthetic", "--json"],
      { encoding: "utf8", timeout: 20000, maxBuffer: 32 * 1024 * 1024 }
    );
    return { ...r, body: JSON.parse(r.stdout) };
  };
  try {
    fn({ ...v, run, root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("inventory accounts for every leaf and preserves bytes without application changes", () =>
  setup((v) => {
    const r = v.run(null);
    assert.equal(r.status, 1, r.stdout);
    const c = r.body.counts;
    assert.equal(c.input, c.candidates + c.quarantined);
    assert.equal(
      c.fields,
      c.mapped + c.retainedWithoutConversion + c.unresolved
    );
    assert.equal(c.unresolvedSensorReferences, 1);
    assert.deepEqual(Buffer.from(r.body.source.bytes, "base64"), v.source);
    const fields = r.body.records[0].fields;
    assert.equal(
      fields.find((f) => f.pointer === "/internalNotes").disposition,
      "retained_without_conversion"
    );
    assert.equal(
      fields.find((f) => f.pointer === "/location/latitude").disposition,
      "unresolved"
    );
    assert.equal(
      fields.find((f) => f.pointer === "/sensorEvidence/sensors/0/calibrated")
        .disposition,
      "unresolved"
    );
    assert.equal(r.body.applicationChanges, "none");
    assert.deepEqual(readdirSync(v.root), ["source.json"]);
  }));
test("explicit provenance pins a revision without claiming calibration or conversion", () =>
  setup((v) => {
    const r = v.run();
    assert.equal(r.status, 1, r.stdout);
    const s = r.body.records[0].sensors[0];
    assert.equal(s.status, "reviewed_revision_pin");
    assert.equal(s.manifestRef, "manifest:r1");
    assert.equal(s.calibration, "not_checked");
    assert.equal(s.associationSupport, "reviewer_declared_not_verified");
    assert.equal(r.body.counts.reviewedRevisionPins, 1);
    assert.deepEqual(
      JSON.parse(Buffer.from(r.body.review.bytes, "base64")),
      v.plan
    );
    assert.deepEqual(v.run().body, r.body);
  }));
for (const mode of [
  "legacy-ref",
  "acquisition",
  "manifest-bytes",
  "provenance-bytes",
  "revision-pin",
])
  test("invalid sensor review remains unresolved: " + mode, () =>
    setup((v) => {
      const d = v.plan.decisions[0];
      if (mode === "legacy-ref") d.legacyRef = "other:radar";
      if (mode === "acquisition") d.acquisitionRef = "acquisition:missing";
      if (mode === "manifest-bytes")
        d.manifest = blob(Buffer.from("different manifest"));
      if (mode === "provenance-bytes") d.provenance.sha256 = "0".repeat(64);
      if (mode === "revision-pin") {
        const ctx = JSON.parse(Buffer.from(v.plan.context.bytes, "base64"));
        ctx.acquisitions[0].manifest = {
          state: "unresolved",
          reason: "No provenance",
          legacyRef: "synthetic:radar",
        };
        v.plan.context = blob(Buffer.from(JSON.stringify(ctx)));
      }
      const r = v.run();
      assert.equal(r.status, 1, r.stdout);
      assert.equal(r.body.counts.reviewedRevisionPins, 0);
      assert.equal(r.body.records[0].sensors[0].status, "unresolved");
    })
  );
for (const mode of [
  "duplicate",
  "unknown-pointer",
  "source-pin",
  "context-pin",
  "context-invalid",
  "missing-provenance",
  "ambiguous-row",
])
  test("invalid plan fails before producing report: " + mode, () =>
    setup((v) => {
      let source = v.source;
      if (mode === "duplicate") v.plan.decisions.push(v.plan.decisions[0]);
      if (mode === "unknown-pointer")
        v.plan.decisions[0].sensorPointer =
          "/sensorEvidence/sensors/99/sensorRef";
      if (mode === "source-pin") v.plan.source.sha256 = "0".repeat(64);
      if (mode === "context-pin") v.plan.context.sha256 = "0".repeat(64);
      if (mode === "context-invalid") v.plan.context = blob(Buffer.from("{}"));
      if (mode === "missing-provenance") delete v.plan.decisions[0].provenance;
      if (mode === "ambiguous-row") {
        source = Buffer.from(JSON.stringify([v.legacy, v.legacy]));
        v.plan.source = pin(source);
      }
      const r = v.run(v.plan, source);
      assert.equal(r.status, 2, r.stdout);
      assert.ok(!r.body.records);
    })
  );
test("later manifest is not silently selected", () =>
  setup((v) => {
    const ctx = JSON.parse(Buffer.from(v.plan.context.bytes, "base64"));
    ctx.manifests.push({
      ...structuredClone(ctx.manifests[0]),
      id: "r2",
      version: "2",
      publishedAt: "2026-08-01T00:00:00Z",
    });
    v.plan.context = blob(Buffer.from(JSON.stringify(ctx)));
    assert.equal(v.run().body.records[0].sensors[0].manifestVersion, "1");
  }));
test("invalid and valid rows are both retained in inventory", () =>
  setup((v) => {
    const source = Buffer.from(JSON.stringify([v.legacy, null]));
    const r = v.run(null, source);
    assert.equal(r.status, 1);
    assert.equal(r.body.counts.input, 2);
    assert.equal(r.body.counts.quarantined, 1);
    assert.equal(r.body.records[1].rowStatus, "quarantined");
  }));
test("runtime and JSON Schema parity with artifact drift check", () => {
  const schema = migrationCompatibilityJsonSchema(),
    ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const p = fixture().plan;
  for (const value of [
    p,
    { ...p, extra: true },
    { ...p, decisions: [] },
    { ...p, reviewedAt: "2026-09-08T00:00:00.1Z" },
  ])
    assert.equal(
      validate(value),
      MigrationCompatibilitySchema.safeParse(value).success
    );
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/migration-compatibility-0.1.0.schema.json",
          import.meta.url
        )
      )
    ),
    schema
  );
});
