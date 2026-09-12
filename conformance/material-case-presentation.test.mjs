import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildPublicMaterialCaseOutputs,
  parseMaterialCasePresentation,
  materialCasePresentationJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  bytes,
  digest,
  documents,
  approval,
} from "../examples/v2/material-case-demo/fixture.mjs";
const run = (f, extra = {}) =>
  buildPublicMaterialCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
    ...extra,
  });
const entity = (f, id) => f.entities.entities.find((e) => e.id === id);
test("specimen lineage and three result kinds retain exact scope and missingness", async () => {
  const r = await run(fixture());
  assert.equal(r.success, true);
  const m = r.data.material;
  assert.deepEqual(
    m.specimens.map((s) => s.lineage),
    [
      { kind: "collected" },
      { kind: "derived", preparationId: "split" },
      { kind: "derived", preparationId: "split" },
    ]
  );
  assert.deepEqual(m.preparations[0].inputs, ["parent"]);
  assert.deepEqual(m.preparations[0].outputs, ["aliquot-a", "aliquot-b"]);
  assert.deepEqual(
    m.results.map((r) => r.materialId),
    ["aliquot-a", "aliquot-a", "aliquot-a"]
  );
  assert.deepEqual(
    m.results.map((r) => r.value.kind),
    ["quantitative", "below_limit", "qualitative"]
  );
  assert.equal(m.results[0].value.magnitude, 1.25);
  assert.equal(m.results[0].value.unit, "mg/kg");
  assert.equal(m.results[0].value.uncertainty.kind, "unknown");
  assert.equal(m.results[1].value.limit.magnitude, 0.1);
  assert.equal(m.results[1].value.magnitude, undefined);
  assert.equal(m.specimens[0].actions[0].predecessor.kind, "unknown");
  assert.equal(m.specimens[1].actions[0].predecessor.kind, "unknown");
  assert.equal(m.specimens[2].actions.length, 0);
  assert.equal(m.review.outcome, "inconclusive");
  assert.deepEqual(m.review.resultIds, ["numeric"]);
  assert.equal(m.traces.length, 1);
  assert.equal(r.data.attachments.length, 0);
  assert.deepEqual(JSON.parse(r.json), r.data);
  assert.ok(r.markdown.includes(String.raw`1\.25 mg\/kg`));
  assert.match(r.search.text, /below-limit result is not zero/);
});
for (const [name, mutate, code = "INVALID_REFERENCES"] of [
  [
    "wrong specimen for result",
    (f) => {
      entity(f, "numeric").materialId = "aliquot-b";
      refresh(f);
    },
  ],
  [
    "hidden sibling in preparation",
    (f) => {
      f.presentation.material.specimens.pop();
    },
  ],
  [
    "hidden preparation",
    (f) => {
      f.presentation.material.preparations = [];
    },
  ],
  [
    "hidden analysis result",
    (f) => {
      f.presentation.material.results.pop();
    },
  ],
  [
    "foreign custody specimen",
    (f) => {
      f.presentation.material.specimens[1].actions =
        f.presentation.material.specimens[0].actions;
    },
  ],
  [
    "hidden custody predecessor",
    (f) => {
      f.presentation.material.specimens[0].actions.shift();
    },
  ],
  [
    "wrong result assertion",
    (f) => {
      f.presentation.material.results[0].resultAssertionId = "missing";
    },
  ],
  [
    "wrong result source",
    (f) => {
      f.presentation.material.results[0].citationIds = ["handling-log"];
    },
  ],
  [
    "wrong review source",
    (f) => {
      f.presentation.material.review.citationIds = ["handling-log"];
    },
  ],
  [
    "review not selected result",
    (f) => {
      f.history.claims[1].entityInputRefs[0].target.id = "below-limit";
      refresh(f);
    },
  ],
  [
    "unsupported review topic",
    (f) => {
      f.history.claims[1].topic = "unrelated";
      refresh(f);
    },
  ],
  [
    "source assertion is not review",
    (f) => {
      f.presentation.material.review.claimId = "reported-quality";
    },
  ],
  [
    "review wrong observation measurement",
    (f) => {
      f.history.claims[1].inputRefs = ["measurement:missing"];
      refresh(f);
    },
  ],
  [
    "multiple result declarations",
    (f) => {
      const a = structuredClone(entity(f, "numeric").fields.result[0]);
      a.id = "alternate";
      entity(f, "numeric").fields.result.push(a);
      refresh(f);
    },
  ],
  [
    "approximate numeric declaration",
    (f) => {
      const c = entity(f, "numeric").fields.result[0].content;
      c.state = "approximate";
      c.precision = "Approximate";
      refresh(f);
    },
  ],
  [
    "unsupported collection precision",
    (f) => {
      entity(f, "parent").fields.collectionTime = [
        {
          id: "time",
          content: {
            state: "known",
            value: { kind: "year", value: "2026" },
            provenance: entity(f, "parent").fields.type[0].content.provenance,
          },
        },
      ];
      refresh(f);
    },
  ],
  [
    "foreign entity identity",
    (f) => {
      f.presentation.material.document.documentId = "foreign";
    },
  ],
  [
    "foreign history identity",
    (f) => {
      f.presentation.material.history.documentId = "foreign";
    },
  ],
  [
    "foreign selected specimen",
    (f) => {
      f.selection.samples[0].id = "other";
      refresh(f);
    },
  ],
  [
    "selection wrong history",
    (f) => {
      f.selection.historyId = "other";
      refresh(f);
    },
  ],
  [
    "report hash mismatch",
    (f) => {
      entity(f, "analysis-a").fields.reportArtifacts[0].content.value[0] = {
        sourceRef: "source:lab-report",
        digest: { algorithm: "sha256", value: "c".repeat(64) },
      };
      refresh(f);
    },
  ],
  [
    "measurement limit unit mismatch",
    (f) => {
      f.observation.measurements[0].value.unit = "g/kg";
      refresh(f);
    },
  ],
  [
    "duplicate public specimen",
    (f) => {
      f.presentation.material.specimens.push(
        f.presentation.material.specimens[0]
      );
    },
    "INVALID_PRESENTATION",
  ],
  [
    "private selector",
    (f) => {
      f.presentation.material.privateNotes = "PRIVATE";
    },
    "INVALID_PRESENTATION",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    assert.deepEqual(await run(f), { success: false, code });
  });
test("explicit quantitative uncertainty is retained with its own citations", async () => {
  const f = fixture();
  f.observation.measurements[0].value.uncertainty = {
    kind: "expanded",
    magnitude: 0.2,
    unit: "mg/kg",
    coverageFactor: 2,
    coverageProbability: 0.95,
    sourceRefs: ["source:handling-log"],
  };
  refresh(f);
  assert.equal((await run(f)).success, false);
  f.presentation.material.results[0].citationIds.push("handling-log");
  const r = await run(f);
  assert.equal(r.success, true);
  assert.deepEqual(r.data.material.results[0].value.uncertainty, {
    kind: "expanded",
    magnitude: 0.2,
    unit: "mg/kg",
    coverageFactor: 2,
    coverageProbability: 0.95,
  });
  assert.match(r.markdown, /coverage factor 2/);
});
test("limit unknown and not applicable remain distinct without copying private reason text", async () => {
  for (const state of ["unknown", "not_applicable"]) {
    const f = fixture();
    entity(f, "numeric").fields.result[0].content.value.limit = {
      state,
      reason: "PRIVATE_REASON",
    };
    refresh(f);
    const r = await run(f);
    assert.equal(r.success, true);
    assert.deepEqual(r.data.material.results[0].value.limit, { state });
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_REASON/);
  }
});
test("all public formats exclude private specimen, laboratory and reviewer details", async () => {
  const f = fixture();
  f.entities.recordedBy = "PRIVATE_CURATOR";
  for (const source of f.observation.sources) {
    source.uri = "https://private.invalid/PRIVATE_SOURCE";
    source.title = "PRIVATE_TITLE";
  }
  entity(f, "parent").fields.collectorName[0].content.value =
    "PRIVATE_COLLECTOR";
  entity(f, "aliquot-receive").predecessor.reason = "PRIVATE_GAP";
  entity(f, "analysis-a").fields.laboratory[0].content.value = "PRIVATE_LAB";
  f.history.claims[1].evaluatedBy = "PRIVATE_REVIEWER";
  f.history.claims[1].rationale = "PRIVATE_RATIONALE";
  f.history.claims[1].materialReview.findings = "PRIVATE_FINDINGS";
  f.selection.samples[0].collection.reason = "PRIVATE_COLLECTION";
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.doesNotMatch(
    JSON.stringify(r),
    /PRIVATE_|private\.invalid|selectionRef|entityInputRefs/
  );
});
test("declarations are ordered by custody links; superseded review stays visible", async () => {
  const f = fixture(),
    later = structuredClone(f.history.claims[1]);
  later.id = "later";
  later.supersedes = ["claim:review-a"];
  f.history.claims.push(later);
  f.entities.entities.reverse();
  f.presentation.material.specimens[0].actions.reverse();
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.deepEqual(
    r.data.material.specimens[0].actions.map((a) => a.id),
    ["received", "stored"]
  );
  assert.equal(r.data.material.review.revision, "superseded");
});
test("approval, withdrawal and dependency bytes fail closed", async () => {
  const f = fixture();
  assert.equal(
    (await run(f, { approval: undefined })).code,
    "APPROVAL_REQUIRED"
  );
  const a = approval(f);
  f.presentation.material.specimens[0].label = "Changed";
  assert.equal((await run(f, { approval: a })).code, "APPROVAL_REQUIRED");
  for (const status of ["draft", "withdrawn"]) {
    const f = fixture();
    f.presentation.presentation.status = status;
    f.presentation.presentation.notices.push({
      id: "removed",
      kind: "withdrawal",
      text: "Removed",
    });
    assert.equal((await run(f)).code, "NOT_PUBLISHED");
  }
  for (const mode of ["missing", "changed"]) {
    const f = fixture(),
      docs = documents(f),
      ref = entity(f, "parent").selectionRef.document;
    if (mode === "missing") docs.delete(ref.sha256);
    else docs.set(ref.sha256, bytes({ private: "PRIVATE" }));
    assert.deepEqual(await run(f, { documents: docs }), {
      success: false,
      code: "INVALID_REFERENCES",
    });
  }
  const g = fixture();
  g.caseRecord.observationRefs[0].sha256 = "0".repeat(64);
  g.presentation.presentation.caseRef.sha256 = digest(bytes(g.caseRecord));
  assert.equal((await run(g)).success, false);
});
test("selected specimen snapshots are copied before the first await", async () => {
  const f = fixture(),
    docs = documents(f),
    a = approval(f),
    input = bytes(f.presentation),
    pending = buildPublicMaterialCaseOutputs(input, {
      documents: docs,
      approval: a,
    });
  input.fill(0);
  for (const b of docs.values()) b.fill(0);
  docs.clear();
  a.presentationSha256 = "0".repeat(64);
  assert.equal((await pending).success, true);
});
test("unrelated documents do not enter the selected graph", async () => {
  const f = fixture(),
    docs = documents(f);
  docs.set("0".repeat(64), Buffer.from("not json"));
  assert.equal((await run(f, { documents: docs })).success, true);
});
test("schema artifact matches and validates the fixture", () => {
  const schema = materialCasePresentationJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/material-case-presentation-0.1.0.schema.json",
          import.meta.url
        )
      )
    ),
    schema
  );
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  assert.equal(ajv.compile(schema)(fixture().presentation), true);
  assert.equal(
    parseMaterialCasePresentation(fixture().presentation).success,
    true
  );
});
