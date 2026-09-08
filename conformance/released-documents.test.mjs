import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  evaluateReleasedDocuments as evaluate,
  ReleasedDocumentSelectionSchema,
  releasedDocumentSelectionJsonSchema,
  RELEASED_DOCUMENT_REQUIREMENTS,
  RELEASED_DOCUMENT_PROFILE,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const root = new URL("../examples/v2/released-document-demo/", import.meta.url);
const example = () => ({
  history: JSON.parse(readFileSync(new URL("history.json", root))),
  selection: JSON.parse(readFileSync(new URL("selection.json", root))),
  assets: new Map([
    [
      "source:report",
      new Uint8Array(readFileSync(new URL("document.txt", root))),
    ],
  ]),
});
const run = (v = example()) =>
  evaluate(v.history, v.selection, { assets: v.assets });
const row = (r, id, n = 0) =>
  r.documents[n].requirements.find((x) => x.id === id);
test("archive provenance passes without measurements, event dates or an assessment", async () => {
  const v = example(),
    r = await run(v);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.validation, parseExperimentalClaimHistory(v.history));
  assert.equal(v.history.observation.measurements.length, 0);
  assert.equal(v.history.observation.eventTime.state, "unknown");
  assert.equal(v.history.observation.position.state, "unknown");
  assert.equal(
    r.documents[0].requirements.filter((r) => r.status === "satisfied").length,
    8
  );
  for (const k of [
    "releaseAuthenticity",
    "redistributionRights",
    "locatorContents",
    "extractionAccuracy",
    "assessmentSupport",
    "scientificEligibility",
  ])
    assert.equal(r[k], "not_checked");
  assert.equal("score" in r, false);
  assert.equal(Object.isFrozen(RELEASED_DOCUMENT_PROFILE), true);
  assert.ok(
    Object.isFrozen(RELEASED_DOCUMENT_REQUIREMENTS) &&
      RELEASED_DOCUMENT_REQUIREMENTS.every(Object.isFrozen)
  );
});
for (const [id, edit, code] of [
  [
    "release_citation",
    (v) =>
      (v.selection.documents[0].release = {
        state: "unknown",
        reason: "Release authority not supplied",
      }),
    "DOCUMENT.RELEASE_CITATION",
  ],
  [
    "content_digest",
    (v) => delete v.history.observation.sources[0].digest,
    "DOCUMENT.DIGEST_REQUIRED",
  ],
  [
    "extraction_traceability",
    (v) => delete v.history.claims[0].provenance.locator,
    "DOCUMENT.LOCATOR_REQUIRED",
  ],
  [
    "extraction_traceability",
    (v) => delete v.history.claims[0].provenance.extractedBy,
    "DOCUMENT.EXTRACTOR_REQUIRED",
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
  [
    "source_attribution",
    (v) => delete v.history.claims[0].provenance.attributedTo,
  ],
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
  ["document", "restricted", "failed"],
  ["document", "withheld", "failed"],
  ["document", "unknown", "missing"],
  ["unknown", "public", "missing"],
  ["testimony", "unknown", "failed"],
  ["instrument_data", "public", "failed"],
])
  test(`selected source ${kind}/${access}`, async () => {
    const v = example();
    Object.assign(v.history.observation.sources[0], { kind, access });
    const r = await run(v);
    assert.equal(r.success, false);
    assert.equal(row(r, "document_source").status, status);
    assert.equal(row(r, "content_integrity").status, "not_checked");
    assert.deepEqual(row(r, "content_integrity").blockedBy, [
      "document_source",
    ]);
    assert.equal(v.history.observation.sources[0].access, access);
  });
for (const mode of ["missing", "empty", "corrupt"])
  test(mode + " document bytes", async () => {
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
  assert.equal(row(r, "source_attribution").status, "not_applicable");
  assert.deepEqual(r.documents[0].extractionRefs, []);
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
  assert.deepEqual(r.documents[0].extractionRefs, ["claim:new"]);
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
  assert.ok(r.documents[0].extractionRefs.includes("assertion:time"));
  assert.ok(
    r.issues.some(
      (i) => i.pointer === "/observation/assertions/0/provenance/locator"
    )
  );
});
test("passing selected document does not endorse a confirmed assessment", async () => {
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
test("unselected incomplete documents do not penalize selected provenance", async () => {
  const v = example();
  v.history.observation.sources.push({
    id: "other",
    kind: "document",
    access: "unknown",
  });
  assert.equal((await run(v)).success, true);
});
test("multiple documents retain individual results", async () => {
  const v = example();
  v.history.observation.sources.push({
    ...structuredClone(v.history.observation.sources[0]),
    id: "second",
  });
  v.selection.documents.push({
    sourceRef: "source:second",
    release: { state: "unknown", reason: "No release citation" },
  });
  const r = await run(v);
  assert.equal(r.success, false);
  assert.equal(r.documents[0].status, "passed");
  assert.equal(r.documents[1].status, "failed");
  assert.equal(row(r, "content_integrity", 1).status, "missing");
});
for (const edit of [
  (v) => (v.selection.documents = []),
  (v) => v.selection.documents.push(structuredClone(v.selection.documents[0])),
  (v) => (v.selection.historyId = "other"),
  (v) => (v.selection.observationId = "other"),
  (v) => (v.selection.documents[0].sourceRef = "source:missing"),
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
      assert.deepEqual(r.documents, []);
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
  v.selection.documents = [];
  v.assets.get("source:report").fill(0);
  assert.equal((await pending).success, true);
});
test("versioned artifact equals runtime schema and independent validation", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        "../packages/disclosureos-schema/schema/experimental/released-document-selection-0.1.0.schema.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(schema, releasedDocumentSelectionJsonSchema());
  const check = new Ajv2020({ strict: false }).compile(schema);
  for (const edit of [
    (s) => {},
    (s) => (s.documents = []),
    (s) =>
      (s.documents[0].release = { state: "unknown", reason: "unavailable" }),
    (s) => (s.documents[0].release.releasedBy = " "),
    (s) => (s.documents[0].sourceRef = "source:../escape"),
    (s) => (s.schemaVersion = "2"),
  ]) {
    const s = example().selection;
    edit(s);
    assert.equal(
      check(s),
      ReleasedDocumentSelectionSchema.safeParse(s).success
    );
  }
});
