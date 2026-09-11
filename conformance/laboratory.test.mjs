import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  fixture,
  refresh,
  documents,
  snapshot,
  bytes,
  digest,
  sourced,
  unknown,
} from "../examples/v2/laboratory-review-demo/fixture.mjs";
import {
  parseLaboratoryEntities,
  parseLaboratoryClaimHistory,
  parseMaterialEntities,
  parseArchivalClaimHistory,
  laboratoryEntitiesJsonSchema,
  laboratoryClaimHistoryJsonSchema,
  materialEntitiesJsonSchema,
  archivalClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateLaboratoryClaimHistory } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { fixture as archivalFixture } from "../examples/v2/archival-editions-demo/fixture.mjs";
const entity = (f, id) => f.entities.entities.find((e) => e.id === id);
const review = (f) => f.history.claims.find((c) => c.id === "review-a");
const evaluate = (f) =>
  evaluateLaboratoryClaimHistory(f.history, { documents: documents(f) });
function updateSelection(f) {
  const ref = snapshot(
    f.selection,
    "urn:disclosureos:experimental:physical-sample-selection:0.1.0",
  );
  for (const e of f.entities.entities) {
    if (e.selectionRef) e.selectionRef.document = ref;
    if (e.transferRef) e.transferRef.document = ref;
  }
}
const rejects = (name, change, code, stage = "external") =>
  test(name, async () => {
    const f = fixture();
    change(f);
    refresh(f);
    const result =
      stage === "entities"
        ? parseLaboratoryEntities(f.entities)
        : stage === "history"
          ? parseLaboratoryClaimHistory(f.history)
          : await evaluate(f);
    assert.equal(result.success, false, JSON.stringify(result));
    assert.ok(
      result.issues.some((i) => i.code === code),
      JSON.stringify(result.issues),
    );
  });
test("separates numeric, below-limit and qualitative results; uncertainty and custody gaps remain explicit", async () => {
  const f = fixture(),
    before = structuredClone(f),
    supplied = documents(f),
    beforeBytes = structuredClone(supplied);
  assert.equal(parseLaboratoryEntities(f.entities).success, true);
  assert.equal(
    parseLaboratoryClaimHistory(f.history).checks.external,
    "not_checked",
  );
  const result = await evaluateLaboratoryClaimHistory(f.history, {
    documents: supplied,
  });
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.deepEqual(result.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    profile: "not_checked",
  });
  assert.equal(result.sourceArtifactIntegrity, "not_checked");
  assert.equal(result.scientificInterpretation, "not_checked");
  assert.ok(result.integrityScope.includes("specimen_selection"));
  assert.ok(
    result.snapshots.some(
      (s) => s.documentId === f.selection.id && s.status === "passed",
    ),
  );
  assert.equal(
    entity(f, "below-limit").fields.result[0].content.value.measurementId,
    undefined,
  );
  assert.equal(f.observation.measurements[0].value.uncertainty.kind, "unknown");
  assert.equal(entity(f, "aliquot-receive").predecessor.kind, "unknown");
  assert.deepEqual(f, before);
  assert.deepEqual(structuredClone(supplied), beforeBytes);
});
test("entity order does not establish analytical relationships", async () => {
  const f = fixture();
  f.entities.entities.reverse();
  refresh(f);
  assert.equal((await evaluate(f)).success, true);
});
test("edition citations and archival reviews remain active inside the extended history", async () => {
  const f = fixture(),
    archive = archivalFixture();
  f.entities.entities.push(...archive.entities.entities);
  f.observation.sources.push(...archive.observation.sources);
  f.observation.methods = f.observation.methods
    .filter((m) => m.id !== "review")
    .concat(archive.observation.methods);
  review(f).methodVersion = archive.observation.methods[0].version;
  f.history.claims.push(...archive.history.claims);
  refresh(f);
  const r = await evaluate(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  const cited = f.history.claims.find((c) => c.editionInputRefs?.length);
  cited.editionInputRefs[0].locator = { kind: "page", page: 999 };
  const invalid = await evaluate(f);
  assert.equal(invalid.success, false);
  assert.ok(invalid.issues.some((i) => i.code === "ARCHIVE.PAGE_BOUNDS"));
});
test("unknown result and method declarations do not manufacture measurements or a laboratory", async () => {
  const f = fixture();
  entity(f, "numeric").fields.result = unknown("result");
  entity(f, "analysis-a").fields.method = unknown("method");
  delete entity(f, "analysis-a").fields.laboratory;
  refresh(f);
  assert.equal((await evaluate(f)).success, true);
});
test("an analysis can honestly have no supplied results", async () => {
  const f = fixture();
  entity(f, "analysis-a").resultIds = [];
  f.entities.entities = f.entities.entities.filter(
    (e) => e.kind !== "laboratory_result",
  );
  f.history.claims = [];
  refresh(f);
  assert.equal((await evaluate(f)).success, true);
});
test("disagreeing reviewers remain independent current claims", async () => {
  const f = fixture();
  const other = structuredClone(review(f));
  other.id = "review-b";
  other.evaluatedBy = "Fictional reviewer B";
  other.materialReview.findings = "A different attributable opinion";
  f.history.claims.push(other);
  refresh(f);
  const result = await evaluate(f);
  assert.equal(result.success, true);
  assert.ok(result.currentClaimRefs.includes("claim:review-a"));
  assert.ok(result.currentClaimRefs.includes("claim:review-b"));
});
rejects(
  "requires specimen inputs, not traces",
  (f) => (entity(f, "analysis-a").inputMaterialIds = ["trace"]),
  "REF.ENTITY",
  "entities",
);
rejects(
  "rejects duplicate analysis inputs",
  (f) => entity(f, "analysis-a").inputMaterialIds.push("aliquot-a"),
  "REF.UNIQUE_ID",
  "entities",
);
rejects(
  "requires declared results to exist",
  (f) => entity(f, "analysis-a").resultIds.push("missing"),
  "REF.ENTITY",
  "entities",
);
rejects(
  "requires reciprocal result membership",
  (f) => (entity(f, "analysis-a").resultIds = []),
  "LAB.RESULT_SCOPE",
  "entities",
);
rejects(
  "does not assign an aliquot result to its parent",
  (f) => (entity(f, "numeric").materialId = "parent"),
  "LAB.RESULT_SCOPE",
  "entities",
);
rejects(
  "does not assign an aliquot result to its sibling",
  (f) => (entity(f, "numeric").materialId = "aliquot-b"),
  "LAB.RESULT_SCOPE",
  "entities",
);
rejects(
  "requires a named analysis",
  (f) => (entity(f, "numeric").analysisId = "absent"),
  "REF.ENTITY",
  "entities",
);
rejects(
  "a selected preparation must produce an analyzed specimen",
  (f) => (entity(f, "analysis-a").inputMaterialIds = ["parent"]),
  "LAB.PREPARATION_SCOPE",
  "entities",
);
rejects(
  "rejects negative analytical limits",
  (f) =>
    (entity(f, "below-limit").fields.result[0].content.value.limit.magnitude =
      -1),
  "STRUCT.VALUE",
  "entities",
);
rejects(
  "cannot encode a below-limit report as a numeric zero",
  (f) => (entity(f, "below-limit").fields.result[0].content.value.value = 0),
  "STRUCT.VALUE",
  "entities",
);
rejects(
  "requires an explicit threshold status for a quantitative result",
  (f) => delete entity(f, "numeric").fields.result[0].content.value.limit,
  "STRUCT.VALUE",
  "entities",
);
rejects(
  "requires provenance for a laboratory finding",
  (f) => delete entity(f, "numeric").fields.result[0].content.provenance,
  "STRUCT.VALUE",
  "entities",
);
rejects(
  "requires valid analysis calendar times",
  (f) =>
    (entity(f, "analysis-a").fields.performedAt = sourced("time", {
      kind: "date",
      value: "2026-02-30",
    })),
  "STRUCT.VALUE",
  "entities",
);
rejects(
  "retains lineage validation in laboratory documents",
  (f) =>
    (entity(f, "aliquot-receive").predecessor = {
      kind: "action",
      id: "store",
    }),
  "MATERIAL.CUSTODY_SCOPE",
  "entities",
);
rejects(
  "requires a supplied measurement",
  (f) =>
    (entity(f, "numeric").fields.result[0].content.value.measurementId =
      "absent"),
  "REF.MEASUREMENT",
);
rejects(
  "does not infer conversion between analytical limit and measurement units",
  (f) =>
    (entity(f, "numeric").fields.result[0].content.value.limit.value.unit =
      "g/kg"),
  "UNIT.MISMATCH",
);
rejects(
  "measurement uncertainty is required by the observation contract",
  (f) => delete f.observation.measurements[0].value.uncertainty,
  "STRUCT.VALUE",
  "history",
);
rejects(
  "requires the declared laboratory method version",
  (f) =>
    (entity(f, "analysis-a").fields.method[0].content.value.methodVersion =
      "2"),
  "METHOD.VERSION_MISMATCH",
);
rejects(
  "requires source report identity",
  (f) =>
    (entity(f, "analysis-a").fields.reportArtifacts[0].content.value[0].digest =
      { algorithm: "sha256", value: "c".repeat(64) }),
  "LAB.REPORT_IDENTITY",
);
rejects(
  "requires laboratory assertion provenance in scoped inventory",
  (f) =>
    (entity(f, "qualitative").fields.result[0].content.provenance.sourceRef =
      "source:absent"),
  "REF.LOCAL_RESOLUTION",
);
rejects(
  "requires entity assertion inputs to exist",
  (f) => (review(f).entityInputRefs[0].assertionId = "absent"),
  "REF.ASSERTION",
);
rejects(
  "requires a selected review field to contain assertions",
  (f) => (review(f).subject.reference.target.field = "notes"),
  "REF.FIELD",
);
rejects(
  "material review cannot silently target the whole observation",
  (f) => (review(f).subject = { kind: "observation" }),
  "MATERIAL.REVIEW_SUBJECT",
  "history",
);
rejects(
  "review requires explicit inputs",
  (f) => {
    review(f).inputRefs = [];
    review(f).entityInputRefs = [];
  },
  "REF.LOCAL_RESOLUTION",
  "history",
);
rejects(
  "source wording cannot contain an unattributed assessed-review payload",
  (f) =>
    (f.history.claims[0].materialReview =
      f.history.claims[0].reportedMaterialReview),
  "STRUCT.VALUE",
  "history",
);
rejects(
  "assessed review requires an evaluator",
  (f) => delete review(f).evaluatedBy,
  "STRUCT.VALUE",
  "history",
);
rejects(
  "another reviewer cannot supersede an existing evaluation",
  (f) => {
    const c = structuredClone(review(f));
    c.id = "different";
    c.evaluatedBy = "Other reviewer";
    c.supersedes = ["claim:review-a"];
    f.history.claims.push(c);
  },
  "CLAIM.REVISION_ATTRIBUTION",
  "history",
);
rejects(
  "requires the exact selected specimen",
  (f) => {
    f.selection.samples[0].id = "other";
    updateSelection(f);
  },
  "MATERIAL.SELECTION_SAMPLE",
);
rejects(
  "requires the selection observation scope",
  (f) => {
    f.selection.observationId = "other";
    updateSelection(f);
  },
  "MATERIAL.SELECTION_SCOPE",
);
rejects(
  "requires the selection history scope",
  (f) => {
    f.selection.historyId = "other";
    updateSelection(f);
  },
  "MATERIAL.SELECTION_SCOPE",
);
rejects(
  "requires selection schema version",
  (f) => {
    f.selection.schemaVersion = "9";
    updateSelection(f);
  },
  "MATERIAL.SELECTION_CONTRACT",
);
rejects(
  "rejects duplicate selected specimen IDs",
  (f) => {
    f.selection.samples.push(structuredClone(f.selection.samples[0]));
    updateSelection(f);
  },
  "REF.UNIQUE_ID",
);
rejects(
  "rejects duplicate selected transfer IDs",
  (f) => {
    f.selection.samples[0].custody.transfers.push(
      structuredClone(f.selection.samples[0].custody.transfers[0]),
    );
    updateSelection(f);
  },
  "REF.UNIQUE_ID",
);
rejects(
  "checks known selected physical lineage",
  (f) => {
    f.selection.samples[0].lineage = "derived_sample";
    updateSelection(f);
  },
  "MATERIAL.SELECTION_LINEAGE",
);
rejects(
  "requires the selected transfer to exist",
  (f) => {
    f.selection.samples[0].custody.transfers = [];
    updateSelection(f);
  },
  "MATERIAL.SELECTION_TRANSFER",
);
rejects(
  "checks transfer parties against the original selected transfer",
  (f) => {
    f.selection.samples[0].custody.transfers[0].to = "Other repository";
    updateSelection(f);
  },
  "MATERIAL.TRANSFER_PARTY",
);
rejects(
  "checks predecessor order against selected transfer order",
  (f) => {
    f.selection.samples[0].custody.transfers.reverse();
    updateSelection(f);
  },
  "MATERIAL.TRANSFER_ORDER",
);
rejects(
  "cannot call a later selected transfer the chain start",
  (f) => (entity(f, "store").predecessor = { kind: "start" }),
  "MATERIAL.TRANSFER_ORDER",
);
rejects(
  "requires selected source records in the inventory",
  (f) => {
    f.selection.samples[0].custody.transfers[0].recordRef = "source:absent";
    updateSelection(f);
  },
  "REF.LOCAL_RESOLUTION",
);
test("unknown selected lineage is retained without guessing", async () => {
  const f = fixture();
  f.selection.samples[0].lineage = "unknown";
  updateSelection(f);
  refresh(f);
  assert.equal((await evaluate(f)).success, true);
});
for (const part of ["entities", "selection", "observation"]) {
  test(`missing ${part} snapshot prevents success`, async () => {
    const f = fixture(),
      supplied = documents(f);
    supplied.delete(digest(bytes(f[part])));
    const r = await evaluateLaboratoryClaimHistory(f.history, {
      documents: supplied,
    });
    assert.equal(r.success, false);
    assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.UNAVAILABLE"));
  });
  test(`tampered ${part} bytes prevent success`, async () => {
    const f = fixture(),
      supplied = documents(f);
    supplied.set(digest(bytes(f[part])), Buffer.from("{}"));
    const r = await evaluateLaboratoryClaimHistory(f.history, {
      documents: supplied,
    });
    assert.equal(r.success, false);
    assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.DIGEST"));
  });
}
test("correct digest does not hide invalid UTF-8 JSON", async () => {
  const f = fixture(),
    invalid = Buffer.from([0xff]),
    sha = digest(invalid);
  entity(f, "parent").selectionRef.document.sha256 = sha;
  for (const e of f.entities.entities)
    if (e.transferRef) e.transferRef.document.sha256 = sha;
  refresh(f);
  const supplied = documents(f);
  supplied.set(sha, invalid);
  const r = await evaluateLaboratoryClaimHistory(f.history, {
    documents: supplied,
  });
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.JSON"));
});
rejects(
  "digest alone does not authorize a different selection document ID",
  (f) => {
    entity(f, "parent").selectionRef.document.documentId = "wrong";
    for (const e of f.entities.entities)
      if (e.transferRef) e.transferRef.document.documentId = "wrong";
  },
  "SNAPSHOT.IDENTITY",
);
test("complete observation contents, not only IDs, determine scope", async () => {
  const f = fixture(),
    other = structuredClone(f.observation);
  other.summary = "Different snapshot";
  f.entities.observationRef = snapshot(
    other,
    "urn:disclosureos:experimental:observation:0.1.0",
  );
  const ref = snapshot(
    f.entities,
    "urn:disclosureos:experimental:research-entities:0.4.0",
  );
  f.history.entityRefs = [ref];
  for (const c of f.history.claims) {
    c.subject.reference.document = ref;
    for (const r of c.entityInputRefs ?? []) r.document = ref;
  }
  const supplied = documents(f);
  supplied.set(digest(bytes(other)), bytes(other));
  const r = await evaluateLaboratoryClaimHistory(f.history, {
    documents: supplied,
  });
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "ENTITIES.OBSERVATION_SCOPE"));
});
test("earlier parsers do not silently accept the extended contracts", () => {
  const f = fixture();
  assert.equal(parseMaterialEntities(f.entities).success, false);
  assert.equal(parseArchivalClaimHistory(f.history).success, false);
});
test("candidate schemas, frozen earlier artifacts, example bytes and AJV agree", () => {
  const f = fixture();
  for (const [name, emit, input] of [
    ["research-entities-0.4.0", laboratoryEntitiesJsonSchema, f.entities],
    ["claim-history-0.5.0", laboratoryClaimHistoryJsonSchema, f.history],
    ["research-entities-0.3.0", materialEntitiesJsonSchema],
    ["claim-history-0.4.0", archivalClaimHistoryJsonSchema],
  ]) {
    const schema = emit();
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
            import.meta.url,
          ),
        ),
      ),
      schema,
    );
    if (input) {
      const ajv = new Ajv({ strict: false });
      addFormats(ajv);
      const validate = ajv.compile(schema);
      assert.equal(validate(input), true, JSON.stringify(validate.errors));
      assert.equal(validate({ ...input, privateIntake: {} }), false);
    }
  }
  for (const [name, value] of Object.entries(f))
    assert.deepEqual(
      readFileSync(
        new URL(
          `../examples/v2/laboratory-review-demo/${name}.json`,
          import.meta.url,
        ),
      ),
      bytes(value),
    );
});
