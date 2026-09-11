import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  parseCaseRecord,
  caseRecordJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateCaseRecord } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  documents,
  bytes,
  digest,
  basis,
  sourced,
} from "../examples/v2/connected-case-demo/fixture.mjs";
const entity = (f, id) => f.caseRecord.entities.find((e) => e.id === id);
const evaluate = (f) =>
  evaluateCaseRecord(f.caseRecord, { documents: documents(f) });
function negative(name, edit, code, external = false) {
  test(name, async () => {
    const f = fixture();
    edit(f);
    refresh(f);
    const result = external ? await evaluate(f) : parseCaseRecord(f.caseRecord);
    assert.equal(result.success, false, JSON.stringify(result));
    assert.ok(
      result.issues.some((i) => i.code === code),
      JSON.stringify(result.issues),
    );
  });
}

test("resolves sourced case scope without inferring common identity, exact times, or preferred findings", async () => {
  const f = fixture(),
    before = structuredClone(f),
    supplied = documents(f),
    beforeBytes = structuredClone(supplied);
  const local = parseCaseRecord(f.caseRecord);
  assert.equal(local.success, true);
  assert.equal(local.checks.external, "not_checked");
  assert.equal(local.uncheckedRefs.length, 2);
  const result = await evaluateCaseRecord(f.caseRecord, {
    documents: supplied,
  });
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.deepEqual(result.checks, {
    structural: "passed",
    semantic: "passed",
    external: "passed",
    profile: "not_checked",
  });
  assert.equal(result.declaredChronology, "acyclic");
  assert.equal(result.scientificInterpretation, "not_checked");
  assert.equal(result.temporalNormalization, "not_checked");
  assert.equal(result.sourceArtifactIntegrity, "not_checked");
  assert.equal(entity(f, "review-a").fields.reportedConclusion.length, 2);
  assert.equal(f.first.eventTime.state, "unknown");
  assert.equal(
    entity(f, "public-response").fields.mediaAttention[0].content.value,
    false,
  );
  assert.deepEqual(f, before);
  assert.deepEqual(structuredClone(supplied), beforeBytes);
  assert.equal("sameObject" in result, false);
  assert.equal("selectedConclusion" in result, false);
});
test("array order does not create relationships and reverse related links are not chronology cycles", async () => {
  const f = fixture();
  f.caseRecord.entities.reverse();
  f.caseRecord.observationRefs.reverse();
  const relationship = entity(f, "later");
  relationship.relation = "related_to";
  f.caseRecord.entities.push({
    ...structuredClone(relationship),
    id: "reverse",
    fromObservationId: "capture-b",
    toObservationId: "capture-a",
  });
  assert.equal((await evaluate(f)).success, true);
});
negative(
  "rejects wrong case version",
  (f) => {
    f.caseRecord.schemaVersion = "0.2.0";
  },
  "STRUCT.VALUE",
);
negative(
  "rejects undeclared private fields",
  (f) => {
    f.caseRecord.internalNotes =
      "Private review must stay in the application envelope";
  },
  "STRUCT.VALUE",
);
negative(
  "rejects unqualified identity assertions as structural relations",
  (f) => {
    entity(f, "later").relation = "same_object";
  },
  "STRUCT.VALUE",
);
negative(
  "rejects an unsourced relationship",
  (f) => {
    delete entity(f, "later").basis;
  },
  "STRUCT.VALUE",
);
negative(
  "requires attribution for sourced case statements",
  (f) => {
    delete entity(f, "later").basis.provenance.attributedTo;
  },
  "STRUCT.VALUE",
);
negative(
  "does not invent a negative from omitted source attribution",
  (f) => {
    delete entity(f, "public-response").fields.mediaAttention[0].content
      .provenance;
  },
  "STRUCT.VALUE",
);
test("permits unknown, approximate, redacted and unmapped declarations without coercion", () => {
  const f = fixture();
  entity(f, "review-a").fields.status = [
    { id: "unknown", content: { state: "unknown", reason: "unavailable" } },
    {
      id: "hidden",
      content: { state: "redacted", reason: "Withheld in this source" },
    },
    {
      ...sourced("approx", "ongoing"),
      content: {
        ...sourced("approx", "ongoing").content,
        state: "approximate",
        precision: "Source uses an imprecise status",
      },
    },
    {
      id: "unmapped",
      content: {
        state: "unmapped",
        originalWording: "Source-specific status",
        provenance: entity(f, "later").basis.provenance,
      },
    },
  ];
  assert.deepEqual(parseCaseRecord(f.caseRecord).data, f.caseRecord);
});
negative(
  "rejects endpoints outside case scope",
  (f) => {
    entity(f, "later").toObservationId = "external";
  },
  "CASE.OBSERVATION_SCOPE",
);
negative(
  "rejects self relationships",
  (f) => {
    entity(f, "later").toObservationId = "capture-a";
  },
  "CASE.SELF_LINK",
);
negative(
  "rejects missing membership groups",
  (f) => {
    entity(f, "member-a").groupId = "absent";
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "rejects duplicate entity IDs within a kind",
  (f) => {
    f.caseRecord.entities.push(structuredClone(entity(f, "later")));
  },
  "REF.UNIQUE_ID",
);
negative(
  "rejects repeated investigation observation scope",
  (f) => {
    entity(f, "review-a").observationIds.push("capture-a");
  },
  "REF.UNIQUE_ID",
);
negative(
  "rejects assertion ID reuse across fields",
  (f) => {
    entity(f, "review-a").fields.caseNumber[0].id = "body";
  },
  "REF.UNIQUE_ID",
);
negative(
  "rejects a precedes/follows cycle",
  (f) => {
    f.caseRecord.entities.push({
      ...structuredClone(entity(f, "later")),
      id: "reverse",
      relation: "follows",
    });
  },
  "CASE.CHRONOLOGY_CYCLE",
);
negative(
  "rejects an indirect group cycle",
  (f) => {
    f.caseRecord.entities.push(
      { kind: "event_group", id: "wave", fields: {} },
      {
        kind: "membership",
        id: "nested",
        member: { kind: "event_group", id: "local-cluster" },
        groupId: "wave",
        basis: basis("Declared nesting"),
      },
      {
        kind: "membership",
        id: "cycle",
        member: { kind: "event_group", id: "wave" },
        groupId: "local-cluster",
        basis: basis("Conflicting nesting"),
      },
    );
  },
  "CASE.MEMBERSHIP_CYCLE",
);
negative(
  "rejects group self membership",
  (f) => {
    entity(f, "member-a").member = { kind: "event_group", id: "local-cluster" };
  },
  "CASE.MEMBERSHIP_CYCLE",
);
negative(
  "checks real calendar dates without normalizing unknown event time",
  (f) => {
    entity(f, "review-a").fields.investigationTime = [
      sourced("when", { kind: "date", value: "2026-02-30" }),
    ];
  },
  "STRUCT.VALUE",
);
negative(
  "rejects reversed source locators",
  (f) => {
    entity(f, "later").basis.provenance.locator = {
      kind: "time_range",
      startSeconds: 20,
      endSeconds: 1,
    };
  },
  "TIME.INTERVAL",
);
negative(
  "rejects citation observation scope substitution",
  (f) => {
    entity(f, "later").basis.provenance.observationId = "not-in-case";
  },
  "CASE.OBSERVATION_SCOPE",
);
negative(
  "does not resolve a source through another observation with the same source ID",
  (f) => {
    f.first.sources = [];
  },
  "CASE.SOURCE_SCOPE",
  true,
);
negative(
  "resolves source digest declarations without claiming artifact authenticity",
  (f) => {
    f.first.sources[0].digest = { algorithm: "sha256", value: "a".repeat(64) };
    entity(f, "later").basis.provenance.sourceDigest = {
      algorithm: "sha256",
      value: "b".repeat(64),
    };
  },
  "SOURCE.DIGEST_MISMATCH",
  true,
);
negative(
  "rejects method references outside the investigation",
  (f) => {
    entity(f, "review-a").observationIds = ["capture-b"];
  },
  "CASE.METHOD_SCOPE",
);
negative(
  "resolves a method within the pinned observation",
  (f) => {
    f.first.methods = [];
  },
  "CASE.METHOD_RESOLUTION",
  true,
);
test("rejects two snapshots for the same observation ID", () => {
  const f = fixture();
  f.caseRecord.observationRefs.push({
    ...f.caseRecord.observationRefs[0],
    sha256: "a".repeat(64),
  });
  assert.ok(
    parseCaseRecord(f.caseRecord).issues.some(
      (i) => i.code === "CASE.SNAPSHOT_UNIQUE",
    ),
  );
});
test("missing snapshots remain unavailable and chronology cannot be fully checked", async () => {
  const f = fixture(),
    supplied = documents(f);
  supplied.delete(f.caseRecord.observationRefs[1].sha256);
  const r = await evaluateCaseRecord(f.caseRecord, { documents: supplied });
  assert.equal(r.success, false);
  assert.equal(r.declaredChronology, "incomplete");
  assert.ok(r.snapshots.some((s) => s.status === "unavailable"));
  assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.UNAVAILABLE"));
});
test("digest, identity, invalid UTF-8 and invalid observation structure all fail closed", async () => {
  for (const [raw, code, updateHash] of [
    [bytes({ ...fixture().first, id: "wrong" }), "SNAPSHOT.DIGEST", false],
    [bytes({ ...fixture().first, id: "wrong" }), "SNAPSHOT.IDENTITY", true],
    [Buffer.from([0xff]), "SNAPSHOT.JSON", true],
    [
      bytes({ kind: "observation", id: "capture-a" }),
      "SNAPSHOT.CONTRACT",
      true,
    ],
  ]) {
    const f = fixture(),
      supplied = documents(f);
    if (updateHash) f.caseRecord.observationRefs[0].sha256 = digest(raw);
    supplied.set(f.caseRecord.observationRefs[0].sha256, raw);
    const r = await evaluateCaseRecord(f.caseRecord, { documents: supplied });
    assert.equal(r.success, false);
    assert.ok(
      r.issues.some((i) => i.code === code),
      JSON.stringify(r.issues),
    );
  }
});
test("only reads supplied snapshots, never source URLs, and copies buffers before awaiting", async () => {
  const f = fixture();
  f.first.sources[0].uri = "https://example.invalid/private-do-not-fetch";
  refresh(f);
  const supplied = documents(f);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Unexpected network access");
  };
  try {
    const pending = evaluateCaseRecord(f.caseRecord, { documents: supplied });
    for (const b of supplied.values()) b.fill(0);
    assert.equal((await pending).success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("large group graphs do not use recursive traversal", () => {
  const f = fixture();
  for (let i = 0; i < 2000; i++) {
    f.caseRecord.entities.push({
      kind: "event_group",
      id: `g-${i}`,
      fields: {},
    });
    if (i)
      f.caseRecord.entities.push({
        kind: "membership",
        id: `m-${i}`,
        member: { kind: "event_group", id: `g-${i - 1}` },
        groupId: `g-${i}`,
        basis: basis("Fictional nested group"),
      });
  }
  assert.equal(parseCaseRecord(f.caseRecord).success, true);
});
test("committed JSON Schema and examples reproduce exactly, and external JSON validators accept the contract", () => {
  const schema = caseRecordJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-records/schema/experimental/case-record-0.1.0.schema.json",
          import.meta.url,
        ),
      ),
    ),
    schema,
  );
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const f = fixture();
  assert.equal(validate(f.caseRecord), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(f.caseRecord);
  entity({ caseRecord: invalid }, "later").relation = "corroborates";
  assert.equal(validate(invalid), false);
  for (const [name, value] of Object.entries(f))
    assert.deepEqual(
      readFileSync(
        new URL(
          `../examples/v2/connected-case-demo/${name}.json`,
          import.meta.url,
        ),
      ),
      bytes(value),
    );
});
