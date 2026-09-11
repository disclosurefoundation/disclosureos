import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  parseCaseClaimHistory,
  caseClaimHistoryJsonSchema,
  parseLaboratoryClaimHistory,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateCaseClaimHistory } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  documents,
  bytes,
  digest,
  caseSnapshot,
} from "../examples/v2/case-assessment-demo/fixture.mjs";
const claim = (f, id) => f.history.claims.find((c) => c.id === id);
const evaluate = (f) =>
  evaluateCaseClaimHistory(f.history, { documents: documents(f) });
function negative(name, edit, code, external = false) {
  test(name, async () => {
    const f = fixture();
    edit(f);
    const r = external ? await evaluate(f) : parseCaseClaimHistory(f.history);
    assert.equal(r.success, false, JSON.stringify(r));
    assert.ok(
      r.issues.some((i) => i.code === code),
      JSON.stringify(r.issues),
    );
    if (external) assert.deepEqual(r.currentClaimRefs, []);
  });
}
test("keeps source statements, independent reviewers and explicit revisions separate", async () => {
  const f = fixture(),
    before = structuredClone(f),
    supplied = documents(f),
    original = structuredClone(supplied);
  const local = parseCaseClaimHistory(f.history);
  assert.equal(local.success, true, JSON.stringify(local.issues));
  assert.equal(local.checks.external, "not_checked");
  const r = await evaluateCaseClaimHistory(f.history, { documents: supplied });
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.currentClaimRefs, [
    "claim:source-conclusion",
    "claim:same-object",
    "claim:finding-revised",
    "claim:independent-review",
    "claim:corroboration-pending",
  ]);
  assert.deepEqual(r.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    profile: "not_checked",
  });
  assert.equal(r.scientificInterpretation, "not_checked");
  assert.equal(r.sourceArtifactIntegrity, "not_checked");
  assert.equal(r.lifecycleChanges, "not_performed");
  assert.equal(r.snapshots.length, 3);
  assert.ok(r.snapshots.every((s) => s.status === "passed"));
  assert.deepEqual(f, before);
  assert.deepEqual(structuredClone(supplied), original);
});
test("claim array order does not choose a reviewer or a winner", async () => {
  const f = fixture();
  f.history.claims.reverse();
  const r = await evaluate(f);
  assert.equal(r.success, true);
  assert.ok(r.currentClaimRefs.includes("claim:independent-review"));
  assert.ok(r.currentClaimRefs.includes("claim:finding-revised"));
  assert.equal(r.currentClaimRefs.includes("claim:finding-original"), false);
});
test("all relationship kinds remain attributed declarations with no lifecycle effects", async () => {
  for (const relation of [
    "corroborates",
    "contradicts",
    "same_object",
    "duplicate_of",
    "re_analysis_of",
    "supersedes",
    "superseded_by",
  ]) {
    const f = fixture();
    claim(f, "same-object").subject.relation = relation;
    claim(f, "same-object").outcome = "confirmed";
    const r = await evaluate(f);
    assert.equal(r.success, true, relation);
    assert.equal(f.first.status, "draft");
    assert.equal(f.second.status, "draft");
    assert.equal(r.scientificInterpretation, "not_checked");
    assert.equal(r.lifecycleChanges, "not_performed");
  }
});
negative(
  "rejects an unknown relationship topic",
  (f) => {
    claim(f, "same-object").subject.relation = "causes";
  },
  "STRUCT.VALUE",
);
negative(
  "rejects unscoped observation references",
  (f) => {
    claim(f, "same-object").observationInputRefs[0] = "source:log";
  },
  "STRUCT.VALUE",
);
negative(
  "rejects unknown case fields rather than accepting arbitrary property pointers",
  (f) => {
    claim(f, "finding-original").subject.reference.target.field = "madeUpField";
  },
  "STRUCT.VALUE",
);
negative(
  "requires a field and assertion identity for sourced case inputs",
  (f) => {
    delete claim(f, "finding-original").caseInputRefs[0].target.field;
  },
  "STRUCT.VALUE",
);
negative(
  "does not accept private envelope fields",
  (f) => {
    f.history.internalNotes = "not part of exchange format";
  },
  "STRUCT.VALUE",
);
negative(
  "requires explicit assessment inputs",
  (f) => {
    const c = claim(f, "same-object");
    c.inputRefs = [];
    c.caseInputRefs = [];
    c.observationInputRefs = [];
  },
  "CLAIM.INPUT_REQUIRED",
);
negative(
  "rejects duplicate snapshot references",
  (f) => {
    f.history.caseRefs.push(structuredClone(f.history.caseRefs[0]));
  },
  "REF.UNIQUE_ID",
);
negative(
  "rejects duplicate claim IDs",
  (f) => {
    f.history.claims.push(structuredClone(f.history.claims[0]));
  },
  "REF.UNIQUE_ID",
);
negative(
  "rejects duplicate scoped inputs",
  (f) => {
    const c = claim(f, "same-object");
    c.observationInputRefs.push(structuredClone(c.observationInputRefs[0]));
  },
  "REF.UNIQUE_ID",
);
negative(
  "resolves exact declared case snapshot digests",
  (f) => {
    claim(f, "finding-original").subject.reference.document = {
      ...f.history.caseRefs[0],
      sha256: "a".repeat(64),
    };
  },
  "CASE.UNDECLARED_SNAPSHOT",
);
negative(
  "does not silently follow a changed case revision during supersession",
  (f) => {
    const ref = { ...f.history.caseRefs[0], sha256: "a".repeat(64) };
    f.history.caseRefs.push(ref);
    claim(f, "finding-revised").subject.reference.document = ref;
  },
  "CLAIM.SUPERSESSION_SCOPE",
);
negative(
  "requires the same relationship endpoints and direction for a revision",
  (f) => {
    const c = structuredClone(claim(f, "same-object"));
    c.id = "swapped";
    c.supersedes = ["claim:same-object"];
    [c.subject.from, c.subject.to] = [c.subject.to, c.subject.from];
    f.history.claims.push(c);
  },
  "CLAIM.SUPERSESSION_SCOPE",
);
negative(
  "a different evaluator cannot overwrite another reviewer",
  (f) => {
    claim(f, "finding-revised").evaluatedBy = "Other reviewer";
  },
  "CLAIM.REVISION_ATTRIBUTION",
);
negative(
  "an assessed claim cannot be revised into an unassessed state",
  (f) => {
    const c = claim(f, "finding-revised");
    c.status = "unassessed";
    for (const k of [
      "outcome",
      "evaluatedAt",
      "evaluatedBy",
      "methodRef",
      "methodVersion",
    ])
      delete c[k];
  },
  "CLAIM.REVISION_ATTRIBUTION",
);
negative(
  "rejects source-author substitution through supersession",
  (f) => {
    const c = structuredClone(claim(f, "source-conclusion"));
    c.id = "other-source";
    c.supersedes = ["claim:source-conclusion"];
    c.provenance.attributedTo = "Other author";
    f.history.claims.push(c);
  },
  "CLAIM.REVISION_ATTRIBUTION",
);
negative(
  "rejects revisions recorded before predecessors",
  (f) => {
    claim(f, "finding-revised").recordedAt = "2026-09-10T23:00:00Z";
    claim(f, "finding-revised").evaluatedAt = "2026-09-10T23:00:00Z";
  },
  "CLAIM.REVISION_ORDER",
);
negative(
  "rejects evaluations recorded before they occurred",
  (f) => {
    claim(f, "same-object").evaluatedAt = "2026-09-12T00:00:00Z";
  },
  "CLAIM.EVALUATION_ORDER",
);
negative(
  "rejects undeclared prior claims",
  (f) => {
    claim(f, "same-object").inputRefs = ["claim:missing"];
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "checks combined input and supersession cycles",
  (f) => {
    claim(f, "finding-original").inputRefs = ["claim:finding-revised"];
  },
  "CLAIM.DEPENDENCY_CYCLE",
);
negative(
  "rejects self dependencies",
  (f) => {
    claim(f, "same-object").inputRefs = ["claim:same-object"];
  },
  "CLAIM.DEPENDENCY_CYCLE",
);
negative(
  "rejects reversed source locators",
  (f) => {
    claim(f, "source-conclusion").provenance.locator = {
      kind: "time_range",
      startSeconds: 2,
      endSeconds: 1,
    };
  },
  "TIME.INTERVAL",
);
negative(
  "rejects obvious self relationships locally",
  (f) => {
    claim(f, "same-object").subject.to = structuredClone(
      claim(f, "same-object").subject.from,
    );
  },
  "CASE.SELF_RELATION",
);
negative(
  "resolves a subject by entity kind, not ID alone",
  (f) => {
    const c = claim(f, "independent-review");
    c.subject.reference.target = { kind: "event_group", id: "review-a" };
  },
  "CASE.ENTITY_RESOLUTION",
  true,
);
negative(
  "does not resolve an omitted field from the schema alone",
  (f) => {
    claim(f, "independent-review").subject.reference.target.field =
      "reportedConfidence";
  },
  "CASE.FIELD_RESOLUTION",
  true,
);
negative(
  "does not resolve an assertion through another field",
  (f) => {
    claim(f, "finding-original").caseInputRefs[0].assertionId = "body";
  },
  "CASE.ASSERTION_RESOLUTION",
  true,
);
negative(
  "resolves link basis to its exact kind and ID",
  (f) => {
    claim(f, "same-object").caseInputRefs[0].target.kind = "membership";
  },
  "CASE.ENTITY_RESOLUTION",
  true,
);
negative(
  "does not resolve external observation endpoints by label",
  (f) => {
    claim(f, "same-object").subject.to.observationId = "unknown";
  },
  "CASE.OBSERVATION_SCOPE",
  true,
);
negative(
  "scopes claim provenance to a case observation",
  (f) => {
    claim(f, "source-conclusion").provenance.observationId = "external";
  },
  "CASE.OBSERVATION_SCOPE",
  true,
);
negative(
  "scopes source IDs inside observation input references",
  (f) => {
    f.second.sources = [];
    refresh(f);
  },
  "CASE.INPUT_RESOLUTION",
  true,
);
negative(
  "resolves source statement provenance independently of its subject",
  (f) => {
    claim(f, "source-conclusion").provenance.sourceRef = "source:absent";
  },
  "CASE.SOURCE_SCOPE",
  true,
);
negative(
  "compares declared source digests",
  (f) => {
    f.first.sources[0].digest = { algorithm: "sha256", value: "a".repeat(64) };
    claim(f, "source-conclusion").provenance.sourceDigest = {
      algorithm: "sha256",
      value: "b".repeat(64),
    };
    refresh(f);
  },
  "SOURCE.DIGEST_MISMATCH",
  true,
);
negative(
  "resolves assessment methods in the scoped observation",
  (f) => {
    claim(f, "same-object").methodRef.observationId = "capture-b";
  },
  "CASE.METHOD_RESOLUTION",
  true,
);
negative(
  "checks assessment method versions",
  (f) => {
    claim(f, "same-object").methodVersion = "2";
  },
  "METHOD.VERSION_MISMATCH",
  true,
);
test("missing, wrong, invalid and substituted case snapshots fail without current-claim output", async () => {
  for (const mode of ["missing", "digest", "json", "identity", "contract"]) {
    const f = fixture(),
      supplied = documents(f),
      ref = f.history.caseRefs[0];
    if (mode === "missing") supplied.delete(ref.sha256);
    else if (mode === "digest") supplied.set(ref.sha256, bytes({}));
    else {
      const value =
        mode === "json"
          ? Buffer.from([255])
          : mode === "identity"
            ? bytes({ ...f.caseRecord, id: "wrong" })
            : bytes({ kind: "case_record" });
      const old = ref.sha256;
      const next = digest(value);
      f.history = JSON.parse(JSON.stringify(f.history).replaceAll(old, next));
      supplied.set(next, value);
    }
    const r = await evaluateCaseClaimHistory(f.history, {
      documents: supplied,
    });
    assert.equal(r.success, false, mode);
    assert.deepEqual(r.currentClaimRefs, []);
    assert.ok(
      r.issues.some(
        (i) =>
          i.code ===
          {
            missing: "SNAPSHOT.UNAVAILABLE",
            digest: "SNAPSHOT.DIGEST",
            json: "SNAPSHOT.JSON",
            identity: "SNAPSHOT.IDENTITY",
            contract: "SNAPSHOT.CONTRACT",
          }[mode],
      ),
      JSON.stringify(r.issues),
    );
  }
});
test("a missing nested observation cannot yield a complete review", async () => {
  const f = fixture(),
    supplied = documents(f);
  supplied.delete(f.caseRecord.observationRefs[1].sha256);
  const r = await evaluateCaseClaimHistory(f.history, { documents: supplied });
  assert.equal(r.success, false);
  assert.ok(r.snapshots.some((s) => s.status === "unavailable"));
  assert.deepEqual(r.currentClaimRefs, []);
});
test("distinct case snapshots can address different revisions of the same observation without rewriting either", async () => {
  const f = fixture(),
    next = fixture();
  next.first.sources[0].title = "Fictional revised first log";
  refresh(next);
  const ref = caseSnapshot(next.caseRecord);
  f.history.caseRefs.push(ref);
  const c = structuredClone(claim(f, "same-object"));
  c.id = "revision-relation";
  c.subject = {
    kind: "case_relation",
    relation: "supersedes",
    from: { case: ref, observationId: "capture-a" },
    to: { case: f.history.caseRefs[0], observationId: "capture-a" },
  };
  f.history.claims.push(c);
  const supplied = new Map([...documents(f), ...documents(next)]),
    before = structuredClone(f);
  const r = await evaluateCaseClaimHistory(f.history, { documents: supplied });
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(f, before);
  assert.equal(r.lifecycleChanges, "not_performed");
  assert.ok(r.currentClaimRefs.includes("claim:revision-relation"));
});
test("two case wrappers cannot disguise identical observation endpoints", async () => {
  const f = fixture(),
    other = fixture();
  other.caseRecord.id = "other-case";
  const ref = caseSnapshot(other.caseRecord);
  f.history.caseRefs.push(ref);
  claim(f, "same-object").subject.to = {
    case: ref,
    observationId: "capture-a",
  };
  const r = await evaluateCaseClaimHistory(f.history, {
    documents: new Map([...documents(f), ...documents(other)]),
  });
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "CASE.SELF_RELATION"));
});
test("never fetches URLs and captures relevant mutable buffers before asynchronous checks", async () => {
  const f = fixture();
  f.first.sources[0].uri = "https://example.invalid/never-fetch";
  refresh(f);
  const supplied = documents(f),
    originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Unexpected network call");
  };
  try {
    const pending = evaluateCaseClaimHistory(f.history, {
      documents: supplied,
    });
    for (const buffer of supplied.values()) buffer.fill(0);
    const r = await pending;
    assert.equal(r.success, true, JSON.stringify(r.issues));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("snapshot semantics include the case graph, not just matching document hashes", async () => {
  const f = fixture();
  f.caseRecord.entities.push({
    ...structuredClone(
      f.caseRecord.entities.find((e) => e.kind === "relationship"),
    ),
    id: "reverse",
    relation: "follows",
  });
  refresh(f);
  const r = await evaluate(f);
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.CONTRACT"));
});
test("new history is not silently projected through a single-observation parser", () => {
  assert.equal(parseLaboratoryClaimHistory(fixture().history).success, false);
});
test("committed schemas and fixtures reproduce, and plain JSON Schema enforces typed targets", () => {
  const schema = caseClaimHistoryJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-records/schema/experimental/case-claim-history-0.1.0.schema.json",
          import.meta.url,
        ),
      ),
    ),
    schema,
  );
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema),
    f = fixture();
  assert.equal(validate(f.history), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(f.history);
  invalid.claims.find(
    (c) => c.id === "finding-original",
  ).caseInputRefs[0].target.field = "unknown";
  assert.equal(validate(invalid), false);
  for (const [name, value] of Object.entries(f))
    assert.deepEqual(
      readFileSync(
        new URL(
          `../examples/v2/case-assessment-demo/${name}.json`,
          import.meta.url,
        ),
      ),
      bytes(value),
    );
});
