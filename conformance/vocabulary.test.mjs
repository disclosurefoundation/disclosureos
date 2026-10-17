import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  parseVocabularyCatalog,
  parseVocabularyBindings,
  vocabularyCatalogJsonSchema,
  vocabularyBindingsJsonSchema,
  vocabularyTermReferenceJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateVocabularyBindings } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { createObservableCatalog } from "../packages/disclosureos-observables/dist/index.js";
import { createOriginCatalog } from "../packages/disclosureos-origins/dist/index.js";
import {
  fixture,
  refresh,
  documents,
  bytes,
  digest,
  snapshot,
} from "../examples/v2/vocabulary-demo/fixture.mjs";
const run = (f, extra = {}) =>
  evaluateVocabularyBindings(f.bindings, { documents: documents(f), ...extra });
function issue(result, code, status = "failed") {
  assert.equal(result.success, false, JSON.stringify(result));
  assert.ok(
    result.issues.some((i) => i.code === code && i.status === status),
    JSON.stringify(result.issues),
  );
}
function edit(name, code, fn) {
  test(name, async () => {
    const f = fixture();
    fn(f);
    refresh(f);
    issue(await run(f), code);
  });
}
test("custom catalog resolves about and criterion separately without rewriting claims", async () => {
  const f = fixture(),
    before = structuredClone(f),
    result = await run(f);
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.deepEqual(result.checks, {
    structural: "passed",
    semantic: "passed",
    profile: "passed",
    external: "not_checked",
  });
  assert.equal(result.bindings.length, 2);
  assert.ok(result.bindings.every((b) => b.status === "passed"));
  assert.equal(result.scientificValidity, "not_checked");
  assert.equal(result.domainProfiles, "not_checked");
  assert.equal(result.authenticity, "not_checked");
  assert.deepEqual(f, before);
});
test("official observable and origin catalogs use the same shared reference mechanics", async () => {
  for (const make of [createObservableCatalog, createOriginCatalog]) {
    const f = fixture();
    f.catalog = make({
      id: "domain-catalog",
      revision: "2026-10",
      publishedBy: "DisclosureOS",
      publishedAt: "2026-10-13T12:00:00Z",
    });
    for (const b of f.bindings.bindings) {
      b.term.catalogId = f.catalog.catalogId;
      b.term.revision = f.catalog.revision;
      b.term.termId = f.catalog.terms[0].id;
    }
    refresh(f);
    assert.equal((await run(f)).success, true);
  }
});
test("about-only source tagging requires no assessment or criterion", async () => {
  const f = fixture();
  f.bindings.bindings.splice(1);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.bindings[0].relation, "about");
});
edit("unknown member is invalid", "VOCABULARY.TERM", (f) => {
  f.bindings.bindings[0].term.termId = "does_not_exist";
});
edit("wrong catalog identity fails", "VOCABULARY.IDENTITY", (f) => {
  f.bindings.bindings[0].term.catalogId = "urn:wrong:catalog";
});
edit("wrong revision fails", "VOCABULARY.IDENTITY", (f) => {
  f.bindings.bindings[0].term.revision = "other";
});
edit(
  "curators cannot relabel the assessor criterion",
  "VOCABULARY.CRITERION_ATTRIBUTION",
  (f) => {
    f.bindings.bindings[1].assignedBy = "person:other";
  },
);
edit(
  "source assertions cannot acquire assessed criteria",
  "VOCABULARY.CRITERION_TARGET",
  (f) => {
    f.bindings.bindings[0].relation = "assessment_criterion";
  },
);
edit(
  "unassessed claims cannot acquire assessed criteria",
  "VOCABULARY.CRITERION_TARGET",
  (f) => {
    f.bindings.bindings[1].claim.claimId = "review-1";
  },
);
edit("binding chronology is checked", "VOCABULARY.CHRONOLOGY", (f) => {
  f.bindings.bindings[0].recordedAt = "2020-01-01T00:00:00Z";
});
edit("missing claim is invalid", "VOCABULARY.CLAIM", (f) => {
  f.bindings.bindings[0].claim.claimId = "absent";
});
edit("duplicate catalog term IDs fail", "SNAPSHOT.CONTRACT", (f) => {
  f.catalog.terms.push({ ...f.catalog.terms[0] });
});
edit("duplicate catalog codes fail", "SNAPSHOT.CONTRACT", (f) => {
  f.catalog.terms[0].code = "T1";
  f.catalog.terms.push({
    id: "second",
    code: "T1",
    label: "Second",
    description: "Second",
  });
});
test("duplicate binding IDs fail local parsing", () => {
  const f = fixture();
  f.bindings.bindings.push(structuredClone(f.bindings.bindings[0]));
  assert.equal(parseVocabularyBindings(f.bindings).success, false);
});
test("unknown fields and latest revisions fail both runtime and emitted schemas", () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  for (const [kind, emit, parse] of [
    ["catalog", vocabularyCatalogJsonSchema, parseVocabularyCatalog],
    ["bindings", vocabularyBindingsJsonSchema, parseVocabularyBindings],
  ]) {
    const f = fixture(),
      validate = ajv.compile(emit());
    assert.equal(validate(f[kind]), true);
    f[kind].unexpected = true;
    assert.equal(validate(f[kind]), false);
    assert.equal(parse(f[kind]).success, false);
  }
  const f = fixture();
  f.catalog.revision = " Latest ";
  assert.equal(parseVocabularyCatalog(f.catalog).success, false);
  assert.equal(
    ajv.getSchema("urn:disclosureos:experimental:vocabulary-catalog:0.1.0")(
      f.catalog,
    ),
    false,
  );
});
test("schema artifacts and package exports match owning emitters", () => {
  for (const [name, emitter] of [
    ["vocabulary-catalog", vocabularyCatalogJsonSchema],
    ["vocabulary-bindings", vocabularyBindingsJsonSchema],
    ["vocabulary-term-reference", vocabularyTermReferenceJsonSchema],
  ])
    for (const pkg of ["records", "schema"]) {
      const json = JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-${pkg}/schema/experimental/${name}-0.1.0.schema.json`,
            import.meta.url,
          ),
        ),
      );
      assert.deepEqual(json, emitter());
      const manifest = JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-${pkg}/package.json`,
            import.meta.url,
          ),
        ),
      );
      assert.equal(
        manifest.exports[`./experimental/v2/${name}/schema/0.1.0`],
        `./schema/experimental/${name}-0.1.0.schema.json`,
      );
    }
});
test("missing bytes remain not_checked and cannot look like absence or validation", async () => {
  const f = fixture();
  for (const target of [f.catalog, f.history]) {
    const supplied = documents(f);
    supplied.delete(digest(bytes(target)));
    const r = await run(f, { documents: supplied });
    issue(r, "SNAPSHOT.UNAVAILABLE", "not_checked");
    assert.equal(r.checks.profile, "not_checked");
  }
});
test("supplied wrong bytes fail even when other input is unavailable", async () => {
  const f = fixture(),
    supplied = documents(f);
  supplied.set(
    digest(bytes(f.catalog)),
    bytes({ ...f.catalog, revision: "changed" }),
  );
  supplied.delete(digest(bytes(f.history)));
  const r = await run(f, { documents: supplied });
  issue(r, "SNAPSHOT.DIGEST");
  assert.equal(r.checks.profile, "failed");
  issue(r, "SNAPSHOT.UNAVAILABLE", "not_checked");
});
test("declared ID and declared schema dispatch cannot be bypassed", async () => {
  const f = fixture();
  f.bindings.bindings[0].term.document.documentId = "wrong";
  issue(await run(f), "SNAPSHOT.IDENTITY");
  const g = fixture();
  g.bindings.bindings[0].claim.document.schemaId = "urn:unknown:history";
  issue(await run(g), "SNAPSHOT.UNSUPPORTED", "not_checked");
  const h = fixture();
  h.bindings.bindings[0].claim.document.schemaId = "__proto__";
  issue(await run(h), "SNAPSHOT.UNSUPPORTED", "not_checked");
});
test("invalid UTF-8 and duplicate JSON keys are rejected, including escaped-equivalent keys", async () => {
  for (const bad of [
    Buffer.from([0xff]),
    Buffer.from('{"id":"other",' + JSON.stringify(fixture().catalog).slice(1)),
    Buffer.from(
      '{"\\u0069d":"other",' + JSON.stringify(fixture().catalog).slice(1),
    ),
  ]) {
    const f = fixture(),
      supplied = documents(f);
    const hash = digest(bad);
    supplied.set(hash, bad);
    for (const b of f.bindings.bindings) b.term.document.sha256 = hash;
    issue(await run(f, { documents: supplied }), "SNAPSHOT.JSON");
  }
});
test("a catalog revision cannot identify conflicting supplied snapshots", async () => {
  const f = fixture(),
    supplied = documents(f),
    other = {
      ...f.catalog,
      id: "other",
      terms: [{ ...f.catalog.terms[0], description: "Changed" }],
    };
  supplied.set(digest(bytes(other)), bytes(other));
  issue(await run(f, { documents: supplied }), "VOCABULARY.REVISION_CONFLICT");
});
test("exact companion duplicates do not duplicate associations; incompatible document IDs fail", async () => {
  const f = fixture(),
    r = await run(f, { additionalBindings: [structuredClone(f.bindings)] });
  assert.equal(r.success, true);
  assert.equal(r.bindings.length, 2);
  const other = structuredClone(f.bindings);
  other.bindings[0].rationale = "Different";
  issue(
    await run(f, { additionalBindings: [other] }),
    "VOCABULARY.BINDINGS_IDENTITY",
  );
});
test("different curators remain independent; two distinct criteria fail across companions", async () => {
  const f = fixture(),
    other = structuredClone(f.bindings);
  other.id = "second-bindings";
  other.bindings = [{ ...other.bindings[0], assignedBy: "person:other" }];
  const r = await run(f, { additionalBindings: [other] });
  assert.equal(r.success, true);
  assert.equal(r.bindings.length, 3);
  f.catalog.terms.push({
    id: "other",
    label: "Other",
    description: "Another characteristic",
  });
  refresh(f);
  other.bindings = [structuredClone(f.bindings.bindings[1])];
  other.bindings[0].term.termId = "other";
  issue(
    await run(f, { additionalBindings: [other] }),
    "VOCABULARY.CRITERION_CONFLICT",
  );
});
function revision(f) {
  const prior = f.history.claims.find((c) => c.id === "review-2");
  f.history.claims.push({
    ...prior,
    id: "review-3",
    recordedAt: "2026-10-01T12:00:00Z",
    evaluatedAt: "2026-10-01T12:00:00Z",
    supersedes: ["claim:review-2"],
  });
  f.bindings.bindings.push({
    ...structuredClone(f.bindings.bindings[1]),
    id: "new-criterion",
    claim: { ...f.bindings.bindings[1].claim, claimId: "review-3" },
  });
  refresh(f);
}
test("assessed revisions retain the same criterion; missing declaration remains unchecked", async () => {
  const f = fixture();
  revision(f);
  assert.equal((await run(f)).success, true);
  f.bindings.bindings.splice(1, 1);
  issue(await run(f), "VOCABULARY.CRITERION_UNAVAILABLE", "not_checked");
});
test("assessed revision cannot change its defined question", async () => {
  const f = fixture();
  revision(f);
  f.catalog.terms.push({
    id: "other",
    label: "Other",
    description: "Another characteristic",
  });
  f.bindings.bindings[2].term.termId = "other";
  refresh(f);
  issue(await run(f), "VOCABULARY.CRITERION_CHANGED");
});
test("caller mutations during awaits cannot alter the evaluated snapshot", async () => {
  const f = fixture(),
    supplied = documents(f),
    task = run(f, { documents: supplied });
  for (const b of supplied.values()) b.fill(0);
  f.bindings.bindings[0].term.termId = "changed";
  assert.equal((await task).success, true);
});
test("all implemented observation and case history contracts resolve their original subject and inputs", async () => {
  for (const path of [
    "context-demo",
    "witness-accounts-demo",
    "archival-editions-demo",
    "laboratory-review-demo",
    "case-assessment-demo",
  ]) {
    const demo = await import(`../examples/v2/${path}/fixture.mjs`),
      actual = demo.fixture();
    const bundled = demo.bundle
      ? demo.bundle(actual)
      : {
          history: actual.history,
          options: { documents: demo.documents(actual) },
        };
    const f = fixture();
    f.history = bundled.history;
    const claim =
      f.history.claims.find((c) => c.kind === "source_assertion") ??
      f.history.claims[0];
    f.bindings.bindings = [
      {
        ...f.bindings.bindings[0],
        claim: {
          document: snapshot(
            f.history,
            `urn:disclosureos:experimental:${f.history.kind === "case_claim_history" ? "case-claim-history" : "claim-history"}:${f.history.schemaVersion}`,
          ),
          claimId: claim.id,
        },
      },
    ];
    const supplied = new Map([...bundled.options.documents, ...documents(f)]);
    const r = await run(f, { documents: supplied });
    assert.equal(r.success, true, `${path}: ${JSON.stringify(r.issues)}`);
    // The companion remains only a term association; the original subject is never copied or widened.
    assert.equal("subject" in r.bindings[0], false);
  }
});
test("missing case dependencies stay unchecked; supplied invalid dependencies fail", async () => {
  const demo = await import("../examples/v2/case-assessment-demo/fixture.mjs"),
    actual = demo.fixture(),
    f = fixture();
  f.history = actual.history;
  const c = f.history.claims[0];
  f.bindings.bindings = [
    {
      ...f.bindings.bindings[0],
      claim: {
        document: snapshot(
          f.history,
          "urn:disclosureos:experimental:case-claim-history:0.1.0",
        ),
        claimId: c.id,
      },
    },
  ];
  const absent = await run(f);
  issue(absent, "SNAPSHOT.UNAVAILABLE", "not_checked");
  assert.equal(absent.checks.profile, "not_checked");
  const supplied = new Map([...demo.documents(actual), ...documents(f)]);
  supplied.set(f.history.caseRefs[0].sha256, bytes({ id: "bad" }));
  const invalid = await run(f, { documents: supplied });
  assert.equal(invalid.checks.profile, "failed");
});
test("invalid supplied history semantics cannot pass through a vocabulary association", async () => {
  const f = fixture();
  f.history.claims.find((c) => c.id === "review-2").inputRefs = [
    "measurement:missing",
  ];
  refresh(f);
  issue(await run(f), "SNAPSHOT.CONTRACT");
});
test("term references cannot use known history schemas as catalog schemas", async () => {
  const f = fixture();
  f.bindings.bindings[0].term.document.schemaId =
    "urn:disclosureos:experimental:claim-history:0.1.0";
  issue(await run(f), "SNAPSHOT.CONTRACT");
});
test("cache reuse cannot make a catalog into a claim history", async () => {
  const f = fixture();
  f.bindings.bindings[0].claim.document = structuredClone(
    f.bindings.bindings[0].term.document,
  );
  issue(await run(f), "SNAPSHOT.CONTRACT");
});
