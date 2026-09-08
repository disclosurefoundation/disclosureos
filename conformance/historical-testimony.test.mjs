import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateHistoricalTestimony as evaluate,
  HistoricalTestimonySelectionSchema,
  historicalTestimonySelectionJsonSchema,
  HISTORICAL_TESTIMONY_REQUIREMENTS,
  HISTORICAL_TESTIMONY_PROFILE,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const root = new URL(
  "../examples/v2/historical-testimony-demo/",
  import.meta.url
);
const example = () => ({
  history: JSON.parse(readFileSync(new URL("history.json", root))),
  selection: JSON.parse(readFileSync(new URL("selection.json", root))),
  assets: new Map([
    [
      "source:report",
      new Uint8Array(readFileSync(new URL("account.txt", root))),
    ],
  ]),
});
const run = (v = example()) =>
  evaluate(v.history, v.selection, { assets: v.assets });
const row = (r, id, n = 0) =>
  r.accounts[n].requirements.find((x) => x.id === id);
test("testimony provenance passes without measurements, event dates or an assessment", async () => {
  const v = example(),
    r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.validation, parseExperimentalClaimHistory(v.history));
  assert.equal(v.history.observation.measurements.length, 0);
  assert.equal(v.history.observation.eventTime.state, "unknown");
  assert.equal(v.history.observation.position.state, "unknown");
  assert.equal(
    r.accounts[0].requirements.filter((r) => r.status === "satisfied").length,
    7
  );
  for (const k of [
    "recordingAuthenticity",
    "speakerIdentity",
    "accountAccuracy",
    "firsthandKnowledge",
    "witnessIndependence",
    "redistributionRights",
    "locatorContents",
    "extractionAccuracy",
    "assessmentSupport",
    "scientificEligibility",
  ])
    assert.equal(r[k], "not_checked");
  assert.equal("score" in r, false);
  assert.equal(Object.isFrozen(HISTORICAL_TESTIMONY_PROFILE), true);
  assert.ok(
    Object.isFrozen(HISTORICAL_TESTIMONY_REQUIREMENTS) &&
      HISTORICAL_TESTIMONY_REQUIREMENTS.every(Object.isFrozen)
  );
});
for (const [id, edit, code] of [
  [
    "recording_citation",
    (v) =>
      (v.selection.accounts[0].recording = {
        state: "unknown",
        reason: "Recording attribution not supplied",
      }),
    "TESTIMONY.RECORDING_CITATION",
  ],
  [
    "content_digest",
    (v) => delete v.history.observation.sources[0].digest,
    "TESTIMONY.DIGEST_REQUIRED",
  ],
  [
    "extraction_traceability",
    (v) => delete v.history.claims[0].provenance.locator,
    "TESTIMONY.LOCATOR_REQUIRED",
  ],
  [
    "extraction_traceability",
    (v) => delete v.history.claims[0].provenance.extractedBy,
    "TESTIMONY.EXTRACTOR_REQUIRED",
  ],
  [
    "extraction_traceability",
    (v) => delete v.history.claims[0].provenance.attributedTo,
    "TESTIMONY.SPEAKER_REQUIRED",
  ],
])
  test("missing required " + code, async () => {
    const v = example();
    edit(v);
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(row(r, id).status, "missing");
    assert.ok(r.issues.some((i) => i.code === code && i.nextAction));
    if (id === "content_digest") {
      assert.equal(row(r, "content_integrity").status, "not_checked");
      assert.deepEqual(row(r, "content_integrity").blockedBy, [
        "content_digest",
      ]);
    }
  });
for (const [id, edit] of [
  ["source_title", (v) => delete v.history.observation.sources[0].title],
  ["source_uri", (v) => delete v.history.observation.sources[0].uri],
])
  test("non-blocking recommendation " + id, async () => {
    const v = example();
    edit(v);
    const r = await run(v);
    assert.equal(r.success, true);
    assert.equal(row(r, id).importance, "recommended");
    assert.equal(row(r, id).status, "missing");
    assert.ok(
      row(r, id).issues.every(
        (i) => i.stage === "recommendation" && i.severity === "warning"
      )
    );
  });
for (const [kind, access, status] of [
  ["document", "public", "failed"],
  ["unknown", "public", "missing"],
  ["other", "unknown", "failed"],
  ["instrument_data", "public", "failed"],
])
  test(`selected source ${kind}/${access}`, async () => {
    const v = example();
    Object.assign(v.history.observation.sources[0], { kind, access });
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(row(r, "testimony_source").status, status);
    assert.equal(row(r, "content_integrity").status, "not_checked");
    assert.deepEqual(row(r, "content_integrity").blockedBy, [
      "testimony_source",
    ]);
    assert.equal(v.history.observation.sources[0].access, access);
  });
for (const mode of ["missing", "empty", "corrupt"])
  test(mode + " account bytes", async () => {
    const v = example();
    if (mode === "missing") v.assets.clear();
    else if (mode === "empty") v.assets.set("source:report", new Uint8Array());
    else v.assets.get("source:report")[0] ^= 1;
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(
      row(r, "content_integrity").status,
      mode === "missing" ? "missing" : "failed"
    );
    assert.equal(
      r.checks.external,
      mode === "missing" ? "not_checked" : "failed"
    );
    assert.equal(
      r.checks.profile,
      mode === "missing" ? "not_checked" : "failed"
    );
  });
test("no direct extraction makes extraction rows explicitly inapplicable", async () => {
  const v = example();
  v.history.claims = [];
  const r = await run(v);
  assert.equal(r.success, true);
  assert.equal(row(r, "extraction_traceability").status, "not_applicable");
  assert.deepEqual(r.accounts[0].extractionRefs, []);
});
test("current claims, not superseded extraction metadata, determine traceability", async () => {
  const v = example(),
    old = v.history.claims[0];
  const newer = {
    ...structuredClone(old),
    id: "new",
    recordedAt: "2026-09-08T00:00:00Z",
    supersedes: ["claim:statement"],
  };
  delete old.provenance.locator;
  delete old.provenance.extractedBy;
  v.history.claims.push(newer);
  const r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.accounts[0].extractionRefs, ["claim:new"]);
});
test("direct value assertions are checked too", async () => {
  const v = example();
  v.history.observation.assertions = [
    {
      id: "time",
      field: "eventTime",
      value: { kind: "date", value: "2026-01-01" },
      provenance: { sourceRef: "source:report" },
    },
  ];
  const r = await run(v);
  assert.equal(r.success, false);
  assert.ok(r.accounts[0].extractionRefs.includes("assertion:time"));
  assert.ok(
    r.issues.some(
      (i) => i.pointer === "/observation/assertions/0/provenance/locator"
    )
  );
});
test("passing selected account does not endorse a confirmed assessment", async () => {
  const v = example();
  v.history.observation.methods = [{ id: "review", version: "1" }];
  v.history.claims.push({
    id: "assessment",
    kind: "assessment",
    recordedAt: "2026-09-07T00:00:00Z",
    topic: "synthetic archival report",
    subject: { kind: "observation" },
    status: "assessed",
    outcome: "confirmed",
    evaluatedBy: "person:synthetic",
    evaluatedAt: "2026-09-07T00:00:00Z",
    methodRef: "method:review",
    methodVersion: "1",
    inputRefs: ["claim:statement"],
    rationale: "Synthetic declaration; not scientifically supported",
  });
  const r = await run(v);
  assert.equal(r.success, true);
  assert.equal(r.assessmentSupport, "not_checked");
  assert.equal(r.validation.data.claims.at(-1).outcome, "confirmed");
});
test("unselected incomplete accounts do not penalize selected provenance", async () => {
  const v = example();
  v.history.observation.sources.push({
    id: "other",
    kind: "document",
    access: "unknown",
  });
  assert.equal((await run(v)).success, true);
});
test("multiple accounts retain individual results", async () => {
  const v = example();
  v.history.observation.sources.push({
    ...structuredClone(v.history.observation.sources[0]),
    id: "second",
  });
  v.selection.accounts.push({
    sourceRef: "source:second",
    recording: { state: "unknown", reason: "No recording citation" },
  });
  const r = await run(v);
  assert.equal(r.success, false);
  assert.equal(r.accounts[0].status, "passed");
  assert.equal(r.accounts[1].status, "failed");
  assert.equal(row(r, "content_integrity", 1).status, "missing");
});
for (const edit of [
  (v) => (v.selection.accounts = []),
  (v) => v.selection.accounts.push(structuredClone(v.selection.accounts[0])),
  (v) => (v.selection.historyId = "other"),
  (v) => (v.selection.observationId = "other"),
  (v) => (v.selection.accounts[0].sourceRef = "source:missing"),
  (v) => (v.selection.extra = true),
  (v) => (v.history.observation.sources[0].unexpected = true),
])
  test(
    "invalid selection or history cannot pass: " + edit.toString(),
    async () => {
      const v = example();
      edit(v);
      const r = await run(v);
      assert.equal(r.success, false);
      assert.deepEqual(r.accounts, []);
      assert.ok(r.issues.length);
    }
  );
test("unknown hash capability stays unchecked and no URL is fetched", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"),
    fetch = globalThis.fetch;
  try {
    globalThis.fetch = () => {
      throw Error("Unexpected fetch");
    };
    assert.equal((await run()).success, true);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const r = await run();
    assert.equal(r.success, false);
    assert.equal(row(r, "content_integrity").status, "not_checked");
    assert.equal(r.checks.profile, "not_checked");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
    globalThis.fetch = fetch;
  }
});
test("inputs and assets are snapshotted and not mutated", async () => {
  const v = example(),
    before = structuredClone(v);
  assert.equal((await run(v)).success, true);
  assert.deepEqual(v, before);
  const pending = run(v);
  v.history.claims = [];
  v.selection.accounts = [];
  v.assets.get("source:report").fill(0);
  assert.equal((await pending).success, true);
});
test("versioned artifact equals runtime schema and independent validation", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/historical-testimony-selection-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, historicalTestimonySelectionJsonSchema());
  const check = new Ajv2020({ strict: false }).compile(schema);
  for (const edit of [
    (s) => {},
    (s) => (s.accounts = []),
    (s) =>
      (s.accounts[0].recording = { state: "unknown", reason: "unavailable" }),
    (s) => (s.accounts[0].recording.recordedBy = " "),
    (s) => (s.accounts[0].sourceRef = "source:../escape"),
    (s) => (s.schemaVersion = "2"),
  ]) {
    const s = example().selection;
    edit(s);
    assert.equal(
      check(s),
      HistoricalTestimonySelectionSchema.safeParse(s).success
    );
  }
});

for (const access of ["public", "restricted", "withheld", "unknown"])
  test("testimony preserves access " + access, async () => {
    const v = example();
    v.history.observation.sources[0].access = access;
    const r = await run(v);
    assert.equal(r.success, true);
    assert.equal(r.validation.data.observation.sources[0].access, access);
    assert.equal(r.redistributionRights, "not_checked");
  });
test("speaker pseudonyms are preserved without authenticating identity", async () => {
  const v = example();
  v.history.claims[0].provenance.attributedTo =
    "Witness A (pseudonym in source)";
  const r = await run(v);
  assert.equal(r.success, true);
  assert.equal(r.speakerIdentity, "not_checked");
  assert.equal(
    r.validation.data.claims[0].provenance.attributedTo,
    "Witness A (pseudonym in source)"
  );
  assert.deepEqual(r.selection, v.selection);
});
test("recording attribution never substitutes for an extracted speaker", async () => {
  const v = example();
  delete v.history.claims[0].provenance.attributedTo;
  const r = await run(v);
  assert.equal(row(r, "recording_citation").status, "satisfied");
  assert.equal(row(r, "extraction_traceability").status, "missing");
  assert.equal(r.success, false);
});

test("mixed speakers retain passage attribution without an independent-witness count", async () => {
  const v = example();
  v.history.claims.push({
    ...structuredClone(v.history.claims[0]),
    id: "second",
    provenance: {
      ...structuredClone(v.history.claims[0].provenance),
      attributedTo: "Witness B (synthetic label)",
    },
  });
  const r = await run(v);
  assert.equal(r.success, true);
  assert.deepEqual(r.accounts[0].extractionRefs, [
    "claim:statement",
    "claim:second",
  ]);
  assert.deepEqual(
    r.validation.data.claims.map((c) => c.provenance.attributedTo),
    ["Witness A (synthetic pseudonym)", "Witness B (synthetic label)"]
  );
  assert.equal(r.witnessIndependence, "not_checked");
  assert.equal("witnessCount" in r, false);
});
test("repeated statements are traceable without becoming corroboration", async () => {
  const v = example();
  v.history.claims.push({
    ...structuredClone(v.history.claims[0]),
    id: "copy",
  });
  const r = await run(v);
  assert.equal(r.success, true);
  assert.equal(r.witnessIndependence, "not_checked");
  assert.equal(r.accountAccuracy, "not_checked");
  assert.equal(r.assessmentSupport, "not_checked");
  assert.equal("score" in r, false);
  assert.equal("confidence" in r, false);
});
