import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  evaluateMeasurementBindings,
  measurementBindingsJsonSchema,
  MeasurementBindingsSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const packet = JSON.parse(
  readFileSync(
    new URL("./v2-acquisition-bindings-fixtures.json", import.meta.url)
  )
);
const corpus = JSON.parse(
  readFileSync(
    new URL("./v2-measurement-bindings-fixtures.json", import.meta.url)
  )
);
const mapping = corpus.base.mapping;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validators = [
  ["mapping", "disclosureos-schema", "measurement-bindings"],
  ["bindings", "disclosureos-schema", "acquisition-bindings"],
  ["history", "disclosureos-records", "claim-history"],
  ["context", "disclosureos-instruments", "acquisition-context"],
].map(([key, pkg, name]) => [
  key,
  ajv.compile(
    JSON.parse(
      readFileSync(
        new URL(
          `../packages/${pkg}/schema/experimental/${name}-0.1.0.schema.json`,
          import.meta.url
        )
      )
    )
  ),
]);
function inputs() {
  return structuredClone(corpus.base);
}
function assets() {
  return new Map(
    Object.entries(corpus.assets).map(([ref, text]) => [
      ref,
      new TextEncoder().encode(text),
    ])
  );
}
function run(v, options = { assets: assets() }) {
  return evaluateMeasurementBindings(
    v.history,
    v.context,
    v.bindings,
    v.mapping,
    options
  );
}
for (const fixture of corpus.cases)
  test(fixture.id, async () => {
    const v = inputs();
    for (const change of fixture.changes) {
      let target = v;
      for (const part of change.path.slice(0, -1)) {
        assert.ok(Object.hasOwn(target, part));
        target = target[part];
      }
      const key = change.path.at(-1);
      assert.ok(!["__proto__", "constructor", "prototype"].includes(key));
      if (change.op === "remove") delete target[key];
      else
        Object.defineProperty(target, key, {
          value: structuredClone(change.value),
          writable: true,
          enumerable: true,
          configurable: true,
        });
    }
    const before = structuredClone(v);
    const r = await run(v);
    assert.equal(
      validators.every(([key, validate]) => validate(v[key])),
      r.checks.structural === "passed"
    );
    assert.equal(r.checks.profile, fixture.profile, JSON.stringify(r.issues));
    assert.equal(r.success, fixture.profile === "passed");
    for (const code of fixture.codes)
      assert.ok(
        r.issues.some((i) => i.code === code),
        JSON.stringify(r.issues)
      );
    assert.equal(r.scientific, "not_checked");
    assert.deepEqual(v, before);
  });
test("missing bytes remains unchecked", async () => {
  assert.equal((await run(inputs(), {})).checks.profile, "not_checked");
});
test("corruption propagates", async () => {
  const a = assets();
  a.get("product:captured-raw")[0] ^= 1;
  assert.equal((await run(inputs(), { assets: a })).checks.profile, "failed");
});
test("no vacuous pass", async () => {
  const v = inputs();
  v.history.claims = [];
  v.history.observation.measurements = [];
  v.history.observation.assertions = [];
  v.mapping.measurements = [];
  assert.equal((await run(v)).checks.profile, "not_checked");
});
test("snapshots documents and bytes before async work", async () => {
  const v = inputs();
  const a = assets();
  const pending = run(v, { assets: a });
  v.mapping.measurements[0].channelId = "bad";
  v.context.acquisitions[0].channels = [];
  v.history.observation.measurements = [];
  for (const b of a.values()) b.fill(0);
  assert.equal((await pending).success, true);
});
test("portable strict schema and immutable artifact", () => {
  const schema = measurementBindingsJsonSchema();
  assert.deepEqual(
    schema,
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/measurement-bindings-0.1.0.schema.json",
          import.meta.url
        )
      )
    )
  );
  const validate = new Ajv2020({ strict: false }).compile(schema);
  for (const change of [
    () => {},
    (v) => (v.extra = true),
    (v) => (v.measurements[0].time.timeScale = "TAI"),
    (v) => (v.measurements[0].measurementRef = "measurement:velocity\n"),
    (v) => (v.measurements[0].channelId = ""),
  ]) {
    const v = structuredClone(mapping);
    change(v);
    assert.equal(validate(v), MeasurementBindingsSchema.safeParse(v).success);
  }
});
test("declared but uncaptured channel is rejected", async () => {
  const v = inputs();
  v.context.manifests[0].channels.push({
    ...v.context.manifests[0].channels[0],
    id: "unused",
  });
  v.mapping.measurements[0].channelId = "unused";
  const r = await run(v);
  assert.ok(r.issues.some((i) => i.code === "MEASUREMENT.CHANNEL"));
});
test("unit conversion is never inferred", async () => {
  const v = inputs();
  for (const value of [
    v.history.observation.measurements[0].value,
    v.history.observation.assertions[0].value,
  ]) {
    value.unit = "km/h";
    value.uncertainty.unit = "km/h";
  }
  const r = await run(v);
  assert.ok(
    r.issues.some((i) => i.code === "MEASUREMENT.UNIT"),
    JSON.stringify(r.issues)
  );
});
test("multiple instrument products cannot be hidden behind one mapping", async () => {
  const v = inputs();
  v.history.observation.products.push({
    ...v.history.observation.products[0],
    id: "other",
  });
  v.history.observation.processing[0].inputRefs.push("product:other");
  const r = await run(v);
  assert.ok(r.issues.some((i) => i.code === "MEASUREMENT.MULTI_PRODUCT"));
});
test("unknown acquisition time stays incomplete", async () => {
  const v = inputs();
  v.context.acquisitions[0].time = {
    state: "unknown",
    reason: "not_collected",
  };
  const r = await run(v);
  assert.ok(r.issues.some((i) => i.code === "MEASUREMENT.CAPTURE_UNKNOWN"));
});
test("point acquisition supports only that instant", async () => {
  const v = inputs();
  v.context.acquisitions[0].time = structuredClone(
    v.mapping.measurements[0].time
  );
  assert.equal((await run(v)).success, true);
  v.mapping.measurements[0].time.value = "2026-07-28T12:10:00.000000000001Z";
  assert.ok(
    (await run(v)).issues.some((i) => i.code === "MEASUREMENT.OUTSIDE_CAPTURE")
  );
  v.mapping.measurements[0].time = {
    state: "known",
    kind: "interval",
    start: "2026-07-28T12:10:00Z",
    end: "2026-07-28T12:10:01Z",
    timeScale: "UTC",
  };
  assert.ok(
    (await run(v)).issues.some((i) => i.code === "MEASUREMENT.OUTSIDE_CAPTURE")
  );
});
test("invalid input skips dependent checks", async () => {
  const v = inputs();
  v.mapping.unexpected = true;
  const r = await run(v);
  assert.equal(r.checks.structural, "failed");
  assert.equal(r.checks.semantic, "not_checked");
  assert.equal(r.checks.profile, "not_checked");
  assert.equal(r.acquisition, null);
});
test("upstream cross-document failure cannot pass", async () => {
  const v = inputs();
  v.bindings.contextId = "wrong";
  const r = await run(v);
  assert.equal(r.checks.semantic, "failed");
  assert.equal(r.success, false);
  assert.equal(r.checks.profile, "not_checked");
});
test("no implicit retrieval", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    assert.equal((await run(inputs(), {})).checks.profile, "not_checked");
  } finally {
    globalThis.fetch = previous;
  }
});

test("synthetic example and fixture packet agree", async () => {
  const base = new URL(
    "../examples/v2/acquisition-binding-demo/",
    import.meta.url
  );
  const values = Object.fromEntries(
    ["history", "context", "bindings", "measurements"].map((name) => [
      name === "measurements" ? "mapping" : name,
      JSON.parse(readFileSync(new URL(`${name}.json`, base))),
    ])
  );
  assert.deepEqual(values, corpus.base);
  assert.deepEqual(corpus.assets, packet.assets);
  assert.equal(
    new Set(corpus.cases.map((c) => c.id)).size,
    corpus.cases.length
  );
  const local = new Map(
    Object.entries(corpus.assets).map(([ref, text]) => {
      const bytes = readFileSync(
        new URL(`assets/${ref.replace(":", "-").replace("/", "-")}.txt`, base)
      );
      assert.equal(bytes.toString(), text);
      return [ref, new Uint8Array(bytes)];
    })
  );
  assert.equal((await run(values, { assets: local })).success, true);
});
