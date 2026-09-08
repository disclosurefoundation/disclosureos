import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const cli = new URL(
  "../packages/disclosureos-cli/dist/index.js",
  import.meta.url
).pathname;
const fixtures = JSON.parse(
  readFileSync(new URL("./observation-fixtures.json", import.meta.url))
);
const base = () =>
  structuredClone(fixtures.find((row) => row.id === "minimal-v1-record").input);
const run = (args) =>
  spawnSync(process.execPath, [cli, "migrate", ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 32 * 1024 * 1024,
  });
function withInput(value, fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-migration-"));
  const file = join(dir, "legacy.json");
  const bytes = typeof value === "string" ? value : JSON.stringify(value);
  writeFileSync(file, bytes);
  try {
    fn(file, bytes, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const plan = (file, namespace = "synthetic") =>
  run(["dry-run", file, "--id", namespace, "--json"]);
const body = (result) => JSON.parse(result.stdout);

test("dry run preserves exact bytes, accounts for fields and produces a validated draft without writes", () => {
  const value = base();
  value.status = "published";
  value.summary = "Synthetic record";
  value.temporal.date = "1900-01-01";
  value.extensions = {
    "legacy.scores": { version: "v1-test", score: 0, confidence: null },
    "a/b~c": [],
  };
  withInput(JSON.stringify(value, null, 4) + "\n", (file, bytes, dir) => {
    const result = plan(file);
    assert.equal(result.status, 0, result.stderr);
    const report = body(result);
    const row = report.records[0];
    assert.deepEqual(report.counts, {
      input: 1,
      candidates: 1,
      quarantined: 0,
      migrated: 0,
    });
    assert.equal(Buffer.from(report.source.bytes, "base64").toString(), bytes);
    assert.equal(
      report.source.sha256,
      createHash("sha256").update(bytes).digest("hex")
    );
    assert.equal(report.source.byteLength, Buffer.byteLength(bytes));
    assert.deepEqual(row.legacy.data, value);
    assert.equal(row.candidate.observation.status, "draft");
    assert.equal(row.candidate.observation.eventTime.state, "unknown");
    assert.equal(row.candidate.observation.position.state, "unknown");
    assert.deepEqual(row.candidate.claims, []);
    assert.equal(parseExperimentalClaimHistory(row.candidate).success, true);
    assert.equal(
      row.candidate.observation.sources[0].digest.value,
      report.source.sha256
    );
    const expected = [
      "/id",
      "/temporal/date",
      "/temporal/dateCertainty",
      "/location/id",
      "/location/name",
      "/location/country",
      "/location/latitude",
      "/location/longitude",
      "/location/siteType",
      "/status",
      "/createdAt",
      "/updatedAt",
      "/summary",
      "/extensions/legacy.scores/version",
      "/extensions/legacy.scores/score",
      "/extensions/legacy.scores/confidence",
      "/extensions/a~1b~0c",
    ];
    assert.deepEqual(
      row.mapping.map((field) => field.pointer),
      expected
    );
    assert.equal(
      row.mapping.find((field) => field.pointer === "/location/latitude")
        .disposition,
      "unresolved"
    );
    assert.equal(
      row.mapping.find(
        (field) => field.pointer === "/extensions/legacy.scores/score"
      ).disposition,
      "unresolved"
    );
    assert.deepEqual(readdirSync(dir), ["legacy.json"]);
    assert.equal(readFileSync(file, "utf8"), bytes);
  });
});

test("mixed input reconciles candidates and every quarantined occurrence", () => {
  const second = { ...base(), id: "duplicate" };
  withInput(
    [
      base(),
      null,
      { ...base(), id: "bad-time", createdAt: "yesterday" },
      second,
      second,
    ],
    (file) => {
      const result = plan(file);
      assert.equal(result.status, 1);
      const report = body(result);
      assert.deepEqual(report.counts, {
        input: 5,
        candidates: 1,
        quarantined: 4,
        migrated: 0,
      });
      assert.deepEqual(
        report.records.map((row) => row.sourcePointer),
        ["/0", "/1", "/2", "/3", "/4"]
      );
      for (const row of report.records.slice(1)) {
        assert.ok(row.reasons.length);
        assert.equal(row.candidate, undefined);
      }
      assert.match(report.records[3].reasons.join(), /Duplicate/);
      assert.match(report.records[4].reasons.join(), /Duplicate/);
    }
  );
});

test("candidate identity is stable across formatting and content revisions but scoped by namespace", () => {
  let id;
  withInput(base(), (file) => {
    id = body(plan(file)).records[0].candidate.observation.id;
  });
  withInput(
    JSON.stringify({ ...base(), summary: "Revised description" }, null, 2),
    (file) => {
      assert.equal(body(plan(file)).records[0].candidate.observation.id, id);
      assert.notEqual(
        body(plan(file, "other")).records[0].candidate.observation.id,
        id
      );
    }
  );
});

test("enriched slots survive and never become new claims", () => {
  const input = structuredClone(
    fixtures.find((row) => row.id === "unknown-confidence").input
  );
  withInput(input, (file) => {
    const result = plan(file);
    assert.equal(result.status, 0, result.stdout);
    const row = body(result).records[0];
    assert.deepEqual(
      row.legacy.data.observableAssessments,
      input.observableAssessments
    );
    assert.deepEqual(row.candidate.claims, []);
    assert.ok(
      row.mapping.some(
        (field) =>
          field.pointer.startsWith("/observableAssessments/") &&
          field.disposition === "unresolved"
      )
    );
  });
});

for (const [name, value] of [
  ["malformed JSON", "{"],
  ["empty batch", []],
  ["too many rows", Array(10001).fill(null)],
]) {
  test(name + " fails before producing a migration report", () =>
    withInput(value, (file) => {
      const result = plan(file);
      assert.equal(result.status, 2);
      assert.equal(body(result).stage, "input");
    })
  );
}

test("unsupported rows are retained and quarantined", () =>
  withInput([{ ...base(), score: 5 }, 4, []], (file) => {
    const result = plan(file);
    assert.equal(result.status, 1);
    assert.equal(body(result).counts.quarantined, 3);
    assert.equal(body(result).records[0].legacy.data.score, 5);
  }));

test("depth budget quarantines the affected row without omitting the batch", () => {
  const value = base();
  let cursor = (value.extensions = {});
  for (let i = 0; i < 70; i++) cursor = cursor.next = {};
  withInput([value, { ...base(), id: "safe" }], (file) => {
    const result = plan(file);
    assert.equal(result.status, 1);
    assert.equal(body(result).records[0].mappingComplete, false);
    assert.deepEqual(body(result).counts, {
      input: 2,
      candidates: 1,
      quarantined: 1,
      migrated: 0,
    });
  });
});

test("usage and unsupported write flags fail explicitly", () =>
  withInput(base(), (file) => {
    for (const args of [
      ["dry-run", file],
      ["apply", file, "--id", "test"],
      ["dry-run", file, "--id", "test", "--out", "out"],
      ["dry-run", file, "--id", "bad namespace"],
    ])
      assert.equal(run(args).status, 2);
    assert.equal(run(["--help"]).status, 0);
  }));

test("symlink, oversized input and invalid UTF-8 are rejected", () =>
  withInput(base(), (file, bytes, dir) => {
    const link = join(dir, "link.json");
    symlinkSync(file, link);
    assert.equal(plan(link).status, 2);
    writeFileSync(file, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
    assert.equal(plan(file).status, 2);
    writeFileSync(file, Buffer.from([0xff]));
    assert.equal(plan(file).status, 2);
  }));

test("extreme nesting stays quarantined without overflowing report serialization", () => {
  const nested = '{"next":'.repeat(6000) + "{}" + "}".repeat(6000);
  withInput("[" + nested + "," + JSON.stringify(base()) + "]", (file) => {
    const result = plan(file);
    assert.equal(result.status, 1, result.stdout);
    const report = body(result);
    assert.equal(report.records[0].legacy.retainedIn, "source.bytes");
    assert.equal(report.records[0].mappingComplete, false);
    assert.equal(report.records[1].decision, "candidate_requires_review");
    assert.equal(
      Buffer.from(report.source.bytes, "base64").toString(),
      readFileSync(file, "utf8")
    );
  });
});
