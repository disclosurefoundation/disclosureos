import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  SourceIntakeSchema,
  sourceIntakeJsonSchema,
  evaluateSourceIntake,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const unknown = () => ({ state: "unknown", reason: "Not provided by source." });
const digest = (b) => createHash("sha256").update(b).digest("hex");
export function fixture() {
  const bytes = new Uint8Array([0, 255, 128, 10]);
  return {
    receipt: {
      kind: "source_intake",
      schemaVersion: "0.1.0",
      id: "synthetic-intake",
      receivedAt: "2026-09-07T12:00:00Z",
      source: { publisher: unknown() },
      license: unknown(),
      access: "unknown",
      artifacts: [
        {
          id: "file-1",
          originalName: "synthetic.bin",
          role: "unknown",
          format: unknown(),
          sha256: digest(bytes),
          byteLength: bytes.length,
          context: {
            instrument: unknown(),
            calibration: unknown(),
            clock: unknown(),
            acquisitionTime: unknown(),
          },
        },
      ],
    },
    files: new Map([["file-1", bytes]]),
  };
}
const run = (v) => evaluateSourceIntake(v.receipt, { files: v.files });
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/source-intake-0.1.0.schema.json",
      import.meta.url
    )
  )
);
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(artifact);
test("versioned artifact equals emitter", () =>
  assert.deepEqual(artifact, sourceIntakeJsonSchema()));
test("opaque bytes pass receipt integrity while unknowns remain actionable", async () => {
  const v = fixture(),
    before = structuredClone(v),
    r = await run(v);
  assert.equal(r.success, true);
  assert.equal(r.gaps.length, 9);
  assert.ok(r.gaps.every((g) => g.reason && g.nextAction));
  for (const key of [
    "researchEligibility",
    "artifactContents",
    "authorization",
  ])
    assert.equal(r[key], "not_checked");
  assert.equal(r.checks.external, "not_checked");
  assert.deepEqual(v, before);
});
const cases = [
  [
    "empty artifact inventory",
    (v) => (v.receipt.artifacts = []),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "duplicate ID",
    (v) => v.receipt.artifacts.push(structuredClone(v.receipt.artifacts[0])),
    true,
    "INTAKE.DUPLICATE",
  ],
  [
    "path traversal ID",
    (v) => (v.receipt.artifacts[0].id = "../secret"),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "ID terminal newline",
    (v) => (v.receipt.artifacts[0].id += "\n"),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "digest terminal newline",
    (v) => (v.receipt.artifacts[0].sha256 += "\n"),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "negative length",
    (v) => (v.receipt.artifacts[0].byteLength = -1),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "unsafe length",
    (v) => (v.receipt.artifacts[0].byteLength = Number.MAX_SAFE_INTEGER + 1),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "unknown top-level field",
    (v) => (v.receipt.score = 100),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "unknown nested field",
    (v) => (v.receipt.artifacts[0].context.confidence = 1),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "blank missingness reason",
    (v) => (v.receipt.license.reason = " "),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "unscoped extension",
    (v) => (v.receipt.extensions = { note: 1 }),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "invalid source URI",
    (v) => (v.receipt.source.uri = "file:///etc/passwd"),
    false,
    "INTAKE.STRUCTURE",
  ],
  [
    "invalid UTC date",
    (v) => (v.receipt.receivedAt = "2026-02-30T00:00:00Z"),
    true,
    "INTAKE.TIME",
  ],
  [
    "receipt without timezone",
    (v) => (v.receipt.receivedAt = "2026-09-07T12:00:00"),
    true,
    "INTAKE.TIME",
  ],
  [
    "invalid acquisition date",
    (v) =>
      (v.receipt.artifacts[0].context.acquisitionTime = {
        state: "declared",
        kind: "instant",
        value: "2026-02-30T00:00:00Z",
        timeScale: "UTC",
      }),
    true,
    "INTAKE.TIME",
  ],
  [
    "empty capture interval",
    (v) =>
      (v.receipt.artifacts[0].context.acquisitionTime = {
        state: "declared",
        kind: "interval",
        start: "2026-09-07T00:00:00Z",
        end: "2026-09-07T00:00:00Z",
        timeScale: "UTC",
      }),
    true,
    "INTAKE.TIME",
  ],
  ["missing file", (v) => v.files.clear(), true, "INTAKE.FILE_UNAVAILABLE"],
  [
    "changed length",
    (v) => v.files.set("file-1", new Uint8Array([1])),
    true,
    "INTAKE.SIZE",
  ],
  [
    "changed digest",
    (v) => (v.files.get("file-1")[0] = 1),
    true,
    "INTAKE.DIGEST",
  ],
];
for (const [name, change, structural, code] of cases)
  test(name, async () => {
    const v = fixture();
    change(v);
    assert.equal(SourceIntakeSchema.safeParse(v.receipt).success, structural);
    assert.equal(
      validate(v.receipt),
      structural,
      JSON.stringify(validate.errors)
    );
    const r = await run(v);
    assert.equal(r.success, false);
    assert.ok(r.issues.some((i) => i.code === code));
    if (!structural) assert.equal(r.checks.semantic, "not_checked");
  });
test("empty file is receipted with a content gap", async () => {
  const v = fixture(),
    b = new Uint8Array();
  v.files.set("file-1", b);
  Object.assign(v.receipt.artifacts[0], { byteLength: 0, sha256: digest(b) });
  const r = await run(v);
  assert.equal(r.success, true);
  assert.ok(r.gaps.some((g) => g.pointer.endsWith("/byteLength")));
});
test("source export and declared context are not independently confirmed", async () => {
  const v = fixture(),
    a = v.receipt.artifacts[0];
  a.role = "source_export";
  a.format = { state: "declared", value: "vendor/custom" };
  a.context.acquisitionTime = {
    state: "declared",
    kind: "interval",
    start: "2026-07-01T00:00:00.000000001Z",
    end: "2026-07-01T00:00:00.000000002Z",
    timeScale: "UTC",
  };
  v.receipt.extensions = { "example.note": { synthetic: true } };
  assert.equal(validate(v.receipt), true);
  const r = await run(v);
  assert.equal(r.success, true);
  assert.equal(r.researchEligibility, "not_checked");
});
test("all input bytes are snapshotted before first await", async () => {
  const v = fixture();
  v.receipt.artifacts.push({
    ...structuredClone(v.receipt.artifacts[0]),
    id: "file-2",
  });
  v.files.set("file-2", new Uint8Array(v.files.get("file-1")));
  const pending = run(v);
  v.files.get("file-2").fill(42);
  assert.equal((await pending).success, true);
});
test("source URI is never fetched", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Unexpected network request");
  };
  try {
    const v = fixture();
    v.receipt.source.uri = "https://example.invalid/data";
    assert.equal((await run(v)).success, true);
  } finally {
    globalThis.fetch = original;
  }
});
test("unavailable hashing remains unchecked", async () => {
  const original = globalThis.crypto.subtle.digest;
  globalThis.crypto.subtle.digest = async () => {
    throw Error("unavailable");
  };
  try {
    const r = await run(fixture());
    assert.equal(r.success, false);
    assert.equal(r.checks.profile, "not_checked");
    assert.ok(r.issues.some((i) => i.code === "INTAKE.HASH_UNAVAILABLE"));
  } finally {
    globalThis.crypto.subtle.digest = original;
  }
});
