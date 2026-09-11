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
} from "../examples/v2/witness-accounts-demo/fixture.mjs";
import {
  parseResearchEntities,
  parseResearchClaimHistory,
  parseContextClaimHistory,
  parseExperimentalClaimHistory,
  researchEntitiesJsonSchema,
  researchClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import {
  evaluateResearchClaimHistory,
  evaluateContextClaimHistory,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const run = (f) => {
  const b = bundle(f);
  return evaluateResearchClaimHistory(b.history, b.options);
};
const reject = (r, code) => {
  assert.equal(r.success, false, JSON.stringify(r));
  assert.ok(
    r.issues.some((i) => i.code === code),
    JSON.stringify(r.issues)
  );
};
const neg = (name, change, code) =>
  test(name, async () => {
    const f = fixture();
    change(f);
    reject(await run(f), code);
  });
const witness = (f) => f.entities.entities[0];
const account = (f) => f.entities.entities[1];
test("historical control retains one witness, two accounts, exact quarter and unknown procedures", async () => {
  const f = fixture(),
    before = structuredClone(f);
  const r = await run(f);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(f, before);
  assert.equal(
    f.entities.entities.filter((e) => e.kind === "witness").length,
    1
  );
  assert.equal(
    f.entities.entities.filter((e) => e.kind === "account").length,
    2
  );
  assert.deepEqual(
    f.context.entities[0].fields.calendarPeriod[0].content.value,
    { kind: "quarter", year: 1952, quarter: 3 }
  );
  assert.deepEqual(account(f).fields.recordedTime[0].content.value, {
    kind: "year",
    value: "1981",
  });
  assert.equal(account(f).fields.underOath[0].content.state, "unknown");
  assert.equal(
    witness(f).fields.willingToBeIdentified[0].content.state,
    "unknown"
  );
  assert.equal(r.scientificInterpretation, "not_checked");
  assert.equal(r.sourceArtifactIntegrity, "not_checked");
  assert.equal(r.checks.profile, "not_checked");
  assert.equal(r.checks.external, "passed");
  assert.equal(f.observation.measurements.length, 0);
  assert.equal(r.score, undefined);
});
test("parser does not certify unavailable documents", () => {
  const f = fixture();
  for (const r of [
    parseResearchEntities(f.entities),
    parseResearchClaimHistory(f.history),
  ]) {
    assert.equal(r.success, true, JSON.stringify(r.issues));
    assert.equal(r.checks.external, "not_checked");
  }
});
test("old history dispatch explicitly rejects 0.3", async () => {
  const f = fixture();
  assert.equal(parseContextClaimHistory(f.history).success, false);
  assert.equal(parseExperimentalClaimHistory(f.history).success, false);
  assert.equal(
    (await evaluateContextClaimHistory(f.history, { documents: new Map() }))
      .success,
    false
  );
});
neg(
  "duplicate witness IDs fail",
  (f) => f.entities.entities.push(structuredClone(witness(f))),
  "REF.UNIQUE_ID"
);
neg(
  "account ID cannot substitute for a missing witness",
  (f) =>
    (account(f).fields.speakerWitnessIds = sourced("speaker", ["retelling"])),
  "REF.ENTITY"
);
neg(
  "wrong-kind claim target fails",
  (f) =>
    (f.history.claims[0].subject.reference.target = {
      kind: "witness",
      id: "retelling",
    }),
  "REF.ENTITY"
);
neg(
  "unsupplied target field fails",
  (f) => (f.history.claims[0].subject.reference.target.field = "organization"),
  "REF.FIELD"
);
neg(
  "wrong assertion ID fails",
  (f) => (f.history.claims[0].entityInputRefs[0].assertionId = "aviation"),
  "REF.ASSERTION"
);
neg(
  "assertion input without field fails",
  (f) => delete f.history.claims[0].entityInputRefs[0].target.field,
  "REF.ASSERTION"
);
neg(
  "duplicate assertion IDs fail across fields",
  (f) => (witness(f).fields.anonymous[0].id = "experience"),
  "REF.UNIQUE_ID"
);
neg(
  "negative experience fails",
  (f) => (witness(f).fields.experienceYears[0].content.value.value = -1),
  "STRUCT.VALUE"
);
neg(
  "qualification requires temporal context",
  (f) => delete witness(f).fields.experienceYears[0].content.value.relevantTime,
  "STRUCT.VALUE"
);
neg(
  "qualification unknown calendar month fails",
  (f) =>
    (witness(f).fields.experienceYears[0].content.value.relevantTime = {
      kind: "calendar",
      value: { kind: "month", value: "1952-13" },
    }),
  "STRUCT.VALUE"
);
neg(
  "invalid calendar date fails",
  (f) =>
    (account(f).fields.recordedTime[0].content.value = {
      kind: "date",
      value: "1981-02-30",
    }),
  "STRUCT.VALUE"
);
neg(
  "known qualification needs source provenance",
  (f) => delete witness(f).fields.experienceYears[0].content.provenance,
  "STRUCT.VALUE"
);
neg(
  "unmapped values preserve wording but still require source",
  (f) =>
    (witness(f).fields.category = [
      {
        id: "category",
        content: {
          state: "unmapped",
          originalWording: "a source-specific term",
        },
      },
    ]),
  "STRUCT.VALUE"
);
neg(
  "unlisted witness category fails",
  (f) => (witness(f).fields.category[0].content.value.value = "aviator"),
  "STRUCT.VALUE"
);
neg(
  "unknown is not false with an attached value",
  (f) => (account(f).fields.underOath[0].content.value = false),
  "STRUCT.VALUE"
);
neg(
  "direct credibility field on a witness fails",
  (f) => (witness(f).fields.credibility = { rating: "high" }),
  "STRUCT.VALUE"
);
neg(
  "oath is account-scoped",
  (f) => (witness(f).fields.underOath = sourced("oath", true)),
  "STRUCT.VALUE"
);
neg(
  "undeclared source fails",
  (f) =>
    (witness(f).fields.experienceYears[0].content.provenance.sourceRef =
      "source:missing"),
  "REF.LOCAL_RESOLUTION"
);
neg(
  "undeclared account document fails",
  (f) =>
    (account(f).fields.sourceDocument = sourced("source", "source:missing")),
  "REF.LOCAL_RESOLUTION"
);
neg(
  "external support is scoped to the observation",
  (f) =>
    (account(f).fields.supportRefs = sourced("support", ["product:missing"])),
  "REF.LOCAL_RESOLUTION"
);
neg(
  "locator reversal fails",
  (f) =>
    (witness(f).fields.experienceYears[0].content.provenance.locator = {
      kind: "time_range",
      startSeconds: 2,
      endSeconds: 1,
    }),
  "TIME.INTERVAL"
);
neg(
  "source digest disagreement fails",
  (f) => {
    f.observation.sources[0].digest = {
      algorithm: "sha256",
      value: "a".repeat(64),
    };
    witness(f).fields.experienceYears[0].content.provenance.sourceDigest = {
      algorithm: "sha256",
      value: "b".repeat(64),
    };
  },
  "SOURCE.DIGEST_MISMATCH"
);
neg(
  "missing qualification context entity fails",
  (f) =>
    (witness(
      f
    ).fields.experienceYears[0].content.value.relevantTime.reference.target.id =
      "missing"),
  "REF.ENTITY"
);
neg(
  "context from another kind cannot impersonate temporal entity",
  (f) =>
    (witness(
      f
    ).fields.experienceYears[0].content.value.relevantTime.reference.target.kind =
      "place"),
  "STRUCT.VALUE"
);
neg(
  "assessment method version must match",
  (f) => (f.history.claims[0].methodVersion = "2"),
  "METHOD.VERSION_MISMATCH"
);
neg(
  "witness review requires inputs",
  (f) => {
    f.history.claims[0].inputRefs = [];
    f.history.claims[0].entityInputRefs = [];
  },
  "REF.LOCAL_RESOLUTION"
);
neg(
  "witness review requires entity subject",
  (f) => (f.history.claims[0].subject = { kind: "observation" }),
  "CLAIM.SUPERSESSION_SCOPE"
);
neg(
  "claim dependency cycle fails",
  (f) => (f.history.claims[0].inputRefs = ["claim:qualification-review"]),
  "CLAIM.DEPENDENCY_CYCLE"
);
neg(
  "changing subject cannot supersede earlier assessment",
  (f) => {
    const c = structuredClone(f.history.claims[0]);
    c.id = "later";
    c.subject.reference.target = { kind: "account", id: "A" };
    c.supersedes = ["claim:qualification-review"];
    f.history.claims.push(c);
  },
  "CLAIM.SUPERSESSION_SCOPE"
);
neg(
  "different evaluator cannot supersede",
  (f) => {
    const c = structuredClone(f.history.claims[0]);
    c.id = "later";
    c.evaluatedBy = "Other reviewer";
    c.supersedes = ["claim:qualification-review"];
    f.history.claims.push(c);
  },
  "CLAIM.REVISION_ATTRIBUTION"
);
test("reviewers may disagree without automatic selection", async () => {
  const f = fixture(),
    c = structuredClone(f.history.claims[0]);
  c.id = "other";
  c.evaluatedBy = "Other reviewer";
  c.witnessReview = { rating: "low", detractors: ["delayed_report"] };
  f.history.claims.push(c);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.currentClaimRefs.length, 2);
});
test("reported count is not inferred from roster or account count", async () => {
  const f = fixture();
  f.entities.entities[4].fields.reportedCount = sourced("count", 7);
  assert.equal((await run(f)).success, true);
  assert.equal(f.entities.entities[4].fields.reportedCount[0].content.value, 7);
});
test("explicit negative retains its provenance", async () => {
  const f = fixture();
  account(f).fields.underOath = sourced("oath", false);
  assert.equal((await run(f)).success, true);
  assert.equal(account(f).fields.underOath[0].content.value, false);
});
test("all missingness states stay distinct and unselected", async () => {
  const f = fixture();
  witness(f).fields.description = [
    {
      id: "redacted",
      content: { state: "redacted", reason: "Not part of public release" },
    },
    {
      id: "unmapped",
      content: {
        state: "unmapped",
        originalWording: "Source wording",
        provenance: { sourceRef: "source:account-1981" },
      },
    },
    {
      id: "approximate",
      content: {
        state: "approximate",
        value: "A source description",
        precision: "Approximate wording",
        provenance: { sourceRef: "source:account-1981" },
      },
    },
  ];
  assert.equal((await run(f)).success, true);
  assert.equal(witness(f).selections, undefined);
});
for (const [name, change] of [
  [
    "missing bytes",
    (b) => b.options.documents.delete(b.history.entityRefs[0].sha256),
  ],
  [
    "altered bytes",
    (b) =>
      b.options.documents.set(
        b.history.entityRefs[0].sha256,
        Buffer.from("{}")
      ),
  ],
])
  test(name, async () => {
    const b = bundle(fixture());
    change(b);
    reject(
      await evaluateResearchClaimHistory(b.history, b.options),
      name === "missing bytes" ? "SNAPSHOT.UNAVAILABLE" : "SNAPSHOT.DIGEST"
    );
  });
test("same observation ID with different content fails scope", async () => {
  const f = fixture(),
    b = bundle(f);
  b.history.observation = { ...f.observation, summary: "Different snapshot" };
  reject(
    await evaluateResearchClaimHistory(b.history, b.options),
    "ENTITIES.OBSERVATION_SCOPE"
  );
});
test("wrong snapshot identity fails", async () => {
  const b = bundle(fixture());
  b.history.entityRefs[0].documentId = "wrong";
  for (const c of b.history.claims) {
    c.subject.reference.document = b.history.entityRefs[0];
    c.entityInputRefs[0].document = b.history.entityRefs[0];
  }
  reject(
    await evaluateResearchClaimHistory(b.history, b.options),
    "SNAPSHOT.IDENTITY"
  );
});
test("undeclared entities context dependency fails", async () => {
  const b = bundle(fixture());
  b.history.contextRefs = [];
  reject(
    await evaluateResearchClaimHistory(b.history, b.options),
    "REF.LOCAL_RESOLUTION"
  );
});
test("strict public contract rejects private identity and contact fields without reflecting values", () => {
  for (const key of ["legalName", "email", "phone", "privateIdentityMapping"]) {
    const f = fixture();
    witness(f)[key] = "PRIVATE_CANARY";
    const result = parseResearchEntities(f.entities);
    reject(result, "STRUCT.VALUE");
    assert.equal(JSON.stringify(result).includes("PRIVATE_CANARY"), false);
  }
});
test("emitted schemas and parsers agree on structure and checked-in bytes", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const f = fixture();
  for (const [name, emit, data, parse] of [
    [
      "research-entities-0.1.0",
      researchEntitiesJsonSchema,
      f.entities,
      parseResearchEntities,
    ],
    [
      "claim-history-0.3.0",
      researchClaimHistoryJsonSchema,
      f.history,
      parseResearchClaimHistory,
    ],
  ]) {
    const schema = emit();
    assert.deepEqual(
      schema,
      JSON.parse(
        readFileSync(
          new URL(
            `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
            import.meta.url
          )
        )
      )
    );
    const validate = ajv.compile(schema);
    assert.equal(validate(data), true, JSON.stringify(validate.errors));
    assert.equal(parse(data).success, true);
    const invalid = { ...data, privateEnvelope: { secret: "PRIVATE_CANARY" } };
    assert.equal(validate(invalid), false);
    assert.equal(parse(invalid).success, false);
  }
});
test("checked-in fixture files match generator", () => {
  const f = fixture();
  bundle(f);
  for (const [name, value] of Object.entries(f))
    assert.equal(
      readFileSync(
        new URL(
          `../examples/v2/witness-accounts-demo/${name}.json`,
          import.meta.url
        ),
        "utf8"
      ),
      bytes(value).toString()
    );
});

test("snapshot-byte ownership is copied before asynchronous hashing", async () => {
  const b = bundle(fixture());
  const ref = b.history.contextRefs[0];
  const supplied = b.options.documents.get(ref.sha256);
  const promise = evaluateResearchClaimHistory(b.history, b.options);
  supplied.fill(0);
  assert.equal((await promise).success, true);
});
test("invalid UTF-8 cannot pass even with a correct declared digest", async () => {
  const b = bundle(fixture()),
    bad = Buffer.from([0xff]);
  const ref = { ...b.history.entityRefs[0], sha256: digest(bad) };
  b.history.entityRefs = [ref];
  b.history.claims = [];
  b.options.documents.set(ref.sha256, bad);
  reject(
    await evaluateResearchClaimHistory(b.history, b.options),
    "SNAPSHOT.JSON"
  );
});
test("entity snapshot revision cannot silently supersede another snapshot", () => {
  const f = fixture(),
    c = structuredClone(f.history.claims[0]);
  c.id = "revision";
  c.subject.reference.document.sha256 = "a".repeat(64);
  c.entityInputRefs = [];
  c.supersedes = ["claim:qualification-review"];
  f.history.entityRefs.push(c.subject.reference.document);
  f.history.claims.push(c);
  reject(parseResearchClaimHistory(f.history), "CLAIM.SUPERSESSION_SCOPE");
});
neg(
  "negative reported count fails",
  (f) => (f.entities.entities[4].fields.reportedCount = sourced("count", -1)),
  "STRUCT.VALUE"
);
neg(
  "fractional reported count fails",
  (f) => (f.entities.entities[4].fields.reportedCount = sourced("count", 1.5)),
  "STRUCT.VALUE"
);
neg(
  "new contract does not allow arbitrary entity fields",
  (f) => (witness(f).fields.unknownField = sourced("x", "value")),
  "STRUCT.VALUE"
);
neg(
  "unknown field target fails structural validation",
  (f) =>
    (f.history.claims[0].subject.reference.target.field = "privateIdentity"),
  "STRUCT.VALUE"
);

test("C2 keeps C1 context semantics when no research entities are supplied", async () => {
  const { fixture: sensorFixture, bundle: sensorBundle } = await import(
    "../examples/v2/context-demo/fixture.mjs"
  );
  const b = sensorBundle(sensorFixture());
  const before = await evaluateContextClaimHistory(b.history, b.options);
  const history = { ...b.history, schemaVersion: "0.3.0", entityRefs: [] };
  const after = await evaluateResearchClaimHistory(history, b.options);
  assert.equal(before.success, true);
  assert.equal(after.success, true, JSON.stringify(after.issues));
  assert.deepEqual(after.checks, before.checks);
  assert.deepEqual(after.currentClaimRefs, before.currentClaimRefs);
  assert.deepEqual(after.snapshots, before.snapshots);
});
test("unassessed entity claims retain unknown review status", async () => {
  const f = fixture();
  const c = f.history.claims[0];
  c.status = "unassessed";
  for (const key of [
    "outcome",
    "evaluatedBy",
    "evaluatedAt",
    "methodRef",
    "methodVersion",
    "witnessReview",
  ])
    delete c[key];
  assert.equal((await run(f)).success, true);
});
