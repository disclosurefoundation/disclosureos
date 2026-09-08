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
  MigrationReviewSchema,
  migrationReviewJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { migrationReviewExample } from "../examples/v2/migration-review-demo.mjs";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: Buffer.byteLength(bytes),
});
function setup(fn) {
  const folder = mkdtempSync(join(tmpdir(), "migration-review-"));
  const v = migrationReviewExample();
  const source = join(folder, "legacy.json"),
    review = join(folder, "review.json");
  const run = (plan = v.plan, bytes = v.sourceBytes, rawReview) => {
    writeFileSync(source, bytes);
    writeFileSync(review, rawReview ?? JSON.stringify(plan));
    const result = spawnSync(
      process.execPath,
      [cli, "migrate", "review", source, review, "--json"],
      { encoding: "utf8", timeout: 15000, maxBuffer: 32 * 1024 * 1024 }
    );
    return { ...result, body: JSON.parse(result.stdout) };
  };
  try {
    fn({ ...v, folder, source, review, run });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test("review schema emitter, stored artifact and independent validation agree", () => {
  const schema = migrationReviewJsonSchema();
  const saved = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/migration-review-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, saved);
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const plan = migrationReviewExample().plan;
  assert.equal(MigrationReviewSchema.safeParse(plan).success, true);
  assert.equal(validate(plan), true, JSON.stringify(validate.errors));
  for (const mutate of [
    (p) => (p.extra = true),
    (p) => (p.reviewedAt = "yesterday"),
    (p) => (p.reviewedAt = "2026-09-08T00:00:00.123Z"),
    (p) => (p.decisions[0].field = "score"),
    (p) => (p.decisions[0].rationale = ""),
    (p) => (p.decisions[0].sourcePointers = []),
  ]) {
    const bad = structuredClone(plan);
    mutate(bad);
    assert.equal(MigrationReviewSchema.safeParse(bad).success, false);
    assert.equal(validate(bad), false);
  }
});

test("explicit date/frame mappings preserve sentinel-like values, legacy scores and exact inputs", () =>
  setup((v) => {
    const result = v.run();
    assert.equal(result.status, 0, result.stdout);
    const report = result.body,
      row = report.records[0],
      candidate = row.candidate;
    assert.deepEqual(report.counts, {
      input: 1,
      candidates: 1,
      quarantined: 0,
      migrated: 0,
    });
    assert.equal(row.review.status, "applied");
    assert.equal(candidate.observation.eventTime.value.value, "1900-01-01");
    assert.equal(candidate.observation.position.value.latitude, 0);
    assert.equal(parseExperimentalClaimHistory(candidate).success, true);
    assert.deepEqual(candidate.claims, []);
    assert.deepEqual(row.legacy.data, v.legacy);
    assert.equal(
      row.mapping.find((field) => field.pointer === "/temporal/date")
        .disposition,
      "mapped"
    );
    assert.equal(
      row.mapping.find((field) => field.pointer === "/location/name")
        .disposition,
      "unresolved"
    );
    assert.equal(
      row.mapping.find((field) => field.pointer.endsWith("/score")).disposition,
      "unresolved"
    );
    assert.deepEqual(Buffer.from(report.source.bytes, "base64"), v.sourceBytes);
    assert.deepEqual(
      Buffer.from(report.review.bytes, "base64"),
      readFileSync(v.review)
    );
    const audit = candidate.observation.extensions["disclosureos.migration"];
    assert.equal(audit.reviewSha256, pin(readFileSync(v.review)).sha256);
    assert.deepEqual(audit.decisions, v.plan.decisions);
    assert.equal(audit.reviewerIdentity, "not_authenticated");
    assert.deepEqual(readdirSync(v.folder).sort(), [
      "legacy.json",
      "review.json",
    ]);
  }));

for (const [name, mutate] of [
  [
    "invalid interval",
    (p) =>
      (p.decisions[0].value.value = {
        kind: "interval",
        start: { kind: "date", value: "1900-01-02" },
        end: { kind: "date", value: "1900-01-01" },
      }),
  ],
  ["missing frame", (p) => (p.decisions[1].frames = [])],
  [
    "dangling source",
    (p) => (p.decisions[0].value.sourceRefs = ["source:absent"]),
  ],
  [
    "unknown pointer",
    (p) => (p.decisions[0].sourcePointers = ["/temporal/missing"]),
  ],
  [
    "wrong domain",
    (p) => (p.decisions[0].sourcePointers = ["/location/latitude"]),
  ],
  ["unknown target key", (p) => (p.decisions[0].value.extra = true)],
])
  test(
    name + " quarantines the complete reviewed row without partial mappings",
    () =>
      setup((v) => {
        mutate(v.plan);
        const result = v.run();
        assert.equal(result.status, 1, result.stdout);
        const row = result.body.records[0];
        assert.equal(row.candidate, undefined);
        assert.equal(row.review.status, "rejected");
        assert.ok(row.reasons.length);
        assert.ok(
          row.mapping.every((field) => field.disposition === "unresolved")
        );
      })
  );

for (const [name, mutate] of [
  ["stale hash", (p) => (p.source.sha256 = "a".repeat(64))],
  ["stale length", (p) => p.source.byteLength++],
  ["duplicate decision", (p) => p.decisions.push(p.decisions[0])],
  ["unknown record", (p) => (p.decisions[0].sourceId = "absent")],
  [
    "duplicate pointer",
    (p) => p.decisions[0].sourcePointers.push(p.decisions[0].sourcePointers[0]),
  ],
])
  test(name + " rejects the plan", () =>
    setup((v) => {
      mutate(v.plan);
      const result = v.run();
      assert.equal(result.status, 2);
      assert.equal(result.body.stage, "review_input");
    })
  );

test("unreviewed rows and invalid base rows remain fully accounted for", () =>
  setup((v) => {
    const rows = [
      v.legacy,
      { ...v.legacy, id: "untouched" },
      { ...v.legacy, id: "bad", createdAt: "invalid" },
    ];
    const bytes = JSON.stringify(rows);
    v.plan.source = pin(bytes);
    const result = v.run(v.plan, bytes);
    assert.equal(result.status, 1);
    assert.deepEqual(result.body.counts, {
      input: 3,
      candidates: 2,
      quarantined: 1,
      migrated: 0,
    });
    assert.equal(result.body.records[1].review.status, "not_requested");
    assert.equal(
      result.body.records[1].candidate.observation.eventTime.state,
      "unknown"
    );
    assert.deepEqual(
      result.body.records.map((row) => row.sourcePointer),
      ["/0", "/1", "/2"]
    );
  }));

test("duplicate source identities cannot be rescued through review", () =>
  setup((v) => {
    const bytes = JSON.stringify([v.legacy, v.legacy]);
    v.plan.source = pin(bytes);
    const result = v.run(v.plan, bytes);
    assert.equal(result.status, 1);
    assert.equal(result.body.counts.quarantined, 2);
    assert.ok(
      result.body.records.every((row) => row.review.status === "rejected")
    );
  }));

for (const [name, extra] of [
  ["duplicate keys", '"a":1,"a":2'],
  ["escaped duplicate keys", '"a":1,"\\u0061":2'],
  ["unsafe integer", '"number":9007199254740993'],
  ["overflow", '"number":1e400'],
  ["negative zero", '"number":-0'],
  ["underflow", '"number":1e-999'],
  ["rounded decimal", '"number":0.100000000000000000001'],
]) {
  test(name + " cannot enter a reviewed mapping", () =>
    setup((v) => {
      const bytes = JSON.stringify(v.legacy).replace(
        '"extensions":{',
        '"extensions":{' + extra + ","
      );
      v.plan.source = pin(bytes);
      const result = v.run(v.plan, bytes);
      assert.equal(result.status, 2, result.stdout);
      assert.equal(result.body.stage, "review_input");
    })
  );
}

test("duplicate keys in review plan are rejected before schema validation", () =>
  setup((v) => {
    const raw = JSON.stringify(v.plan).replace(
      '"namespace":',
      '"namespace":"different", "namespace":'
    );
    assert.equal(v.run(v.plan, v.sourceBytes, raw).status, 2);
  }));

test("ordinary escaped strings and decimal values are not mistaken for JSON syntax", () =>
  setup((v) => {
    v.legacy.extensions["text"] = 'fake "keys": [123] and \\ characters';
    v.legacy.extensions.decimal = 0.125;
    const bytes = JSON.stringify(v.legacy);
    v.plan.source = pin(bytes);
    assert.equal(v.run(v.plan, bytes).status, 0);
  }));

test("explicit unknown decisions retain original values and do not claim absence", () =>
  setup((v) => {
    v.plan.decisions = [
      {
        ...v.plan.decisions[0],
        value: { state: "unknown", reason: "unavailable" },
        rationale:
          "Synthetic review has insufficient provenance to map the anchor date.",
      },
    ];
    const result = v.run();
    assert.equal(result.status, 0);
    assert.equal(
      result.body.records[0].candidate.observation.eventTime.state,
      "unknown"
    );
    assert.equal(
      result.body.records[0].legacy.data.temporal.date,
      "1900-01-01"
    );
  }));

test("review input limits and final-component symlinks fail without output files", () =>
  setup((v) => {
    v.run();
    const runPaths = (source, review) =>
      spawnSync(
        process.execPath,
        [cli, "migrate", "review", source, review, "--json"],
        { encoding: "utf8", timeout: 15000 }
      );
    const link = join(v.folder, "link.json");
    symlinkSync(v.review, link);
    assert.equal(runPaths(v.source, link).status, 2);
    assert.equal(runPaths(v.folder, v.review).status, 2);
    writeFileSync(v.review, Buffer.alloc(2 * 1024 * 1024 + 1, 32));
    assert.equal(runPaths(v.source, v.review).status, 2);
    writeFileSync(v.review, Buffer.from([0xff]));
    assert.equal(runPaths(v.source, v.review).status, 2);
    assert.deepEqual(readdirSync(v.folder).sort(), [
      "legacy.json",
      "link.json",
      "review.json",
    ]);
  }));

test("review depth budget rejects input before recursive plan validation", () =>
  setup((v) => {
    const raw = '{"next":'.repeat(100) + "{}" + "}".repeat(100);
    assert.equal(v.run(v.plan, v.sourceBytes, raw).status, 2);
  }));
