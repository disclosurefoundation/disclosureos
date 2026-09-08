import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createHash } from "node:crypto";
import {
  evaluateInstrumentResearchPrerequisites,
  InstrumentResearchReviewSchema,
  instrumentResearchReviewJsonSchema,
  INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const corpus = JSON.parse(
  readFileSync(
    new URL("./v2-research-prerequisites-fixtures.json", import.meta.url)
  )
);
const schema = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/instrument-research-review-0.1.0.schema.json",
      import.meta.url
    )
  )
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validators = [
  ["review", "disclosureos-schema", "instrument-research-review"],
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
const input = () => structuredClone(corpus.base);
const assets = () =>
  Object.fromEntries(
    Object.entries(corpus.assets).map(([namespace, items]) => [
      namespace,
      new Map(
        Object.entries(items).map(([ref, text]) => [
          ref,
          new TextEncoder().encode(text),
        ])
      ),
    ])
  );
const run = (v, options = assets()) =>
  evaluateInstrumentResearchPrerequisites(
    v.history,
    v.context,
    v.bindings,
    v.mapping,
    v.review,
    options
  );
for (const fixture of corpus.cases)
  test(fixture.id, async () => {
    const v = input();
    for (const change of fixture.changes) {
      let target = v;
      for (const part of change.path.slice(0, -1)) {
        assert.ok(Object.hasOwn(target, part));
        target = target[part];
      }
      const key = change.path.at(-1);
      assert.ok(!["__proto__", "constructor", "prototype"].includes(key));
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
      fixture.structural
    );
    assert.equal(r.checks.structural, fixture.structural ? "passed" : "failed");
    assert.equal(r.checks.profile, fixture.profile, JSON.stringify(r.issues));
    assert.equal(r.success, fixture.profile === "passed");
    if (fixture.structural) assert.deepEqual(r.review, {id:v.review.id,purpose:v.review.purpose});
    for (const code of fixture.codes)
      assert.ok(
        r.issues.some((i) => i.code === code),
        JSON.stringify(r.issues)
      );
    for (const field of [
      "scientificEligibility",
      "calibrationAdequacy",
      "timingModel",
      "reviewerAuthenticity",
    ])
      assert.equal(r[field], "not_checked");
    assert.deepEqual(v, before);
  });
test("contract artifact and identity", () => {
  assert.deepEqual(schema, instrumentResearchReviewJsonSchema());
  assert.equal(
    InstrumentResearchReviewSchema.safeParse(corpus.base.review).success,
    true
  );
  assert.ok(Object.isFrozen(INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE));
  assert.equal(
    new Set(corpus.cases.map((c) => c.id)).size,
    corpus.cases.length
  );
});
for (const namespace of Object.keys(corpus.assets))
  test(`missing ${namespace} never passes`, async () => {
    const a = assets();
    delete a[namespace];
    assert.equal((await run(input(), a)).checks.profile, "not_checked");
  });
for (const [namespace, entries] of Object.entries(corpus.assets))
  for (const ref of Object.keys(entries))
    test(`corrupt ${namespace} ${ref}`, async () => {
      const a = assets();
      a[namespace].get(ref)[0] ^= 1;
      const r = await run(input(), a);
      assert.equal(r.success, false);
      assert.equal(r.checks.profile, "failed");
    });
test("review report length mismatch", async () => {
  const a = assets();
  a.reviewAssets.set("measurement:velocity/timing", new Uint8Array());
  assert.ok(
    (await run(input(), a)).issues.some(
      (i) => i.code === "RESEARCH.REPORT_SIZE"
    )
  );
});
test("snapshot all documents and all namespaces before hashing", async () => {
  const v = input(),
    a = assets();
  const pending = run(v, a);
  v.review.measurements[0].timing.upper = "invalid";
  v.history.claims = [];
  v.context.calibrations = [];
  v.mapping.measurements = [];
  v.bindings.products = [];
  for (const values of Object.values(a))
    for (const bytes of values.values()) bytes.fill(0);
  assert.equal((await pending).success, true);
});
test("offline and no implicit retrieval", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    assert.equal((await run(input(), {})).checks.profile, "not_checked");
  } finally {
    globalThis.fetch = previous;
  }
});
test("synthetic packet from disk reproduces checks", async () => {
  const folder = new URL(
    "../examples/v2/research-prerequisites-demo/",
    import.meta.url
  );
  const v = Object.fromEntries(
    Object.keys(corpus.base).map((key) => [
      key,
      JSON.parse(readFileSync(new URL(`${key}.json`, folder))),
    ])
  );
  assert.deepEqual(v, corpus.base);
  const a = Object.fromEntries(
    Object.entries(corpus.assets).map(([namespace, entries]) => [
      namespace,
      new Map(
        Object.entries(entries).map(([ref, text]) => {
          const bytes = readFileSync(
            new URL(
              `${namespace}/${ref.replace(":", "-").replace("/", "-")}.txt`,
              folder
            )
          );
          assert.equal(bytes.toString(), text);
          return [ref, new Uint8Array(bytes)];
        })
      ),
    ])
  );
  const r = await run(v, a);
  assert.equal(r.success, true);
  for (const check of r.reviewAssets)
    assert.equal(
      check.actualSha256,
      createHash("sha256").update(a.reviewAssets.get(check.ref)).digest("hex")
    );
});
test("no current assessment stays unchecked", async () => {
  const v = input();
  v.history.claims = [];
  assert.equal((await run(v)).checks.profile, "not_checked");
});
test("unknown measurement uncertainty fails even when reviews accept", async () => {
  const v = input();
  for (const value of [
    v.history.observation.measurements[0].value,
    v.history.observation.assertions[0].value,
  ])
    value.uncertainty = { kind: "unknown", reason: "not_characterized" };
  assert.ok(
    (await run(v)).issues.some(
      (i) => i.code === "RESEARCH.MEASUREMENT_UNCERTAINTY"
    )
  );
});
test("unknown calibration and deployment windows cannot be replaced by a review", async () => {
  for (const [collection, field] of [
    ["calibrations", "validity"],
    ["deployments", "period"],
  ]) {
    const v = input();
    v.context[collection][0][field] = {
      state: "unknown",
      reason: "not_collected",
    };
    assert.ok(
      (await run(v)).issues.some((i) => i.code === "RESEARCH.WINDOW_UNKNOWN")
    );
  }
});
test("coverage interval cannot masquerade as an absolute bound", () => {
  const v = input();
  v.review.measurements[0].timing.kind = "bound";
  assert.equal(
    InstrumentResearchReviewSchema.safeParse(v.review).success,
    false
  );
  assert.equal(validators[0][1](v.review), false);
});
test("whole nominal measurement interval must be enclosed", async () => {
  const v = input();
  v.mapping.measurements[0].time = {
    state: "known",
    kind: "interval",
    start: "2026-07-28T12:10:30Z",
    end: "2026-07-28T12:10:31Z",
    timeScale: "UTC",
  };
  assert.ok(
    (await run(v)).issues.some((i) => i.code === "RESEARCH.NOMINAL_ENCLOSURE")
  );
  v.review.measurements[0].timing.upper = "2026-07-28T12:10:31.1Z";
  assert.equal((await run(v)).success, true);
});
test("point acquisition cannot contain a nonzero reviewed interval", async () => {
  const v = input();
  v.context.acquisitions[0].time = structuredClone(
    v.mapping.measurements[0].time
  );
  assert.ok(
    (await run(v)).issues.some(
      (i) => i.code === "RESEARCH.TIMING_OUTSIDE_WINDOW"
    )
  );
  v.review.measurements[0].timing.lower =
    v.review.measurements[0].timing.upper = "2026-07-28T12:10:30Z";
  assert.equal((await run(v)).success, true);
});
test("unavailable hashing never passes", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    assert.equal((await run(input())).checks.profile, "not_checked");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
