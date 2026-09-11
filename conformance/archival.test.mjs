import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  fixture,
  bundle,
  bytes,
  digest,
  sourced,
  unknown,
} from "../examples/v2/archival-editions-demo/fixture.mjs";
import {
  fixture as witnessFixture,
  bundle as witnessBundle,
} from "../examples/v2/witness-accounts-demo/fixture.mjs";
import {
  parseArchivalEntities,
  parseArchivalClaimHistory,
  parseResearchEntities,
  parseResearchClaimHistory,
  archivalEntitiesJsonSchema,
  archivalClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import {
  evaluateArchivalClaimHistory,
  evaluateResearchClaimHistory,
  evaluateHistoricalTestimony,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const entity = (f, id) => f.entities.entities.find((e) => e.id === id);
const run = (f) => {
  const b = bundle(f);
  return evaluateArchivalClaimHistory(b.history, b.options);
};
const reject = (r, code) => {
  assert.equal(r.success, false, JSON.stringify(r));
  assert.ok(
    r.issues.some((i) => i.code === code),
    JSON.stringify(r.issues),
  );
};
const negative = (name, change, code) =>
  test(name, async () => {
    const f = fixture();
    change(f);
    reject(await run(f), code);
  });
test("two editions retain exact pagination, unknown declassification, legacy hash declaration and custody gap", async () => {
  const f = fixture(),
    before = structuredClone(f);
  const r = await run(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(f, before);
  assert.equal(entity(f, "edition-a").fields.pageCount[0].content.value, 3);
  assert.equal(entity(f, "edition-b").fields.pageCount[0].content.value, 4);
  assert.equal(
    entity(f, "declassification-a").fields.occurredAt[0].content.state,
    "unknown",
  );
  assert.equal(
    entity(f, "edition-a").fields.redactionPercent[0].content.state,
    "unknown",
  );
  assert.equal(entity(f, "receive-a").predecessor.kind, "unknown");
  assert.equal(
    entity(f, "file-a").fields.declaredHashes[0].content.value[0].appliesTo
      .kind,
    "unavailable_original",
  );
  assert.deepEqual(r.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    profile: "not_checked",
  });
  for (const key of [
    "sourceArtifactIntegrity",
    "scientificInterpretation",
    "temporalNormalization",
    "multiSensorFusion",
  ])
    assert.equal(r[key], "not_checked");
  assert.equal(r.authenticity, undefined);
  assert.equal(r.custodyComplete, undefined);
});
test("explicit version dispatch never silently projects new entities or histories", async () => {
  const f = fixture();
  assert.equal(parseResearchEntities(f.entities).success, false);
  assert.equal(parseResearchClaimHistory(f.history).success, false);
  assert.equal(
    (await evaluateResearchClaimHistory(f.history, { documents: new Map() }))
      .success,
    false,
  );
  assert.equal(
    (await evaluateHistoricalTestimony(f.history, {}, { assets: new Map() }))
      .success,
    false,
  );
  const old = witnessFixture();
  assert.equal(parseArchivalEntities(old.entities).success, false);
  assert.equal(parseArchivalClaimHistory(old.history).success, false);
  const b = witnessBundle(old);
  assert.equal(
    (await evaluateResearchClaimHistory(b.history, b.options)).success,
    true,
  );
});
test("parsing leaves external references unchecked and retains input values", () => {
  const f = fixture();
  for (const [input, parse] of [
    [f.entities, parseArchivalEntities],
    [f.history, parseArchivalClaimHistory],
  ]) {
    const r = parse(input);
    assert.equal(r.success, true, JSON.stringify(r.issues));
    assert.deepEqual(r.data, input);
    assert.equal(r.checks.external, "not_checked");
    assert.equal(r.checks.profile, "not_checked");
  }
});
negative(
  "same-title edition cannot replace cited edition",
  (f) => {
    f.history.claims[0].editionCitation.editionId = "edition-b";
  },
  "ARCHIVE.CITATION_SCOPE",
);
negative(
  "source-statement locator must match edition citation",
  (f) => {
    f.history.claims[0].provenance.locator.page = 1;
  },
  "ARCHIVE.CITATION_SCOPE",
);
negative(
  "source-statement source must match edition citation",
  (f) => {
    f.history.claims[0].provenance.sourceRef = "source:memo-b";
    f.history.claims[0].provenance.sourceDigest = f.observation.sources.find(
      (s) => s.id === "memo-b",
    ).digest;
  },
  "ARCHIVE.CITATION_SCOPE",
);
negative(
  "page outside exact edition count fails",
  (f) => {
    f.history.claims[1].editionInputRefs[0].locator.page = 4;
  },
  "ARCHIVE.PAGE_BOUNDS",
);
negative(
  "citation cannot use artifact ID as edition ID",
  (f) => {
    f.history.claims[1].editionInputRefs[0].editionId = "file-a";
  },
  "REF.ENTITY",
);
negative(
  "edition artifact digest mismatch fails",
  (f) => {
    entity(f, "edition-a").artifact = structuredClone(
      entity(f, "edition-a").artifact,
    );
    entity(f, "edition-a").artifact.digest.value = "f".repeat(64);
  },
  "ARCHIVE.ARTIFACT_IDENTITY",
);
negative(
  "missing source-inventory digest is not made up",
  (f) => {
    delete f.observation.sources[0].digest;
  },
  "ARCHIVE.ARTIFACT_IDENTITY",
);
negative(
  "MD5 cannot satisfy artifact SHA-256 identity",
  (f) => {
    entity(f, "edition-a").artifact.digest = {
      algorithm: "md5",
      value: "0".repeat(32),
    };
  },
  "STRUCT.VALUE",
);
negative(
  "SHA-256 additional declaration cannot contradict selected artifact",
  (f) => {
    entity(f, "file-a").fields.declaredHashes = sourced("hash", [
      {
        hash: { algorithm: "sha256", value: "f".repeat(64) },
        appliesTo: {
          kind: "artifact",
          reference: structuredClone(entity(f, "edition-a").artifact),
        },
      },
    ]);
  },
  "ARCHIVE.HASH_DECLARATION",
);
negative(
  "legacy digest has its algorithm-specific length",
  (f) => {
    entity(f, "file-a").fields.declaredHashes[0].content.value[0].hash.value =
      "abc";
  },
  "STRUCT.VALUE",
);
negative(
  "duplicate typed identity fails",
  (f) => {
    f.entities.entities.push(structuredClone(entity(f, "edition-a")));
  },
  "REF.UNIQUE_ID",
);
negative(
  "assertion identity cannot repeat across metadata fields",
  (f) => {
    entity(f, "edition-a").fields.pageCount[0].id = "title";
  },
  "REF.UNIQUE_ID",
);
negative(
  "document event must reference edition kind",
  (f) => {
    entity(f, "release-a").editionId = "file-a";
  },
  "REF.ENTITY",
);
negative(
  "custody action must reference digital artifact kind",
  (f) => {
    entity(f, "receive-a").artifactId = "edition-a";
  },
  "REF.ENTITY",
);
negative(
  "custody predecessor cannot change artifacts",
  (f) => {
    entity(f, "store-a").artifactId = "file-b";
  },
  "ARCHIVE.CUSTODY_SCOPE",
);
negative(
  "custody predecessor cycle fails",
  (f) => {
    entity(f, "receive-a").predecessor = { kind: "action", id: "store-a" };
  },
  "ARCHIVE.CUSTODY_CYCLE",
);
negative(
  "custody action cannot be its own predecessor",
  (f) => {
    entity(f, "receive-a").predecessor = { kind: "action", id: "receive-a" };
  },
  "ARCHIVE.CUSTODY_CYCLE",
);
negative(
  "custody missing predecessor fails",
  (f) => {
    entity(f, "receive-a").predecessor = { kind: "action", id: "absent" };
  },
  "REF.ENTITY",
);
negative(
  "explicit custody recipient/sender mismatch fails",
  (f) => {
    entity(f, "store-a").fields.from = sourced("from", "Other holder");
  },
  "ARCHIVE.CUSTODY_HANDOFF",
);
negative(
  "comparable declared custody dates cannot reverse order",
  (f) => {
    entity(f, "receive-a").fields.occurredAt = sourced("date", {
      kind: "date",
      value: "2026-09-10",
    });
    entity(f, "store-a").fields.occurredAt = sourced("date", {
      kind: "date",
      value: "2026-09-09",
    });
  },
  "ARCHIVE.CUSTODY_ORDER",
);
negative(
  "artifact derivation cycle fails",
  (f) => {
    entity(f, "file-a").fields.derivedFromArtifactIds = sourced("parent", [
      "file-b",
    ]);
    entity(f, "file-b").fields.derivedFromArtifactIds = sourced("parent", [
      "file-a",
    ]);
  },
  "ARCHIVE.DERIVATION_CYCLE",
);
negative(
  "artifact derivation missing parent fails",
  (f) => {
    entity(f, "file-a").fields.derivedFromArtifactIds = sourced("parent", [
      "absent",
    ]);
  },
  "REF.ENTITY",
);
negative(
  "artifact parent repetition fails",
  (f) => {
    entity(f, "file-a").fields.derivedFromArtifactIds = sourced("parent", [
      "file-b",
      "file-b",
    ]);
  },
  "REF.UNIQUE_ID",
);
negative(
  "custom identifier needs declared system name",
  (f) => {
    delete entity(f, "catalog-a").fields.value[0].content.value.systemName;
  },
  "ARCHIVE.IDENTIFIER_SYSTEM",
);
negative(
  "identifier check binds a value assertion",
  (f) => {
    entity(f, "access-a").identifierAssertionId = "display";
  },
  "REF.ASSERTION",
);
negative(
  "identifier check cannot refer to an edition as an identifier",
  (f) => {
    entity(f, "access-a").identifierId = "edition-a";
  },
  "REF.ENTITY",
);
negative(
  "access result cannot be labeled identity result",
  (f) => {
    entity(f, "access-a").fields.outcome[0].content.value.kind = "identity";
  },
  "STRUCT.VALUE",
);
negative(
  "page count cannot be fractional",
  (f) => {
    entity(f, "edition-a").fields.pageCount = sourced("pages", 3.5);
  },
  "STRUCT.VALUE",
);
negative(
  "redaction percentage cannot exceed 100",
  (f) => {
    entity(f, "edition-a").fields.redactionPercent = sourced("extent", 101);
  },
  "STRUCT.VALUE",
);
negative(
  "metadata GPS coordinates remain bounded",
  (f) => {
    entity(f, "file-a").fields.gpsCoordinates = sourced("gps", {
      latitude: 91,
      longitude: 0,
    });
  },
  "STRUCT.VALUE",
);
negative(
  "invalid release calendar date fails",
  (f) => {
    entity(f, "release-a").fields.occurredAt = sourced("date", {
      kind: "date",
      value: "2025-02-29",
    });
  },
  "STRUCT.VALUE",
);
negative(
  "metadata private identity map is rejected",
  (f) => {
    entity(f, "file-a").fields.privateIdentityMapping = {};
  },
  "STRUCT.VALUE",
);
negative(
  "private intake fields at envelope root are rejected",
  (f) => {
    f.entities.privateIntake = { phone: "fictional" };
  },
  "STRUCT.VALUE",
);
negative(
  "review requires edition or digital artifact subject",
  (f) => {
    f.history.claims[1].subject.reference.target = {
      kind: "document_event",
      id: "release-a",
    };
  },
  "ARCHIVE.REVIEW_SUBJECT",
);
negative(
  "authenticity review cannot have no inputs",
  (f) => {
    f.history.claims[1].inputRefs = [];
    f.history.claims[1].editionInputRefs = [];
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "review report must exist in inventory",
  (f) => {
    f.history.claims[1].artifactReview.reportRef = "source:absent";
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "unassessed claim cannot carry authenticity outcome",
  (f) => {
    f.history.claims[1].status = "unassessed";
  },
  "STRUCT.VALUE",
);
negative(
  "duplicate edition citations fail",
  (f) => {
    f.history.claims[1].editionInputRefs.push(
      structuredClone(f.history.claims[1].editionInputRefs[0]),
    );
  },
  "REF.UNIQUE_ID",
);
test("unknown page count and conflicting markings do not select a winner", async () => {
  const f = fixture();
  entity(f, "edition-a").fields.pageCount = unknown("pages");
  entity(f, "edition-a").fields.originalClassification.push(
    ...sourced("other-marking", "CONFIDENTIAL"),
  );
  entity(f, "store-a").fields.from = unknown("from");
  entity(f, "file-a").fields.gpsCoordinates = sourced("gps", {
    latitude: 0,
    longitude: 0,
    altitude: { value: 42, unit: null },
  });
  assert.equal((await run(f)).success, true);
  assert.equal(entity(f, "edition-a").fields.originalClassification.length, 2);
});
test("reported authenticity review remains a source statement with date precision intact", async () => {
  const f = fixture();
  f.history.claims[0].reportedArtifactReview = {
    verifier: "Fictional expert",
    reviewedAt: { kind: "year", value: "1981" },
    result: "authentic",
    confidence: "high",
  };
  const r = await run(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(r.sourceArtifactIntegrity, "not_checked");
  assert.equal(f.history.claims[0].kind, "source_assertion");
});
for (const name of [
  "unavailable",
  "digest",
  "JSON",
  "identity",
  "scope",
  "undeclared-citation-snapshot",
])
  test(`supplied snapshot: ${name}`, async () => {
    const f = fixture(),
      b = bundle(f),
      ref = b.history.entityRefs[0];
    if (name === "unavailable") b.options.documents.delete(ref.sha256);
    if (name === "digest")
      b.options.documents.set(ref.sha256, Buffer.from("{}"));
    if (["JSON", "identity", "scope"].includes(name)) {
      const changed =
        name === "JSON"
          ? Buffer.from([255])
          : bytes(
              name === "identity"
                ? { ...f.entities, id: "different" }
                : {
                    ...f.entities,
                    observationRef: {
                      ...f.entities.observationRef,
                      documentId: "different",
                    },
                  },
            );
      ref.sha256 = digest(changed);
      b.options.documents.set(ref.sha256, changed);
    }
    if (name === "undeclared-citation-snapshot")
      b.history.claims[0].editionCitation.document = {
        ...ref,
        documentId: "different",
      };
    const codes = {
      unavailable: "SNAPSHOT.UNAVAILABLE",
      digest: "SNAPSHOT.DIGEST",
      JSON: "SNAPSHOT.JSON",
      identity: "SNAPSHOT.IDENTITY",
      scope: "SNAPSHOT.IDENTITY",
      "undeclared-citation-snapshot": "REF.LOCAL_RESOLUTION",
    };
    reject(
      await evaluateArchivalClaimHistory(b.history, b.options),
      codes[name],
    );
  });
test("emitted schemas match committed bytes and agree with Zod on structural acceptance", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const [file, emit, parse, input] of [
    [
      "research-entities-0.2.0",
      archivalEntitiesJsonSchema,
      parseArchivalEntities,
      fixture().entities,
    ],
    [
      "claim-history-0.4.0",
      archivalClaimHistoryJsonSchema,
      parseArchivalClaimHistory,
      fixture().history,
    ],
  ]) {
    const schema = emit();
    assert.deepEqual(
      schema,
      JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-records/schema/experimental/${file}.schema.json`,
            import.meta.url,
          ),
        ),
      ),
    );
    const check = ajv.compile(schema);
    for (const value of [
      input,
      { ...input, schemaVersion: "9.9.9" },
      { ...input, privateIntake: {} },
      { ...input, id: "bad\n" },
    ])
      assert.equal(
        check(value),
        parse(value).checks.structural === "passed",
        JSON.stringify(check.errors),
      );
  }
});
test("committed worked example bytes and referenced digests reproduce the fixture", () => {
  const f = fixture();
  bundle(f);
  for (const [name, value] of Object.entries(f))
    assert.deepEqual(
      bytes(value),
      readFileSync(
        new URL(
          `../examples/v2/archival-editions-demo/${name}.json`,
          import.meta.url,
        ),
      ),
    );
});

negative(
  "identifier subject cannot substitute an artifact for an edition",
  (f) => {
    entity(f, "catalog-a").subject.editionId = "file-a";
  },
  "REF.ENTITY",
);
test("observation identifiers retain observation scope independently of document editions", async () => {
  const f = fixture();
  entity(f, "catalog-a").subject = { kind: "observation" };
  assert.equal((await run(f)).success, true);
});
test("witness review can cite edition inputs in the archival contract", async () => {
  const f = fixture();
  f.entities.entities.push({ kind: "witness", id: "public-a", fields: {} });
  const c = f.history.claims[1];
  c.subject.reference.target = { kind: "witness", id: "public-a" };
  delete c.artifactReview;
  c.witnessReview = { notes: "Fictional review based on declared editions." };
  c.inputRefs = [];
  assert.equal((await run(f)).success, true);
});
