import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mapEldaeonIntake } from "./map-eldaeon-intake.mjs";
const unknown = () => ({
  state: "unknown",
  reason: "Synthetic fixture, not supplied.",
});
const hash = (b) => createHash("sha256").update(b).digest("hex");
function fixture(data = {}) {
  const source = {
    title: "Synthetic export; not partner data",
    publisher: "Synthetic fixture",
    license: "unspecified",
    generatedAt: "2026-07-01T12:00:00Z",
    window: {
      start: "2026-07-01T12:00:00Z",
      end: "2026-07-01T12:02:00Z",
      seconds: 120,
    },
    records_by_modality: {
      "radio_frequency.passive_radar": {
        node: "synthetic-compute",
        count: 1,
        coherence: "source_claim",
        records: [
          {
            timestamp: "2026-07-01T12:03:00Z",
            timestamp_start: null,
            node: "synthetic-compute",
            radial_velocity_mps: -3,
            raw: { bistatic_velocity_mps: -2 },
            confidence: 0.8,
            category: "aircraft",
            novel_field: 0,
            "a/b~c": null,
            history: [{ timestamp: "2026-07-01T12:01:00Z", value: -1 }],
          },
        ],
      },
    },
    ...data,
  };
  const bytes = Buffer.from(JSON.stringify(source));
  const receipt = {
    kind: "source_intake",
    schemaVersion: "0.1.0",
    id: "synthetic-receipt",
    receivedAt: "2026-09-07T00:00:00Z",
    source: { publisher: unknown() },
    access: "unknown",
    license: unknown(),
    artifacts: [
      {
        id: "file-1",
        originalName: "synthetic.json",
        role: "unknown",
        format: unknown(),
        sha256: hash(bytes),
        byteLength: bytes.length,
        context: {
          instrument: unknown(),
          calibration: unknown(),
          clock: unknown(),
          acquisitionTime: unknown(),
        },
      },
    ],
  };
  return { source, bytes, receipt };
}
const run = (v) => mapEldaeonIntake(v.receipt, "file-1", v.bytes);
const field = (r, path) =>
  r.modalities[0].fields.find(
    (f) => JSON.stringify(f.path) === JSON.stringify(path)
  );
test("verified source maps to a needs-context report, never research records", async () => {
  const v = fixture(),
    before = structuredClone(v),
    r = await run(v);
  assert.equal(r.status, "needs_context");
  assert.equal(r.source.sha256, hash(v.bytes));
  assert.equal(r.proposedRole, "source_export");
  assert.equal(r.acquisitionContext, "not_created");
  assert.equal(r.observations, "not_created");
  assert.equal(r.scientificEligibility, "not_checked");
  assert.equal(r.authorization, "not_checked");
  assert.equal(r.intakeValidation.success, true);
  assert.equal(r.contextNeeds.length, 6);
  assert.deepEqual(v.source, before.source);
  assert.deepEqual(v.receipt, before.receipt);
  assert.deepEqual(new Uint8Array(v.bytes), before.bytes);
});
test("track and raw bistatic velocities have separate pointers and meanings", async () => {
  const r = await run(fixture()),
    a = field(r, ["radial_velocity_mps"]),
    b = field(r, ["raw", "bistatic_velocity_mps"]);
  assert.notEqual(a.firstPointer, b.firstPointer);
  assert.notEqual(a.mapping.meaning, b.mapping.meaning);
  assert.match(a.mapping.requires, /not interchangeable/);
  assert.equal(a.types[0], "number");
});
test("concrete pointers resolve, including escaped keys and array indices", async () => {
  const v = fixture(),
    r = await run(v);
  for (const f of r.modalities[0].fields) {
    let value = v.source;
    for (const part of f.firstPointer.slice(1).split("/"))
      value = value[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    assert.notEqual(value, undefined);
  }
  assert.match(field(r, ["a/b~c"]).firstPointer, /a~1b~0c$/);
  assert.equal(field(r, ["history", null, "value"]).occurrences, 1);
});
test("unknown and null fields remain visible with no zero substitution", async () => {
  const r = await run(fixture());
  assert.equal(field(r, ["novel_field"]).mapping.target, "unmapped");
  assert.equal(field(r, ["timestamp_start"]).nullCount, 1);
  assert.deepEqual(field(r, ["timestamp_start"]).types, ["null"]);
});
test("provider confidence and category stay unreviewed source assertions", async () => {
  const r = await run(fixture());
  for (const key of ["confidence", "category"])
    assert.equal(field(r, [key]).mapping.target, "source assertion only");
  assert.equal(
    r.declarations.find((d) => d.pointer === "/publisher").status,
    "source_declared"
  );
});
test("compute label is not a physical instrument identity", async () => {
  const r = await run(fixture());
  assert.match(
    field(r, ["node"]).mapping.meaning,
    /not a physical instrument ID/
  );
});
test("out-of-window times are conditional diagnostics, never shifted", async () => {
  const v = fixture(),
    r = await run(v);
  assert.equal(r.windowDiagnostic.status, "conditional");
  assert.equal(r.windowDiagnostic.groups[0].outsideWindow, 1);
  assert.equal(
    v.source.records_by_modality["radio_frequency.passive_radar"].records[0]
      .timestamp,
    "2026-07-01T12:03:00Z"
  );
});
test("missing window leaves temporal diagnostics unchecked", async () => {
  const r = await run(fixture({ window: null }));
  assert.equal(r.windowDiagnostic.status, "not_checked");
  assert.equal(r.acquisitionContext, "not_created");
});
test("mismatched source count is reported without dropping records", async () => {
  const v = fixture();
  const source = v.source;
  source.records_by_modality["radio_frequency.passive_radar"].count = 3;
  const r = await run(fixture(source));
  assert.equal(r.modalities[0].countMatches, false);
  assert.equal(r.modalities[0].actualCount, 1);
});
test("all record variants and null array items appear in the inventory", async () => {
  const v = fixture();
  v.source.records_by_modality["radio_frequency.passive_radar"].records.push({
    newer_field: [null, 0, "text"],
  });
  const r = await run(fixture(v.source));
  const f = field(r, ["newer_field", null]);
  assert.equal(f.occurrences, 3);
  assert.equal(f.nullCount, 1);
  assert.deepEqual(f.types, ["null", "number", "string"]);
});
test("unknown modality and extra root metadata are not discarded", async () => {
  const r = await run(
    fixture({
      extra: 42,
      records_by_modality: {
        "new/modality": { records: [{ value: 0 }], custom: "metadata" },
      },
    })
  );
  assert.equal(
    r.rootFields.find((f) => f.pointer === "/extra").handling,
    "unmapped"
  );
  assert.equal(r.modalities[0].fields[0].mapping.target, "unmapped");
  assert.equal(r.modalities[0].metadata[0].value, "metadata");
});
test("measured and equivalent CO2 remain separate candidates", async () => {
  const r = await run(
    fixture({
      records_by_modality: {
        "environmental.air_quality": {
          records: [{ co2_ppm: 1, co2eq_ppm: 2, eco2_ppm: 3 }],
        },
      },
    })
  );
  assert.equal(
    new Set(r.modalities[0].fields.map((f) => f.mapping.meaning)).size,
    3
  );
});
test("literal dotted keys cannot impersonate nested radar fields", async () => {
  const r = await run(
    fixture({
      records_by_modality: {
        "radio_frequency.passive_radar": {
          records: [{ "raw.bistatic_velocity_mps": 1 }],
        },
      },
    })
  );
  assert.equal(r.modalities[0].fields[0].mapping.target, "unmapped");
});
test("prototype-like names are ordinary unmapped data", async () => {
  const source = JSON.parse(
    '{"records_by_modality":{"__proto__":{"records":[{"constructor":1,"__proto__":2}]}}}'
  );
  const r = await run(fixture(source));
  assert.ok(
    r.modalities[0].fields.every((f) => f.mapping.target === "unmapped")
  );
});
test("only selected artifact is verified; other receipt files remain unchecked", async () => {
  const v = fixture();
  v.receipt.artifacts.push({
    ...structuredClone(v.receipt.artifacts[0]),
    id: "file-2",
  });
  const r = await run(v);
  assert.equal(r.source.scope, "selected_artifact_only");
  assert.equal(r.intakeValidation.success, false);
  assert.equal(r.intakeValidation.files[1].status, "not_checked");
});
test("byte snapshot precedes asynchronous checks", async () => {
  const v = fixture(),
    pending = run(v);
  v.bytes.fill(0);
  assert.equal((await pending).status, "needs_context");
});
test("offline mapper never fetches URLs from declarations", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Network forbidden");
  };
  try {
    assert.equal(
      (await run(fixture({ url: "https://example.invalid/private" }))).status,
      "needs_context"
    );
  } finally {
    globalThis.fetch = original;
  }
});
for (const [name, change] of [
  ["corruption", (v) => (v.bytes[0] = 0)],
  ["missing artifact ID", (v) => (v.receipt.artifacts[0].id = "other")],
  [
    "duplicate receipt IDs",
    (v) => v.receipt.artifacts.push(structuredClone(v.receipt.artifacts[0])),
  ],
  [
    "invalid receipt timestamp",
    (v) => (v.receipt.receivedAt = "2026-02-30T00:00:00Z"),
  ],
])
  test(`reject ${name}`, async () => {
    const v = fixture();
    change(v);
    await assert.rejects(run(v));
  });
for (const [name, data] of [
  ["non-export", { records_by_modality: null }],
  ["empty groups", { records_by_modality: {} }],
  ["non-object record", { records_by_modality: { x: { records: [null] } } }],
  ["missing records", { records_by_modality: { x: {} } }],
])
  test(`reject ${name}`, async () => assert.rejects(run(fixture(data))));
test("invalid UTF-8 is rejected after identity check", async () => {
  const v = fixture();
  v.bytes = Buffer.from([255]);
  v.receipt.artifacts[0].sha256 = hash(v.bytes);
  v.receipt.artifacts[0].byteLength = 1;
  await assert.rejects(run(v));
});
test("deeply nested input is bounded", async () => {
  let record = { value: 1 };
  for (let i = 0; i < 35; i++) record = { nested: record };
  await assert.rejects(
    run(fixture({ records_by_modality: { x: { records: [record] } } })),
    /limit/
  );
});
const script = fileURLToPath(
  new URL("./map-eldaeon-intake.mjs", import.meta.url)
);
function temp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "disclosureos-mapping-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function setup(dir) {
  const v = fixture();
  mkdirSync(join(dir, "files"));
  writeFileSync(join(dir, "intake.json"), JSON.stringify(v.receipt));
  writeFileSync(join(dir, "files/file-1"), v.bytes);
  return v;
}
const cli = (args) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
test("CLI emits deterministic pinned report and leaves files untouched", () =>
  temp((dir) => {
    const v = setup(dir),
      path = join(dir, "intake.json"),
      before = readFileSync(path),
      args = [path, "file-1"],
      a = cli(args),
      b = cli(args);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.equal(a.stdout, b.stdout);
    const r = JSON.parse(a.stdout);
    assert.equal(r.source.intakeManifestSha256, hash(before));
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(readFileSync(join(dir, "files/file-1")), v.bytes);
  }));
test("CLI reports missing/corrupt source without a mapping", () =>
  temp((dir) => {
    setup(dir);
    writeFileSync(join(dir, "files/file-1"), "corrupt");
    const r = cli([join(dir, "intake.json"), "file-1"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).kind, "partner_mapping_error");
  }));
test("CLI rejects traversal selection and symlinked files directory", () =>
  temp((dir) => {
    setup(dir);
    assert.equal(cli([join(dir, "intake.json"), "../outside"]).status, 2);
    rmSync(join(dir, "files"), { recursive: true });
    symlinkSync(dir, join(dir, "files"));
    assert.equal(cli([join(dir, "intake.json"), "file-1"]).status, 2);
  }));
test("CLI rejects source symlinks and malformed manifests", () =>
  temp((dir) => {
    setup(dir);
    rmSync(join(dir, "files/file-1"));
    symlinkSync(join(dir, "intake.json"), join(dir, "files/file-1"));
    assert.equal(cli([join(dir, "intake.json"), "file-1"]).status, 2);
    writeFileSync(join(dir, "intake.json"), "{");
    assert.equal(cli([join(dir, "intake.json"), "file-1"]).status, 2);
  }));
test("CLI has structured usage errors", () => {
  const r = cli([]);
  assert.equal(r.status, 2);
  assert.match(JSON.parse(r.stdout).message, /Usage/);
});

test("oversize source is rejected before decoding", async () => {
  const v = fixture();
  v.bytes = new Uint8Array(32 * 1024 * 1024 + 1);
  await assert.rejects(run(v), /32 MiB/);
});
test("nonfinite parsed metadata cannot silently serialize as null", async () => {
  const v = fixture();
  v.bytes = Buffer.from(
    '{"title":1e400,"records_by_modality":{"x":{"records":[]}}}'
  );
  Object.assign(v.receipt.artifacts[0], {
    sha256: hash(v.bytes),
    byteLength: v.bytes.length,
  });
  await assert.rejects(run(v), /finite JSON parser range/);
});
test("modality count is bounded", async () => {
  await assert.rejects(
    run(
      fixture({
        records_by_modality: Object.fromEntries(
          Array.from({ length: 129 }, (_, i) => [String(i), { records: [] }])
        ),
      })
    ),
    /128/
  );
});
