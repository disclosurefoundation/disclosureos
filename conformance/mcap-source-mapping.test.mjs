import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { fixture } from "../examples/v2/mcap-source-demo/fixture.mjs";
import { digest } from "../examples/v2/product-source-demo/fixture.mjs";
import {
  evaluateMcapSourceMapping,
  McapSourceMappingSchema,
  mcapSourceMappingJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const run = (f) =>
  evaluateMcapSourceMapping(f.observation, f.mapping, {
    assets: f.assets,
    resolveMessage: f.resolveMessage,
  });

test("exact source identity, payload scalar and nanosecond precision", async () => {
  const f = fixture(),
    r = await run(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    content: "passed",
  });
  assert.equal(r.selections[0].value, 1.25);
  assert.equal(r.units, "not_checked");
  assert.equal(r.scientific, "not_checked");
});
for (const [name, mutate, stage] of [
  [
    "wrong recording hash",
    (f) =>
      (f.mapping.recordings[0].digest = {
        algorithm: "sha256",
        value: "0".repeat(64),
      }),
    "semantic",
  ],
  [
    "wrong observation",
    (f) => (f.mapping.observationId = "elsewhere"),
    "semantic",
  ],
  [
    "missing measurement",
    (f) => (f.mapping.selections[0].measurementRef = "measurement:other"),
    "semantic",
  ],
  [
    "unrelated lineage",
    (f) => (f.observation.measurements[0].sourceRefs = ["source:sensor"]),
    "semantic",
  ],
  [
    "wrong decoder version",
    (f) => (f.mapping.channels[0].decoder.methodVersion = "2"),
    "semantic",
  ],
  [
    "duplicate channel",
    (f) => f.mapping.channels.push(structuredClone(f.mapping.channels[0])),
    "semantic",
  ],
  [
    "duplicate measurement mapping",
    (f) =>
      f.mapping.selections.push({ ...f.mapping.selections[0], id: "another" }),
    "semantic",
  ],
  [
    "out of file",
    (f) => (f.mapping.selections[0].message.location.offset = "64"),
    "semantic",
  ],
  [
    "unsafe numeric timestamp",
    (f) => (f.mapping.selections[0].message.logTimeNs = 9007199254740992),
    "structural",
  ],
  [
    "negative timestamp",
    (f) => (f.mapping.selections[0].message.logTimeNs = "-1"),
    "structural",
  ],
  [
    "uint64 overflow",
    (f) => (f.mapping.selections[0].message.logTimeNs = "18446744073709551616"),
    "structural",
  ],
  [
    "malformed pointer",
    (f) => (f.mapping.selections[0].payloadPointer = "/bad~2"),
    "structural",
  ],
  ["changed bytes", (f) => f.assets.get("product:mcap")[10]++, "external"],
  ["wrong channel", (f) => f.resolved.channelId++, "content"],
  [
    "wrong schema",
    (f) => (f.resolved.schema.digest.value = "0".repeat(64)),
    "content",
  ],
  [
    "wrong timestamp",
    (f) => (f.resolved.message.logTimeNs = "9007199254740994"),
    "content",
  ],
  [
    "wrong location",
    (f) => (f.resolved.message.location.offset = "17"),
    "content",
  ],
  [
    "missing field",
    (f) => (f.mapping.selections[0].payloadPointer = "/samples/4/0"),
    "content",
  ],
  [
    "nonfinite value",
    (f) => (f.resolved.decoded.samples[0][0] = NaN),
    "content",
  ],
  ["wrong scalar", (f) => (f.resolved.decoded.samples[0][0] = 2), "content"],
  [
    "inherited field",
    (f) => (f.mapping.selections[0].payloadPointer = "/constructor"),
    "content",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    const r = await run(f);
    assert.equal(r.success, false);
    assert.equal(r.checks[stage], "failed", JSON.stringify(r));
  });

test("no source or decoder means not checked, not verified", async () => {
  const f = fixture();
  for (const options of [
    {},
    { assets: f.assets },
    { resolveMessage: f.resolveMessage },
  ]) {
    const r = await evaluateMcapSourceMapping(
      f.observation,
      f.mapping,
      options
    );
    assert.equal(r.success, false);
    assert.equal(r.checks.content, "not_checked");
  }
});
test("corrupt bytes never reach the decoder", async () => {
  const f = fixture();
  f.assets.get("product:mcap")[0]++;
  f.resolveMessage = () => {
    throw new Error("must not run");
  };
  const r = await run(f);
  assert.equal(r.checks.external, "failed");
  assert.equal(
    r.issues.some((i) => i.message.includes("must not run")),
    false
  );
});
test("chunk positions are distinct from file offsets; repeated timestamps do not select messages", async () => {
  const f = fixture();
  f.mapping.selections[0].message.location = {
    kind: "chunk",
    chunkOffset: "16",
    recordOffset: "9007199254740993",
  };
  f.resolved.message = structuredClone(f.mapping.selections[0].message);
  assert.equal((await run(f)).success, true);
  f.observation.measurements.push({
    ...f.observation.measurements[0],
    id: "y",
    value: { ...f.observation.measurements[0].value, value: 2 },
  });
  f.mapping.selections.push({
    ...structuredClone(f.mapping.selections[0]),
    id: "y",
    measurementRef: "measurement:y",
  });
  f.mapping.selections[1].message.location.recordOffset = "9007199254740994";
  f.resolveMessage = ({ message }) => ({
    ...structuredClone(f.resolved),
    message,
    decoded: {
      samples: [[message.location.recordOffset.endsWith("4") ? 2 : 1.25]],
    },
  });
  assert.equal((await run(f)).success, true);
});
test("supports decoded product processing lineage and pins method versions", async () => {
  const f = fixture();
  f.observation.products.push({
    id: "decoded",
    kind: "derived",
    format: "application/json",
    access: "unknown",
    generatedBy: "process:decode",
  });
  f.observation.processing.push({
    id: "decode",
    methodRef: "method:payload",
    methodVersion: "1",
    performedBy: "test",
    performedAt: "2026-10-19T00:00:00Z",
    inputRefs: ["product:mcap"],
    outputRefs: ["product:decoded"],
  });
  f.observation.measurements[0].sourceRefs = ["product:decoded"];
  assert.equal((await run(f)).success, true);
});
test("caller mutation after invocation cannot change verified source", async () => {
  const f = fixture(),
    result = run(f);
  f.assets.get("product:mcap")[0]++;
  f.mapping.channels[0].topic = "/other";
  assert.equal((await result).success, true);
});
test("JSON Schema artifact parity, exact uint64 limits and strict keys", () => {
  const schema = mcapSourceMappingJsonSchema();
  assert.deepEqual(
    schema,
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/mcap-source-mapping-0.1.0.schema.json",
          import.meta.url
        )
      )
    )
  );
  const ajv = new Ajv2020({ strict: true }),
    validate = ajv.compile(schema);
  for (const value of [
    "0",
    "9007199254740993",
    "18446744073709551615",
    "18446744073709551616",
    "01",
    "-1",
    "1\n",
    1,
  ]) {
    const f = fixture();
    f.mapping.selections[0].message.logTimeNs = value;
    assert.equal(
      validate(f.mapping),
      McapSourceMappingSchema.safeParse(f.mapping).success,
      String(value)
    );
    assert.equal(
      validate(f.mapping),
      ["0", "9007199254740993", "18446744073709551615"].includes(value)
    );
  }
});

test("empty mappings retain source metadata without claiming a content check", async () => {
  const f = fixture();
  f.mapping.selections = [];
  const r = await run(f);
  assert.equal(r.checks.structural, "passed");
  assert.equal(r.checks.external, "passed");
  assert.equal(r.checks.content, "not_checked");
  assert.equal(r.success, false);
});
test("shared MCAP schema IDs cannot name different schema bytes", async () => {
  const f = fixture(),
    c = structuredClone(f.mapping.channels[0]);
  c.id = "other";
  c.channelId = 2;
  c.schema.digest.value = "0".repeat(64);
  f.mapping.channels.push(c);
  const r = await run(f);
  assert.equal(r.checks.semantic, "failed");
  assert(r.issues.some((i) => i.code === "MCAP.SCHEMA"));
});
