import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  fixture,
  sourced,
  unknown,
  bytes,
} from "../examples/v2/material-lineage-demo/fixture.mjs";
import { fixture as archivalFixture } from "../examples/v2/archival-editions-demo/fixture.mjs";
import {
  parseMaterialEntities,
  parseArchivalEntities,
  materialEntitiesJsonSchema,
  archivalEntitiesJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
const find = (f, id) => f.entities.entities.find((e) => e.id === id);
const negative = (name, change, code) =>
  test(name, () => {
    const f = fixture();
    change(f);
    const r = parseMaterialEntities(f.entities);
    assert.equal(r.success, false, JSON.stringify(r));
    assert.ok(
      r.issues.some((i) => i.code === code),
      JSON.stringify(r.issues),
    );
  });
test("retains uncollected trace, explicit custody gaps and separate derived specimens without altering input", () => {
  const f = fixture(),
    before = structuredClone(f);
  const r = parseMaterialEntities(f.entities);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(f, before);
  assert.deepEqual(r.checks, {
    structural: "passed",
    semantic: "passed",
    external: "not_checked",
    profile: "not_checked",
  });
  assert.ok(r.uncheckedRefs.includes("source:handling-log"));
  assert.equal(
    find(f, "parent").fields.collectionTime[0].content.state,
    "unknown",
  );
  assert.equal(find(f, "aliquot-a").fields.collectionTime, undefined);
  assert.equal(find(f, "aliquot-receive").predecessor.kind, "unknown");
  assert.equal(find(f, "trace").lineage, undefined);
});
test("order does not define lineage or custody chronology", () => {
  const f = fixture();
  f.entities.entities.reverse();
  assert.equal(parseMaterialEntities(f.entities).success, true);
});
test("a mixture produces a distinct specimen from multiple declared inputs", () => {
  const f = fixture();
  f.entities.entities.push(
    {
      kind: "material_preparation",
      id: "mix",
      operation: "mixture",
      inputMaterialIds: ["aliquot-a", "aliquot-b"],
      outputMaterialIds: ["mixture"],
      fields: {},
    },
    {
      kind: "material",
      id: "mixture",
      lineage: { kind: "derived", preparationId: "mix" },
      fields: {},
    },
  );
  const r = parseMaterialEntities(f.entities);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(find(f, "mixture").fields.collectionTime, undefined);
});
test("collection can explicitly name a trace without turning that trace into a specimen", () => {
  const f = fixture();
  find(f, "parent").lineage.traceId = "trace";
  assert.equal(parseMaterialEntities(f.entities).success, true);
  find(f, "parent").lineage.traceId = "aliquot-a";
  const r = parseMaterialEntities(f.entities);
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "REF.ENTITY"));
});
test("conflicting custody parties are retained without choosing a handoff", () => {
  const f = fixture();
  find(f, "store").fields.from.push(
    ...sourced("alternative", "Other repository"),
  );
  assert.equal(parseMaterialEntities(f.entities).success, true);
});
test("known false, unknown and contradictory source declarations remain distinct", () => {
  const f = fixture();
  find(f, "parent").fields.photographed = [
    ...sourced("yes", true),
    ...sourced("no", false),
    ...unknown("missing"),
  ];
  assert.equal(parseMaterialEntities(f.entities).success, true);
});
negative(
  "rejects missing physical input",
  (f) => (find(f, "split").inputMaterialIds = ["absent"]),
  "REF.ENTITY",
);
negative(
  "rejects an uncollected trace in place of a material",
  (f) => (find(f, "split").inputMaterialIds = ["trace"]),
  "REF.ENTITY",
);
negative(
  "rejects duplicate material identity",
  (f) => f.entities.entities.push(structuredClone(find(f, "parent"))),
  "REF.UNIQUE_ID",
);
negative(
  "rejects duplicate preparation input",
  (f) => find(f, "split").inputMaterialIds.push("parent"),
  "REF.UNIQUE_ID",
);
negative(
  "rejects a split without separate outputs",
  (f) => (find(f, "split").outputMaterialIds = ["aliquot-a"]),
  "MATERIAL.PREPARATION_ARITY",
);
negative(
  "rejects a mixture with only one input",
  (f) => (find(f, "split").operation = "mixture"),
  "MATERIAL.PREPARATION_ARITY",
);
negative(
  "rejects output/lineage disagreement",
  (f) =>
    (find(f, "aliquot-a").lineage = { kind: "unknown", reason: "Unresolved" }),
  "MATERIAL.PREPARATION_OUTPUT",
);
negative(
  "rejects missing preparation output membership",
  (f) => (find(f, "split").outputMaterialIds = ["aliquot-b"]),
  "MATERIAL.PREPARATION_OUTPUT",
);
negative(
  "rejects deriving a specimen from itself",
  (f) => (find(f, "split").inputMaterialIds = ["aliquot-a"]),
  "MATERIAL.SELF_DERIVATION",
);
negative(
  "rejects circular material lineage",
  (f) => {
    find(f, "parent").lineage = { kind: "derived", preparationId: "loop" };
    f.entities.entities.push({
      kind: "material_preparation",
      id: "loop",
      operation: "preparation",
      inputMaterialIds: ["aliquot-a"],
      outputMaterialIds: ["parent"],
      fields: {},
    });
  },
  "MATERIAL.LINEAGE_CYCLE",
);
negative(
  "rejects inheriting parent custody",
  (f) =>
    (find(f, "aliquot-receive").predecessor = { kind: "action", id: "store" }),
  "MATERIAL.CUSTODY_SCOPE",
);
negative(
  "rejects digital or missing custody predecessors",
  (f) => (find(f, "store").predecessor.id = "absent"),
  "REF.ENTITY",
);
negative(
  "rejects custody cycles",
  (f) => (find(f, "receive").predecessor = { kind: "action", id: "store" }),
  "MATERIAL.CUSTODY_CYCLE",
);
negative(
  "rejects unambiguous handoff mismatch",
  (f) => (find(f, "store").fields.from = sourced("from", "Another repository")),
  "MATERIAL.CUSTODY_HANDOFF",
);
negative(
  "rejects reversed comparable custody dates",
  (f) => {
    find(f, "receive").fields.occurredAt = sourced("date", {
      kind: "date",
      value: "2026-09-10",
    });
    find(f, "store").fields.occurredAt = sourced("date", {
      kind: "date",
      value: "2026-09-09",
    });
  },
  "MATERIAL.CUSTODY_ORDER",
);
negative(
  "rejects invalid collection calendar date",
  (f) =>
    (find(f, "parent").fields.collectionTime = sourced("date", {
      kind: "date",
      value: "2026-02-30",
    })),
  "STRUCT.VALUE",
);
negative(
  "requires provenance for known material declarations",
  (f) => delete find(f, "parent").fields.type[0].content.provenance,
  "STRUCT.VALUE",
);
negative(
  "does not label video as physical material",
  (f) => (find(f, "parent").fields.type = sourced("type", "video")),
  "STRUCT.VALUE",
);
negative(
  "rejects private intake properties",
  (f) => (f.entities.privateContact = "hidden"),
  "STRUCT.VALUE",
);
test("retains unmapped legacy descriptions without coercing them into specimens", () => {
  const f = fixture();
  find(f, "parent").fields.type = [
    {
      id: "legacy",
      content: {
        state: "unmapped",
        originalWording: "legacy mixed media label",
        provenance: sourced("x", "x")[0].content.provenance,
      },
    },
  ];
  assert.equal(parseMaterialEntities(f.entities).success, true);
});
test("published archival semantics and diagnostic indices remain active in the extended document", () => {
  const f = fixture(),
    a = archivalFixture();
  f.entities.entities.push(...a.entities.entities);
  const action = f.entities.entities.find(
    (e) => e.kind === "digital_custody_action",
  );
  action.predecessor = { kind: "action", id: "absent" };
  const r = parseMaterialEntities(f.entities);
  assert.equal(r.success, false);
  assert.ok(
    r.issues.some(
      (i) =>
        i.code === "REF.ENTITY" &&
        i.pointer.startsWith(
          `/entities/${f.entities.entities.indexOf(action)}/`,
        ),
    ),
  );
});
test("older parser does not silently accept the new document", () =>
  assert.equal(parseArchivalEntities(fixture().entities).success, false));
test("schema artifacts, example bytes and AJV agree with the candidate parser", () => {
  const schema = materialEntitiesJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-records/schema/experimental/research-entities-0.3.0.schema.json",
          import.meta.url,
        ),
      ),
    ),
    schema,
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-records/schema/experimental/research-entities-0.2.0.schema.json",
          import.meta.url,
        ),
      ),
    ),
    archivalEntitiesJsonSchema(),
  );
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(
    validate(fixture().entities),
    true,
    JSON.stringify(validate.errors),
  );
  const bad = fixture().entities;
  bad.extra = true;
  assert.equal(validate(bad), false);
  for (const [name, data] of Object.entries(fixture()))
    assert.deepEqual(
      readFileSync(
        new URL(
          `../examples/v2/material-lineage-demo/${name}.json`,
          import.meta.url,
        ),
      ),
      bytes(data),
    );
});

const selectionRef = {
  document: {
    documentId: "selection",
    schemaId: "urn:disclosureos:experimental:physical-sample-selection:0.1.0",
    sha256: "a".repeat(64),
  },
  sampleId: "parent",
};
test("links existing specimen and transfer identities without claiming snapshot verification", () => {
  const f = fixture();
  find(f, "parent").selectionRef = selectionRef;
  find(f, "store").transferRef = { ...selectionRef, transferId: "store" };
  const r = parseMaterialEntities(f.entities);
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.ok(r.uncheckedRefs.includes("a".repeat(64)));
  assert.equal(r.checks.external, "not_checked");
});
negative(
  "rejects a second identity for the selected specimen",
  (f) =>
    (find(f, "parent").selectionRef = { ...selectionRef, sampleId: "other" }),
  "MATERIAL.SELECTION_ID",
);
negative(
  "rejects an unbound selected transfer",
  (f) =>
    (find(f, "store").transferRef = { ...selectionRef, transferId: "store" }),
  "MATERIAL.SELECTION_SCOPE",
);
negative(
  "rejects transfer identity substitution",
  (f) => {
    find(f, "parent").selectionRef = selectionRef;
    find(f, "store").transferRef = { ...selectionRef, transferId: "other" };
  },
  "MATERIAL.TRANSFER_ID",
);
