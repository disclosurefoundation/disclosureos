import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluatePhysicalSamples as evaluate,
  PhysicalSampleSelectionSchema,
  physicalSampleSelectionJsonSchema,
  PHYSICAL_SAMPLE_PROFILE,
  PHYSICAL_SAMPLE_REQUIREMENTS,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const root = new URL("../examples/v2/physical-sample-demo/", import.meta.url);
const example = () => ({
  history: JSON.parse(readFileSync(new URL("history.json", root))),
  selection: JSON.parse(readFileSync(new URL("selection.json", root))),
  assets: new Map([
    [
      "source:report",
      new Uint8Array(readFileSync(new URL("custody.txt", root))),
    ],
  ]),
});
const run = (v = example()) =>
  evaluate(v.history, v.selection, { assets: v.assets });
const sample = (v) => v.selection.samples[0];
const req = (r, id, n = 0) =>
  r.samples[n].requirements.find((v) => v.id === id);
const unknown = () => ({
  state: "unknown",
  reason: "Not supplied in original records",
});
test("declared specimen custody passes without physical measurements or known event context", async () => {
  const v = example(),
    r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.validation, parseExperimentalClaimHistory(v.history));
  assert.deepEqual(r.selection, v.selection);
  assert.equal(r.validation.data.observation.measurements.length, 0);
  assert.equal(r.validation.data.observation.eventTime.state, "unknown");
  assert.equal(r.validation.data.observation.position.state, "unknown");
  assert.equal(r.samples[0].records.length, 1);
  assert.equal(req(r, "record_integrity").status, "satisfied");
  for (const k of [
    "specimenIdentity",
    "collectionAuthenticity",
    "custodyAuthenticity",
    "custodyCompleteness",
    "custodyChronology",
    "recordContents",
    "contaminationControl",
    "composition",
    "origin",
    "redistributionRights",
    "assessmentSupport",
    "scientificEligibility",
  ])
    assert.equal(r[k], "not_checked");
  assert.equal("score" in r, false);
  assert.equal(Object.isFrozen(PHYSICAL_SAMPLE_PROFILE), true);
  assert.ok(
    Object.isFrozen(PHYSICAL_SAMPLE_REQUIREMENTS) &&
      PHYSICAL_SAMPLE_REQUIREMENTS.every(Object.isFrozen)
  );
});
for (const [field, requirement, code] of [
  ["label", "sample_identity", "SAMPLE.LABEL"],
  ["collection", "collection_record", "SAMPLE.COLLECTION"],
  ["custody", "custody_record", "SAMPLE.CUSTODY"],
  ["currentCustodian", "current_custodian", "SAMPLE.CURRENT_CUSTODIAN"],
])
  test("unknown " + field + " remains an actionable gap", async () => {
    const v = example();
    sample(v)[field] = unknown();
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(req(r, requirement).status, "missing");
    assert.ok(r.issues.some((i) => i.code === code && i.nextAction));
    assert.equal(r.selection.samples[0][field].state, "unknown");
  });
for (const lineage of ["unknown", "derived_sample", "mixture"])
  test("lineage applicability " + lineage, async () => {
    const v = example();
    sample(v).lineage = lineage;
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(
      req(r, "sample_scope").status,
      lineage === "unknown" ? "missing" : "failed"
    );
    assert.deepEqual(req(r, "record_integrity").blockedBy, ["sample_scope"]);
    assert.deepEqual(r.samples[0].records, []);
    assert.equal(r.checks.external, "not_checked");
  });
test("zero handoffs can explicitly retain the collector", async () => {
  const v = example();
  sample(v).custody.transfers = [];
  sample(v).currentCustodian.holder = sample(v).collection.collectedBy;
  assert.equal((await run(v)).success, true);
});
test("zero handoffs cannot silently bridge different holders", async () => {
  const v = example();
  sample(v).custody.transfers = [];
  const r = await run(v);
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "SAMPLE.CUSTODY_ENDPOINT"));
});
for (const [label, edit, code] of [
  [
    "first sender",
    (s) => (s.custody.transfers[0].from = "Unrelated collector"),
    "SAMPLE.CUSTODY_BREAK",
  ],
  [
    "current holder",
    (s) => (s.currentCustodian.holder = "Unrelated store"),
    "SAMPLE.CUSTODY_ENDPOINT",
  ],
  [
    "self transfer",
    (s) => (s.custody.transfers[0].to = s.custody.transfers[0].from),
    "SAMPLE.SELF_TRANSFER",
  ],
  [
    "internal break",
    (s) =>
      s.custody.transfers.push({
        id: "second",
        from: "Unrelated store",
        to: s.currentCustodian.holder,
        recordRef: "source:report",
      }),
    "SAMPLE.CUSTODY_BREAK",
  ],
])
  test("known custody conflict: " + label, async () => {
    const v = example();
    edit(sample(v));
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(req(r, "custody_record").status, "failed");
    assert.ok(r.issues.some((i) => i.code === code));
  });
test("return to an earlier custodian is valid when every supplied handoff connects", async () => {
  const v = example(),
    s = sample(v);
  s.custody.transfers.push({
    id: "return",
    from: s.currentCustodian.holder,
    to: s.collection.collectedBy,
    recordRef: "source:report",
  });
  s.currentCustodian.holder = s.collection.collectedBy;
  assert.equal((await run(v)).success, true);
});
test("unknown collection blocks endpoint checking but not known internal conflicts", async () => {
  const v = example(),
    s = sample(v);
  s.collection = unknown();
  s.custody.transfers.push({
    id: "bad",
    from: "Unrelated",
    to: s.currentCustodian.holder,
    recordRef: "source:report",
  });
  const r = await run(v);
  assert.equal(req(r, "custody_record").status, "failed");
  assert.ok(r.issues.some((i) => i.code === "SAMPLE.CUSTODY_BREAK"));
});
test("unknown endpoints leave custody continuity unchecked", async () => {
  const v = example(),
    s = sample(v);
  s.collection = unknown();
  s.currentCustodian = unknown();
  const r = await run(v);
  assert.equal(req(r, "custody_record").status, "not_checked");
  assert.deepEqual(req(r, "custody_record").blockedBy, [
    "collection_record",
    "current_custodian",
  ]);
  assert.equal(r.checks.external, "passed");
  assert.equal(r.success, false);
});
test("no cited records cannot yield an integrity pass", async () => {
  const v = example(),
    s = sample(v);
  s.collection = unknown();
  s.currentCustodian = unknown();
  s.custody = unknown();
  const r = await run(v);
  assert.equal(req(r, "record_integrity").status, "not_checked");
  assert.equal(r.checks.external, "not_checked");
  assert.deepEqual(r.samples[0].records, []);
});
for (const mode of ["missing", "empty", "corrupt", "missing_digest"])
  test("record bytes: " + mode, async () => {
    const v = example();
    if (mode === "missing") v.assets.clear();
    else if (mode === "empty") v.assets.set("source:report", new Uint8Array());
    else if (mode === "corrupt") v.assets.get("source:report")[0] ^= 1;
    else delete v.history.observation.sources[0].digest;
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(
      r.checks.profile,
      mode === "missing" ? "not_checked" : "failed"
    );
    assert.equal(
      req(r, "record_integrity").status,
      mode === "missing" || mode === "missing_digest" ? "missing" : "failed"
    );
  });
for (const reverse of [false, true])
  test(
    "mixed bad and missing records preserve failure regardless of order " +
      reverse,
    async () => {
      const v = example(),
        s = sample(v);
      v.history.observation.sources.push({
        ...structuredClone(v.history.observation.sources[0]),
        id: "second",
      });
      s.currentCustodian.recordRef = "source:second";
      if (reverse) v.assets.set("source:second", new Uint8Array([0]));
      else v.assets.get("source:report")[0] ^= 1;
      if (reverse) v.assets.delete("source:report");
      const r = await run(v);
      assert.equal(r.success, false);
      assert.equal(r.checks.external, "failed");
      assert.equal(req(r, "record_integrity").status, "failed");
      assert.ok(
        req(r, "record_integrity").issues.some(
          (i) => i.code === "SAMPLE.DIGEST_MISMATCH"
        )
      );
      assert.ok(
        req(r, "record_integrity").issues.some(
          (i) => i.code === "SAMPLE.BYTES_UNAVAILABLE"
        )
      );
    }
  );
for (const access of ["public", "restricted", "withheld", "unknown"])
  test("record access stays " + access, async () => {
    const v = example();
    v.history.observation.sources[0].access = access;
    const r = await run(v);
    assert.equal(r.success, true);
    assert.equal(r.validation.data.observation.sources[0].access, access);
    assert.equal(r.redistributionRights, "not_checked");
  });
test("catalog identifier is a non-blocking unverified recommendation", async () => {
  const v = example();
  let r = await run(v);
  assert.equal(r.success, true);
  assert.equal(req(r, "catalog_identifier").status, "missing");
  assert.equal(req(r, "catalog_identifier").issues[0].severity, "warning");
  sample(v).catalogIdentifier = "Synthetic external catalog label";
  r = await run(v);
  assert.equal(r.success, true);
  assert.equal(req(r, "catalog_identifier").status, "satisfied");
});
test("unselected incomplete source records do not penalize selected samples", async () => {
  const v = example();
  v.history.observation.sources.push({
    id: "unused",
    kind: "unknown",
    access: "unknown",
  });
  v.assets.set("source:unused", new Uint8Array());
  assert.equal((await run(v)).success, true);
});
test("multiple sample declarations retain independent checklist results", async () => {
  const v = example();
  v.selection.samples.push({
    ...structuredClone(sample(v)),
    id: "second",
    label: unknown(),
  });
  const r = await run(v);
  assert.equal(r.success, false);
  assert.equal(r.samples[0].status, "passed");
  assert.equal(r.samples[1].status, "failed");
  assert.equal(r.samples[0].records[0].status, "passed");
});
for (const [name, edit] of [
  ["empty samples", (v) => (v.selection.samples = [])],
  [
    "duplicate samples",
    (v) => v.selection.samples.push(structuredClone(sample(v))),
  ],
  ["history mismatch", (v) => (v.selection.historyId = "other")],
  ["observation mismatch", (v) => (v.selection.observationId = "other")],
  [
    "unknown collection ref",
    (v) => (sample(v).collection.recordRef = "source:absent"),
  ],
  [
    "unknown transfer ref",
    (v) => (sample(v).custody.transfers[0].recordRef = "source:absent"),
  ],
  [
    "unknown current ref",
    (v) => (sample(v).currentCustodian.recordRef = "source:absent"),
  ],
  [
    "duplicate transfers",
    (v) =>
      sample(v).custody.transfers.push(
        structuredClone(sample(v).custody.transfers[0])
      ),
  ],
  ["extra key", (v) => (v.selection.extra = true)],
  [
    "invalid history",
    (v) => (v.history.observation.sources[0].unexpected = true),
  ],
  ["blank collector", (v) => (sample(v).collection.collectedBy = " ")],
  [
    "blank unknown reason",
    (v) => (sample(v).collection = { state: "unknown", reason: " " }),
  ],
  ["invalid lineage", (v) => (sample(v).lineage = "certified")],
  ["missing label", (v) => delete sample(v).label],
])
  test("invalid selection/history: " + name, async () => {
    const v = example();
    edit(v);
    const r = await run(v);
    assert.equal(r.success, false);
    assert.deepEqual(r.samples, []);
    assert.ok(r.issues.length);
  });
test("a confirmed assessment is preserved without endorsement", async () => {
  const v = example();
  v.history.observation.methods = [{ id: "review", version: "1" }];
  v.history.claims = [
    {
      id: "assessment",
      kind: "assessment",
      recordedAt: "2026-09-08T00:00:00Z",
      topic: "synthetic origin",
      subject: { kind: "observation" },
      status: "assessed",
      outcome: "confirmed",
      evaluatedBy: "person:synthetic",
      evaluatedAt: "2026-09-08T00:00:00Z",
      methodRef: "method:review",
      methodVersion: "1",
      inputRefs: ["source:report"],
      rationale: "Synthetic declaration; no scientific support",
    },
  ];
  const r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(r.assessmentSupport, "not_checked");
  assert.equal(r.origin, "not_checked");
  assert.equal(r.validation.data.claims[0].outcome, "confirmed");
});
test("byte checks are offline and unavailable hashing remains unchecked", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    fetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected network request");
    };
    assert.equal((await run()).success, true);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const r = await run();
    assert.equal(r.success, false);
    assert.equal(r.checks.profile, "not_checked");
    assert.equal(req(r, "record_integrity").status, "not_checked");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
    globalThis.fetch = fetch;
  }
});
test("history, selection and bytes are snapshotted before asynchronous work", async () => {
  const v = example(),
    before = structuredClone(v);
  assert.equal((await run(v)).success, true);
  assert.deepEqual(v, before);
  const pending = run(v);
  v.selection.samples = [];
  v.history.observation.sources = [];
  v.assets.get("source:report").fill(0);
  const r = await pending;
  assert.equal(r.success, true);
  assert.deepEqual(r.selection, before.selection);
});
test("schema artifact and independent validation agree with runtime", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/physical-sample-selection-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, physicalSampleSelectionJsonSchema());
  const check = new Ajv2020({ strict: false }).compile(schema);
  for (const [edit, expected] of [
    [(s) => {}, true],
    [(s) => (s.samples = []), false],
    [(s) => (s.samples[0].custody = unknown()), true],
    [(s) => (s.samples[0].collection.recordRef = "source:../escape"), false],
    [(s) => (s.samples[0].currentCustodian.holder = " "), false],
    [(s) => (s.samples[0].lineage = "mixture"), true],
    [(s) => (s.samples[0].custody.transfers[0].extra = true), false],
    [(s) => (s.schemaVersion = "2"), false],
  ]) {
    const s = example().selection;
    edit(s);
    assert.equal(check(s), expected);
    assert.equal(PhysicalSampleSelectionSchema.safeParse(s).success, expected);
  }
});
