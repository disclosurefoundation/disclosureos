import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { fixture } from "../examples/v2/video-frame-source-demo/fixture.mjs";
import {
  evaluateVideoFrameSourceMapping,
  readVideoFrameReference,
  VideoFrameSourceMappingSchema,
  videoFrameSourceMappingJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const run = (f) => evaluateVideoFrameSourceMapping(f.observation, f.mapping, f);
test("relative frame identity preserves large PTS, irregular cadence and duplicate times", async () => {
  const f = fixture(),
    r = await run(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    frameTiming: "passed",
  });
  const ref = r.selections[0].reference;
  assert.equal(ref.frameIndex, 2);
  assert.equal(ref.presentationTick, "9007199254744593");
  assert.deepEqual(ref.presentationSeconds, {
    numerator: "9007199254744593",
    denominator: "90000",
  });
  assert.deepEqual(ref.offsetFromFirstFrameSeconds, {
    numerator: "3600",
    denominator: "90000",
  });
  for (const key of [
    "captureTime",
    "pixelContent",
    "scientific",
    "calibration",
  ])
    assert.equal(r[key], "not_checked");
  assert.equal(f.observation.eventTime.state, "unknown");
});
test("negative source PTS are preserved without inventing a wall clock", async () => {
  const f = fixture();
  f.mapping.streams[0].presentationTicks = ["-40", "0", "50", "100"];
  f.streams[0].presentationTicks = ["-40", "0", "50", "100"];
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(
    r.selections[0].reference.offsetFromFirstFrameSeconds.numerator,
    "90"
  );
  assert.equal(
    readVideoFrameReference(f.mapping, 2, 0).presentationSeconds.numerator,
    "-40"
  );
});
for (const [name, mutate, stage] of [
  [
    "unknown observation",
    (f) => (f.mapping.observationId = "other"),
    "semantic",
  ],
  [
    "unknown product",
    (f) => (f.mapping.productRef = "product:other"),
    "semantic",
  ],
  [
    "different product digest",
    (f) => (f.mapping.digest.value = "0".repeat(64)),
    "semantic",
  ],
  [
    "different media type",
    (f) => (f.mapping.mediaType = "video/webm"),
    "semantic",
  ],
  [
    "missing indexer",
    (f) => (f.mapping.indexer.methodRef = "method:other"),
    "semantic",
  ],
  [
    "wrong method version",
    (f) => (f.mapping.indexer.methodVersion = "2"),
    "semantic",
  ],
  [
    "duplicate stream",
    (f) => f.mapping.streams.push(structuredClone(f.mapping.streams[0])),
    "semantic",
  ],
  [
    "duplicate selection",
    (f) => f.mapping.selections.push(structuredClone(f.mapping.selections[0])),
    "semantic",
  ],
  [
    "descending PTS",
    (f) => (f.mapping.streams[0].presentationTicks[1] = "0"),
    "semantic",
  ],
  [
    "absent selected stream",
    (f) => (f.mapping.selections[0].streamIndex = 0),
    "semantic",
  ],
  [
    "frame past end",
    (f) => (f.mapping.selections[0].frameIndex = 4),
    "semantic",
  ],
  [
    "negative frame",
    (f) => (f.mapping.selections[0].frameIndex = -1),
    "structural",
  ],
  [
    "fractional frame",
    (f) => (f.mapping.selections[0].frameIndex = 1.5),
    "structural",
  ],
  [
    "unsafe frame",
    (f) => (f.mapping.selections[0].frameIndex = 9007199254740992),
    "structural",
  ],
  [
    "empty timestamps",
    (f) => (f.mapping.streams[0].presentationTicks = []),
    "structural",
  ],
  [
    "numeric PTS",
    (f) => (f.mapping.streams[0].presentationTicks[0] = 9007199254740992),
    "structural",
  ],
  [
    "padded PTS",
    (f) => (f.mapping.streams[0].presentationTicks[0] = "01"),
    "structural",
  ],
  [
    "negative zero PTS",
    (f) => (f.mapping.streams[0].presentationTicks[0] = "-0"),
    "structural",
  ],
  [
    "fractional PTS",
    (f) => (f.mapping.streams[0].presentationTicks[0] = "1.2"),
    "structural",
  ],
  [
    "zero time base",
    (f) => (f.mapping.streams[0].timeBase.denominator = 0),
    "structural",
  ],
  ["non-video type", (f) => (f.mapping.mediaType = "text/csv"), "structural"],
  [
    "undeclared UTC",
    (f) => (f.mapping.start = "2026-01-01T00:00:00Z"),
    "structural",
  ],
  ["changed bytes", (f) => f.assets.get("product:video")[0]++, "external"],
  ["incorrect byte length", (f) => f.mapping.byteLength++, "external"],
  [
    "wrong decoded stream",
    (f) => (f.streams[0].streamIndex = 1),
    "frameTiming",
  ],
  [
    "truncated decoded index",
    (f) => f.streams[0].presentationTicks.pop(),
    "frameTiming",
  ],
  [
    "different decoded PTS",
    (f) => (f.streams[0].presentationTicks[0] = "0"),
    "frameTiming",
  ],
  [
    "different decoder time base",
    (f) => (f.streams[0].timeBase.denominator = 1),
    "frameTiming",
  ],
  [
    "extra decoded stream",
    (f) => f.streams.push(structuredClone(f.streams[0])),
    "frameTiming",
  ],
  [
    "decoder error",
    (f) =>
      (f.resolveFrameIndex = () => {
        throw Error("unreadable");
      }),
    "frameTiming",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    const r = await run(f);
    assert.equal(r.success, false);
    assert.equal(r.checks[stage], "failed", JSON.stringify(r));
    assert.ok(r.selections.every((s) => s.reference === undefined));
  });
test("no assets or no decoder is not successful timing verification", async () => {
  const f = fixture();
  let called = false;
  const r = await evaluateVideoFrameSourceMapping(f.observation, f.mapping, {
    resolveFrameIndex: () => {
      called = true;
      return f.streams;
    },
  });
  assert.equal(called, false);
  assert.equal(r.checks.external, "not_checked");
  assert.equal(r.success, false);
  const bytesOnly = await evaluateVideoFrameSourceMapping(
    f.observation,
    f.mapping,
    { assets: f.assets }
  );
  assert.equal(bytesOnly.checks.external, "passed");
  assert.equal(bytesOnly.checks.frameTiming, "not_checked");
  assert.equal(bytesOnly.success, false);
});
test("bad bytes never reach the decoder", async () => {
  const f = fixture();
  f.assets.get("product:video")[0]++;
  f.resolveFrameIndex = () => {
    assert.fail("decoder must not run");
  };
  assert.equal((await run(f)).checks.external, "failed");
});
test("source bytes and input documents are isolated across awaits", async () => {
  const f = fixture(),
    pending = run(f);
  f.mapping.streams[0].presentationTicks[0] = "0";
  f.assets.get("product:video").fill(0);
  f.observation.products.length = 0;
  assert.equal((await pending).success, true);
});
test("multiple video streams keep separate coordinates", async () => {
  const f = fixture(),
    s = {
      streamIndex: 4,
      timeBase: { numerator: 1001, denominator: 30000 },
      presentationTicks: ["0", "1", "2"],
    };
  f.mapping.streams.push(structuredClone(s));
  f.streams.push(s);
  f.mapping.selections.push({
    id: "other-stream",
    streamIndex: 4,
    frameIndex: 1,
  });
  const r = await run(f);
  assert.equal(r.success, true);
  assert.deepEqual(r.selections[1].reference.presentationSeconds, {
    numerator: "1001",
    denominator: "30000",
  });
});
test("JSON schema and runtime structure agree; published output is exact", () => {
  const emitted = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/video-frame-source-mapping-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(emitted, videoFrameSourceMappingJsonSchema());
  const validate = new Ajv2020({ strict: true }).compile(emitted);
  const f = fixture();
  for (const v of [
    f.mapping,
    { ...f.mapping, start: "UTC" },
    { ...f.mapping, selections: [] },
    { ...f.mapping, byteLength: -1 },
  ])
    assert.equal(
      validate(v),
      VideoFrameSourceMappingSchema.safeParse(v).success
    );
});
