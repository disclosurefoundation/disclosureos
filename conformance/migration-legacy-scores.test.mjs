import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  MigrationLegacyScoresSchema,
  migrationLegacyScoresJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { migrationLegacyScoresExample } from "../examples/v2/migration-legacy-scores-demo.mjs";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: Buffer.byteLength(bytes),
});
function setup(fn) {
  const root = mkdtempSync(join(tmpdir(), "legacy-scores-")),
    example = migrationLegacyScoresExample();
  const file = join(root, "scores.json"),
    planFile = join(root, "plan.json");
  const run = (plan = example.plan, source = example.source) => {
    writeFileSync(file, source);
    writeFileSync(
      planFile,
      typeof plan === "string" ? plan : JSON.stringify(plan)
    );
    const r = spawnSync(
      process.execPath,
      [cli, "migrate", "legacy-scores", file, planFile, "--json"],
      { encoding: "utf8", timeout: 15000, maxBuffer: 32 * 1024 * 1024 }
    );
    return { ...r, body: JSON.parse(r.stdout) };
  };
  try {
    fn({ ...example, root, file, planFile, run });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const ok = (r) => {
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.body;
};
test("preserves exact input bytes, zero scores, extra fields and explicit legacy identity without writes", () =>
  setup((v) => {
    const r = ok(v.run());
    assert.deepEqual(r.counts, {
      input: 2,
      preservedHistorical: 2,
      pendingReview: 0,
      quarantined: 0,
      v2Evaluations: 0,
      indexImported: 0,
    });
    assert.deepEqual(Buffer.from(r.source.bytes, "base64"), v.source);
    assert.deepEqual(JSON.parse(Buffer.from(r.review.bytes, "base64")), v.plan);
    assert.deepEqual(readdirSync(v.root).sort(), ["plan.json", "scores.json"]);
    for (const [i, row] of r.records.entries()) {
      assert.deepEqual(row.legacy.data, v.scores[i]);
      assert.deepEqual(row.historicalOutput.value, v.scores[i]);
      assert.equal(row.historicalOutput.comparableToV2, false);
      assert.equal(row.historicalOutput.rankingEligibility, "excluded");
      assert.equal(row.historicalOutput.calculation, "not_recomputed");
      assert.equal(
        row.historicalOutput.association.observationIdentity,
        "legacy-" +
          createHash("sha256")
            .update(JSON.stringify(["synthetic", "synthetic-observation"]))
            .digest("hex")
      );
      assert.equal(
        row.historicalOutput.association.verification,
        "declared_not_verified"
      );
    }
    assert.deepEqual(ok(v.run()), r);
  }));
test("mixed valid, missing-review and invalid rows reconcile without omissions", () =>
  setup((v) => {
    const source = Buffer.from(JSON.stringify([...v.scores, null, {}]));
    v.plan.source = pin(source);
    v.plan.decisions.push({ ...v.plan.decisions[0], sourcePointer: "/3" });
    const r = v.run(v.plan, source);
    assert.equal(r.status, 1);
    assert.deepEqual(r.body.counts, {
      input: 4,
      preservedHistorical: 2,
      pendingReview: 1,
      quarantined: 1,
      v2Evaluations: 0,
      indexImported: 0,
    });
    assert.equal(r.body.records[2].legacy.data, null);
    assert.deepEqual(r.body.records[3].legacy.data, {});
    assert.ok(!r.body.records[3].historicalOutput);
  }));
test("empty declarations preserve every row as pending", () =>
  setup((v) => {
    v.plan.decisions = [];
    const r = v.run();
    assert.equal(r.status, 1);
    assert.equal(r.body.counts.pendingReview, 2);
  }));
for (const field of ["methodologyVersion", "outputContractVersion"])
  test(
    "conflicting or unsupported " + field + " quarantines without replacement",
    () =>
      setup((v) => {
        v.plan.decisions[1][field] = "unrecognized:9";
        const r = v.run();
        assert.equal(r.status, 1);
        assert.equal(r.body.records[1].disposition, "quarantined");
        assert.deepEqual(r.body.records[1].legacy.data, v.scores[1]);
        assert.equal(r.body.counts.preservedHistorical, 1);
      })
  );
test("multiple scores for one observation remain distinct historical outputs", () =>
  setup((v) => {
    const source = Buffer.from(JSON.stringify([v.scores[1], v.scores[1]]));
    v.plan.source = pin(source);
    v.plan.decisions = [
      { ...v.plan.decisions[1], sourcePointer: "/0" },
      v.plan.decisions[1],
    ];
    const r = ok(v.run(v.plan, source));
    assert.notEqual(
      r.records[0].historicalOutput.id,
      r.records[1].historicalOutput.id
    );
    assert.deepEqual(
      r.records[0].historicalOutput.association,
      r.records[1].historicalOutput.association
    );
  }));
test("single output uses root pointer", () =>
  setup((v) => {
    const source = Buffer.from(JSON.stringify(v.scores[0]));
    v.plan.source = pin(source);
    v.plan.decisions = [{ ...v.plan.decisions[0], sourcePointer: "" }];
    assert.equal(ok(v.run(v.plan, source)).records[0].sourcePointer, "");
  }));
for (const mode of [
  "duplicate",
  "unknown",
  "pin",
  "missing-version",
  "wrong-kind",
  "fractional-time",
])
  test("invalid whole plan rejected: " + mode, () =>
    setup((v) => {
      if (mode === "duplicate") v.plan.decisions.push(v.plan.decisions[0]);
      if (mode === "unknown") v.plan.decisions[0].sourcePointer = "/5";
      if (mode === "pin") v.plan.source.sha256 = "0".repeat(64);
      if (mode === "missing-version")
        delete v.plan.decisions[0].methodologyVersion;
      if (mode === "wrong-kind") v.plan.decisions[0].resultKind = "v2-profile";
      if (mode === "fractional-time")
        v.plan.reviewedAt = "2026-09-08T00:00:00.123Z";
      const r = v.run();
      assert.equal(r.status, 2);
      assert.equal(r.body.success, false);
      assert.ok(!r.body.records);
    })
  );
for (const source of [
  '{"score":0,"score":1}',
  '{"value":9007199254740993}',
  '{"value":-0}',
])
  test("ambiguous source rejected: " + source, () =>
    setup((v) => {
      v.plan.source = pin(source);
      assert.equal(v.run(v.plan, source).status, 2);
    })
  );
test("structural legacy validation does not silently recalculate historical arithmetic", () =>
  setup((v) => {
    v.scores[0].percentage = 99;
    const source = Buffer.from(JSON.stringify(v.scores));
    v.plan.source = pin(source);
    const r = ok(v.run(v.plan, source));
    assert.equal(r.records[0].historicalOutput.value.percentage, 99);
    assert.equal(
      r.records[0].historicalOutput.validation,
      "historical_output_shape_only"
    );
  }));
test("JSON Schema and runtime agree; checked-in artifact is current", () => {
  const schema = migrationLegacyScoresJsonSchema(),
    ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema),
    example = migrationLegacyScoresExample().plan;
  for (const value of [
    example,
    { ...example, decisions: [] },
    { ...example, extra: 1 },
    { ...example, source: { ...example.source, sha256: "no" } },
    {
      ...example,
      decisions: [{ ...example.decisions[0], sourcePointer: "/01" }],
    },
  ])
    assert.equal(
      validate(value),
      MigrationLegacyScoresSchema.safeParse(value).success
    );
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/migration-legacy-scores-0.1.0.schema.json",
          import.meta.url
        )
      )
    ),
    schema
  );
});
test("symlink input and unsupported flags rejected", () =>
  setup((v) => {
    ok(v.run());
    const alias = join(v.root, "alias");
    symlinkSync(v.file, alias);
    for (const args of [
      [alias, v.planFile],
      [v.file, v.planFile, "--out", join(v.root, "unused")],
    ]) {
      const r = spawnSync(
        process.execPath,
        [cli, "migrate", "legacy-scores", ...args, "--json"],
        { encoding: "utf8", timeout: 15000 }
      );
      assert.equal(r.status, 2);
    }
  }));
