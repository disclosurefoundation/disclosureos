import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateDatasetRelease,
  DatasetReleaseSchema,
  datasetReleaseJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const folder = new URL("../examples/v2/dataset-demo/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("dataset.json", folder)));
function inputs() {
  return {
    release: structuredClone(base),
    packets: new Map(
      base.packets.map((entry) => {
        const dir = new URL(`packets/${entry.id}/`, folder);
        const manifest = new Uint8Array(
          readFileSync(new URL("packet.json", dir))
        );
        const p = JSON.parse(new TextDecoder().decode(manifest));
        return [
          entry.id,
          {
            manifest,
            files: new Map(
              p.files.map((f) => [
                f.id,
                new Uint8Array(readFileSync(new URL(`files/${f.id}`, dir))),
              ])
            ),
          },
        ];
      })
    ),
  };
}
const run = (v) => evaluateDatasetRelease(v.release, { packets: v.packets });
const schema = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/dataset-release-0.1.0.schema.json",
      import.meta.url
    )
  )
);
const validate = new Ajv2020({ strict: false }).compile(schema);
const cases = [
  ["complete", () => {}, "passed"],
  [
    "unknown access is not invented permission",
    (v) => {
      v.release.access = "unknown";
      v.release.license = { state: "unknown", reason: "not provided" };
    },
    "passed",
  ],
  [
    "duplicate entry",
    (v) => v.release.packets.push(v.release.packets[0]),
    "not_checked",
    "DATASET.DUPLICATE",
  ],
  [
    "duplicate packet id",
    (v) => (v.release.packets[1].packetId = v.release.packets[0].packetId),
    "not_checked",
    "DATASET.DUPLICATE",
  ],
  [
    "duplicate session",
    (v) => (v.release.sessions[1].id = v.release.sessions[0].id),
    "not_checked",
    "DATASET.DUPLICATE",
  ],
  [
    "duplicate membership",
    (v) => v.release.sessions[1].members.push(v.release.sessions[0].members[0]),
    "not_checked",
    "DATASET.DUPLICATE_MEMBERSHIP",
  ],
  [
    "unknown packet",
    (v) => (v.release.sessions[0].members[0].packetRef = "packet:missing"),
    "not_checked",
    "DATASET.PACKET_REFERENCE",
  ],
  [
    "unknown acquisition",
    (v) =>
      (v.release.sessions[0].members[0].acquisitionRef = "acquisition:missing"),
    "failed",
    "DATASET.ACQUISITION_REFERENCE",
  ],
  [
    "wrong packet identity",
    (v) => (v.release.packets[0].packetId = "wrong"),
    "failed",
    "DATASET.PACKET_ID",
  ],
  [
    "unknown session time",
    (v) =>
      (v.release.sessions[0].time = {
        state: "unknown",
        reason: "not collected",
      }),
    "not_checked",
    "DATASET.SESSION_TIME_UNKNOWN",
  ],
  [
    "reversed session",
    (v) => (v.release.sessions[0].time.end = "2026-07-28T12:09:00Z"),
    "not_checked",
    "DATASET.TIME",
  ],
  [
    "invalid calendar",
    (v) => (v.release.sessions[0].time.start = "2026-02-30T00:00:00Z"),
    "not_checked",
    "DATASET.TIME",
  ],
  [
    "invalid creation date",
    (v) => (v.release.createdAt = "not a time"),
    "not_checked",
    "DATASET.TIME",
  ],
  [
    "start excludes first sample",
    (v) =>
      (v.release.sessions[0].time.start = "2026-07-28T12:10:00.000000000001Z"),
    "failed",
    "DATASET.OUTSIDE_SESSION",
  ],
  [
    "end clips acquisition",
    (v) =>
      (v.release.sessions[0].time.end = "2026-07-28T12:10:59.999999999999Z"),
    "failed",
    "DATASET.OUTSIDE_SESSION",
  ],
  [
    "offset boundary",
    (v) => (v.release.sessions[0].time.start = "2026-07-28T05:10:00-07:00"),
    "passed",
  ],
  [
    "missing packet",
    (v) => v.packets.delete("background"),
    "not_checked",
    "DATASET.PACKET_UNAVAILABLE",
  ],
  [
    "corrupt manifest",
    (v) => (v.packets.get("background").manifest[0] ^= 1),
    "failed",
    "DATASET.PACKET_DIGEST",
  ],
  [
    "wrong manifest size",
    (v) => v.release.packets[0].byteLength++,
    "failed",
    "DATASET.PACKET_SIZE",
  ],
  [
    "missing nested raw file",
    (v) =>
      v.packets.get("background").files.delete("context-product-captured-raw"),
    "not_checked",
    "DATASET.PACKET_INCOMPLETE",
  ],
  [
    "corrupt nested raw file",
    (v) =>
      (v.packets
        .get("background")
        .files.get("context-product-captured-raw")[0] ^= 1),
    "failed",
    "DATASET.PACKET_INCOMPLETE",
  ],
  [
    "unassigned packet acquisition",
    (v) => v.release.sessions.splice(0, 1),
    "failed",
    "DATASET.MEMBERSHIP_REQUIRED",
  ],
];
for (const [name, change, status, code] of cases)
  test(name, async () => {
    const v = inputs();
    change(v);
    const before = structuredClone(v);
    const r = await run(v);
    assert.equal(r.checks.profile, status, JSON.stringify(r.issues));
    assert.equal(r.success, status === "passed");
    if (code)
      assert.ok(
        r.issues.some((i) => i.code === code),
        JSON.stringify(r)
      );
    assert.equal(r.authorization, "not_checked");
    assert.equal(r.scientificEligibility, "not_checked");
    assert.equal(r.crossInstrumentIdentity, "not_checked");
    assert.deepEqual(v, before);
    assert.equal(
      validate(v.release),
      DatasetReleaseSchema.safeParse(v.release).success
    );
  });
function repin(v, key, changes) {
  const input = v.packets.get(key);
  const p = JSON.parse(new TextDecoder().decode(input.manifest));
  for (const [file, update] of Object.entries(changes)) {
    const object = JSON.parse(new TextDecoder().decode(input.files.get(file)));
    update(object);
    const bytes = new TextEncoder().encode(JSON.stringify(object));
    input.files.set(file, bytes);
    const f = p.files.find((f) => f.id === file);
    f.sha256 = createHash("sha256").update(bytes).digest("hex");
    f.byteLength = bytes.length;
  }
  input.manifest = new TextEncoder().encode(JSON.stringify(p));
  const entry = v.release.packets.find((p) => p.id === key);
  entry.sha256 = createHash("sha256").update(input.manifest).digest("hex");
  entry.byteLength = input.manifest.length;
}
test("different context bytes cannot share an identity", async () => {
  const v = inputs();
  repin(v, "control", {
    context: (c) => (c.id = "context-background"),
    bindings: (b) => (b.contextId = "context-background"),
    mapping: (m) => (m.contextId = "context-background"),
    review: (r) => (r.contextId = "context-background"),
  });
  const r = await run(v);
  assert.ok(
    r.issues.some((i) => i.code === "DATASET.CONTEXT_CONFLICT"),
    JSON.stringify(r.issues)
  );
});
test("duplicate observation IDs cannot double-enter a release", async () => {
  const v = inputs();
  repin(v, "control", {
    history: (h) => (h.observation.id = "observation-background"),
    bindings: (b) => (b.observationId = "observation-background"),
    mapping: (m) => (m.observationId = "observation-background"),
    review: (r) => (r.observationId = "observation-background"),
  });
  assert.ok(
    (await run(v)).issues.some(
      (i) => i.code === "DATASET.OBSERVATION_DUPLICATE"
    )
  );
});
test("preserves background and known controls", async () => {
  const r = await run(inputs());
  assert.deepEqual(
    r.sessions.map((s) => s.members[0].classification),
    ["background", "known_control"]
  );
});
test("snapshots all packet manifests and files before awaiting", async () => {
  const v = inputs();
  const pending = run(v);
  v.release.sessions = [];
  for (const p of v.packets.values()) {
    p.manifest.fill(0);
    for (const b of p.files.values()) b.fill(0);
  }
  assert.equal((await pending).success, true);
});
test("schema drift and strict structure", () => {
  assert.deepEqual(schema, datasetReleaseJsonSchema());
  for (const change of [
    (v) => (v.extra = true),
    (v) => (v.sessions = []),
    (v) => (v.packets = []),
    (v) => (v.packets[0].id = "../escape"),
    (v) => (v.packets[0].sha256 += "\n"),
    (v) => (v.sessions[0].time.timeScale = "TAI"),
  ]) {
    const p = structuredClone(base);
    change(p);
    assert.equal(validate(p), false);
    assert.equal(DatasetReleaseSchema.safeParse(p).success, false);
  }
});
test("offline and missing packets remain unchecked", async () => {
  const prev = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    const r = await evaluateDatasetRelease(base);
    assert.equal(r.checks.profile, "not_checked");
  } finally {
    globalThis.fetch = prev;
  }
});
function repinBytes(v, key, file, bytes) {
  const input = v.packets.get(key);
  input.files.set(file, Uint8Array.from(bytes));
  const p = JSON.parse(new TextDecoder().decode(input.manifest));
  const f = p.files.find((f) => f.id === file);
  f.sha256 = createHash("sha256").update(bytes).digest("hex");
  f.byteLength = bytes.length;
  input.manifest = new TextEncoder().encode(JSON.stringify(p));
  const e = v.release.packets.find((e) => e.id === key);
  e.sha256 = createHash("sha256").update(input.manifest).digest("hex");
  e.byteLength = input.manifest.length;
}
function shared() {
  const v = inputs();
  repin(v, "control", {
    bindings: (b) => (b.contextId = "context-background"),
    mapping: (m) => {
      m.contextId = "context-background";
      m.measurements[0].time.value = "2026-07-28T12:10:30Z";
    },
    review: (r) => {
      r.contextId = "context-background";
      r.measurements[0].timing.lower = "2026-07-28T12:10:29.9Z";
      r.measurements[0].timing.upper = "2026-07-28T12:10:30.1Z";
    },
  });
  repinBytes(
    v,
    "control",
    "context",
    v.packets.get("background").files.get("context")
  );
  return v;
}
test("distinct observations can share exact context and one session", async () => {
  const v = shared();
  v.release.sessions[0].members.push(v.release.sessions[1].members[0]);
  v.release.sessions.pop();
  const r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
});
test("shared acquisition cannot be assigned to conflicting sessions", async () => {
  const v = shared();
  v.release.sessions[1].time = structuredClone(v.release.sessions[0].time);
  assert.ok(
    (await run(v)).issues.some((i) => i.code === "DATASET.SESSION_CONFLICT")
  );
});
test("point acquisition at exclusive session end fails", async () => {
  const v = inputs();
  repin(v, "background", {
    context: (c) =>
      (c.acquisitions[0].time = {
        state: "known",
        kind: "instant",
        value: "2026-07-28T12:10:30Z",
        timeScale: "UTC",
      }),
    review: (r) => {
      r.measurements[0].timing.lower = "2026-07-28T12:10:30Z";
      r.measurements[0].timing.upper = "2026-07-28T12:10:30Z";
    },
  });
  v.release.sessions[0].time.end = "2026-07-28T12:10:30Z";
  assert.ok(
    (await run(v)).issues.some((i) => i.code === "DATASET.OUTSIDE_SESSION")
  );
});
test("no hash service never passes", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    assert.equal((await run(inputs())).checks.profile, "not_checked");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
