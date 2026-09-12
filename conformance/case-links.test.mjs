import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  parseCaseLinks,
  caseLinksJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateCaseLinks } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  documents,
  bytes,
  digest,
  snapshot,
  contextSchema,
} from "../examples/v2/case-links-demo/fixture.mjs";
const link = (f, id) => f.links.links.find((l) => l.id === id);
const evaluate = (f) => evaluateCaseLinks(f.links, { documents: documents(f) });
function negative(name, edit, code, external = true) {
  test(name, async () => {
    const f = fixture();
    edit(f);
    const r = external ? await evaluate(f) : parseCaseLinks(f.links);
    assert.equal(r.success, false, JSON.stringify(r));
    assert.ok(
      r.issues.some((i) => i.code === code),
      JSON.stringify(r.issues),
    );
    if (external) assert.deepEqual(r.resolvedLinkIds, []);
  });
}
test("resolves context, entity fields and intake declarations without claiming authorization or full research validation", async () => {
  const f = fixture(),
    before = structuredClone(f),
    supplied = documents(f),
    original = structuredClone(supplied);
  const parsed = parseCaseLinks(f.links);
  assert.equal(parsed.success, true);
  assert.equal(parsed.checks.external, "not_checked");
  const r = await evaluateCaseLinks(f.links, { documents: supplied });
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.deepEqual(r.resolvedLinkIds, ["setting", "witness", "receipt"]);
  assert.equal(r.snapshots.length, 6);
  assert.ok(r.snapshots.every((s) => s.status === "passed"));
  assert.equal(r.supplementReferenceValidation, "not_checked");
  assert.equal(r.sourceArtifactIntegrity, "not_checked");
  assert.equal(r.authorization, "not_checked");
  assert.equal(r.scientificInterpretation, "not_checked");
  assert.equal(r.checks.profile, "not_checked");
  assert.equal(f.intake.access, "restricted");
  assert.deepEqual(f, before);
  assert.deepEqual(structuredClone(supplied), original);
});
test("supports each declared entity contract with its own parser", async () => {
  for (const v of ["0.1.0", "0.2.0", "0.3.0", "0.4.0"]) {
    const f = fixture();
    f.entities.schemaVersion = v;
    refresh(f);
    assert.equal((await evaluate(f)).success, true, v);
  }
});
test("whole supplements and an intake receipt may be associated without inventing a selected entity or artifact mapping", async () => {
  const f = fixture();
  delete link(f, "setting").reference.target;
  delete link(f, "witness").reference.target;
  delete link(f, "receipt").artifactLinks;
  assert.equal((await evaluate(f)).success, true);
});
test("link array order does not merge supplements or select a preferred account", async () => {
  const f = fixture();
  f.links.links.reverse();
  const r = await evaluate(f);
  assert.equal(r.success, true);
  assert.deepEqual([...r.resolvedLinkIds].sort(), [
    "receipt",
    "setting",
    "witness",
  ]);
});
negative(
  "rejects unknown document contracts",
  (f) => {
    link(f, "witness").reference.document.schemaId = "urn:unknown";
  },
  "STRUCT.VALUE",
  false,
);
negative(
  "rejects a laboratory target in a witness-only schema",
  (f) => {
    f.entities.schemaVersion = "0.1.0";
    refresh(f);
    link(f, "witness").reference.target = {
      kind: "laboratory_result",
      id: "result",
    };
  },
  "STRUCT.VALUE",
  false,
);
negative(
  "rejects arbitrary target fields",
  (f) => {
    link(f, "setting").reference.target.field = "invented";
  },
  "STRUCT.VALUE",
  false,
);
negative(
  "rejects duplicate link IDs",
  (f) => {
    f.links.links.push(structuredClone(f.links.links[0]));
  },
  "REF.UNIQUE_ID",
  false,
);
negative(
  "rejects duplicate artifact associations",
  (f) => {
    link(f, "receipt").artifactLinks.push(
      structuredClone(link(f, "receipt").artifactLinks[0]),
    );
  },
  "REF.UNIQUE_ID",
  false,
);
negative(
  "requires a sourced basis",
  (f) => {
    delete link(f, "witness").basis.provenance.attributedTo;
  },
  "STRUCT.VALUE",
  false,
);
negative(
  "checks locator ordering",
  (f) => {
    link(f, "setting").basis.provenance.locator = {
      kind: "time_range",
      startSeconds: 3,
      endSeconds: 1,
    };
  },
  "TIME.INTERVAL",
  false,
);
negative(
  "rejects private review fields",
  (f) => {
    f.links.internalNotes = "Keep outside public exchange";
  },
  "STRUCT.VALUE",
  false,
);
negative(
  "rejects link observation scope outside the case",
  (f) => {
    link(f, "witness").observationId = "outside";
  },
  "CASE.OBSERVATION_SCOPE",
);
negative(
  "rejects provenance scope outside the case",
  (f) => {
    link(f, "witness").basis.provenance.observationId = "outside";
  },
  "CASE.OBSERVATION_SCOPE",
);
negative(
  "does not resolve a source through another observation",
  (f) => {
    link(f, "witness").basis.provenance.sourceRef = "source:only-first";
    link(f, "witness").basis.provenance.observationId = "capture-b";
    f.first.sources.push({
      id: "only-first",
      kind: "document",
      access: "public",
    });
    refresh(f);
  },
  "CASE.SOURCE_SCOPE",
);
negative(
  "checks basis digest declarations",
  (f) => {
    link(f, "witness").basis.provenance.sourceDigest = {
      algorithm: "sha256",
      value: "f".repeat(64),
    };
  },
  "SOURCE.DIGEST_MISMATCH",
);
negative(
  "supplement observation IDs alone do not establish snapshot scope",
  (f) => {
    f.context.observationRef = {
      ...f.context.observationRef,
      sha256: "e".repeat(64),
    };
    link(f, "setting").reference.document = snapshot(f.context, contextSchema);
  },
  "CASE.SUPPLEMENT_SCOPE",
);
negative(
  "a supplement from another case observation cannot be silently rebound",
  (f) => {
    link(f, "witness").observationId = "capture-b";
  },
  "CASE.SUPPLEMENT_SCOPE",
);
negative(
  "checks entity kind as well as ID",
  (f) => {
    link(f, "witness").reference.target = { kind: "account", id: "witness-a" };
  },
  "CASE.ENTITY_RESOLUTION",
);
negative(
  "does not resolve fields that exist only in the schema",
  (f) => {
    link(f, "witness").reference.target.field = "description";
  },
  "CASE.FIELD_RESOLUTION",
);
negative(
  "runs local supplement semantic validation",
  (f) => {
    f.entities.entities.push(structuredClone(f.entities.entities[0]));
    refresh(f);
  },
  "SNAPSHOT.CONTRACT",
);
negative(
  "rejects wrong target IDs",
  (f) => {
    link(f, "setting").reference.target.id = "absent";
  },
  "CASE.ENTITY_RESOLUTION",
);
negative(
  "runs intake metadata semantic checks",
  (f) => {
    f.intake.artifacts.push(structuredClone(f.intake.artifacts[0]));
    refresh(f);
  },
  "INTAKE.DUPLICATE",
);
negative(
  "checks intake receipt timestamps",
  (f) => {
    f.intake.receivedAt = "not-a-time";
    refresh(f);
  },
  "INTAKE.TIME",
);
negative(
  "checks intake artifact identity",
  (f) => {
    link(f, "receipt").artifactLinks[0].artifactId = "missing";
  },
  "INTAKE.ARTIFACT_RESOLUTION",
);
negative(
  "checks observation inventory artifact identity",
  (f) => {
    link(f, "receipt").artifactLinks[0].observationRef = "product:absent";
  },
  "CASE.INPUT_RESOLUTION",
);
negative(
  "requires a digest for explicit inventory equivalence",
  (f) => {
    delete f.first.sources[0].digest;
    refresh(f);
  },
  "INTAKE.DIGEST_UNAVAILABLE",
);
negative(
  "does not treat different digests as the same artifact",
  (f) => {
    f.intake.artifacts[0].sha256 = "a".repeat(64);
    refresh(f);
  },
  "INTAKE.DIGEST_MISMATCH",
);
test("unknown receipt metadata does not become permission or a fabricated acquisition context", async () => {
  const f = fixture();
  f.intake.access = "unknown";
  f.intake.source.publisher = { state: "unknown", reason: "Not supplied" };
  refresh(f);
  const r = await evaluate(f);
  assert.equal(r.success, true);
  assert.equal(r.authorization, "not_checked");
  assert.equal(f.intake.artifacts[0].context.clock.state, "unknown");
});
test("unresolved internal supplement dependencies stay explicitly unchecked", async () => {
  const f = fixture();
  f.entities.contextRefs = [
    { ...snapshot(f.context, contextSchema), sha256: "e".repeat(64) },
  ];
  refresh(f);
  const r = await evaluate(f);
  assert.equal(r.success, true);
  assert.equal(r.supplementReferenceValidation, "not_checked");
  assert.equal(
    r.supplements.find((s) => s.linkId === "witness").referenceValidation,
    "not_checked",
  );
  assert.ok(
    r.supplements
      .find((s) => s.linkId === "witness")
      .uncheckedRefs.includes("e".repeat(64)),
  );
});
test("missing observations or linked documents fail binding completeness", async () => {
  for (const name of ["first", "context", "entities", "intake", "caseRecord"]) {
    const f = fixture(),
      supplied = documents(f);
    supplied.delete(digest(bytes(f[name])));
    const r = await evaluateCaseLinks(f.links, { documents: supplied });
    assert.equal(r.success, false, name);
    assert.ok(r.snapshots.some((s) => s.status === "unavailable"));
    assert.deepEqual(r.resolvedLinkIds, []);
  }
});
test("wrong bytes, invalid UTF-8, identity substitutions and contract mismatches fail closed", async () => {
  for (const mode of ["digest", "json", "identity", "contract"]) {
    const f = fixture(),
      supplied = documents(f),
      r = link(f, "setting").reference.document;
    const raw =
      mode === "json"
        ? Buffer.from([255])
        : mode === "identity"
          ? bytes({ ...f.context, id: "different" })
          : bytes({ id: f.context.id, kind: "other" });
    if (mode !== "digest") r.sha256 = digest(raw);
    supplied.set(r.sha256, raw);
    const result = await evaluateCaseLinks(f.links, { documents: supplied });
    assert.equal(result.success, false);
    assert.ok(
      result.issues.some(
        (i) =>
          i.code ===
          {
            digest: "SNAPSHOT.DIGEST",
            json: "SNAPSHOT.JSON",
            identity: "SNAPSHOT.IDENTITY",
            contract: "SNAPSHOT.CONTRACT",
          }[mode],
      ),
      JSON.stringify(result.issues),
    );
  }
});
test("case graph validation is required even when supplied hashes match", async () => {
  const f = fixture(),
    edge = f.caseRecord.entities.find((e) => e.kind === "relationship");
  f.caseRecord.entities.push({ ...edge, id: "reverse", relation: "follows" });
  refresh(f);
  const r = await evaluate(f);
  assert.equal(r.success, false);
  assert.ok(r.issues.some((i) => i.code === "SNAPSHOT.CONTRACT"));
});
test("does not fetch source URLs or inspect unrelated bytes; used buffers are copied before awaiting", async () => {
  const f = fixture(),
    supplied = documents(f),
    before = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Unexpected fetch");
  };
  supplied.set("unrelated", new Uint8Array([255]));
  try {
    const pending = evaluateCaseLinks(f.links, { documents: supplied });
    for (const value of supplied.values()) value.fill(0);
    assert.equal((await pending).success, true);
  } finally {
    globalThis.fetch = before;
  }
});
test("JSON Schema and committed fixtures reproduce exactly", () => {
  const schema = caseLinksJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-records/schema/experimental/case-links-0.1.0.schema.json",
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
  assert.equal(validate(f.links), true, JSON.stringify(validate.errors));
  const bad = structuredClone(f.links);
  bad.links[0].reference.target.field = "bad";
  assert.equal(validate(bad), false);
  for (const [name, value] of Object.entries(f))
    assert.deepEqual(
      readFileSync(
        new URL(`../examples/v2/case-links-demo/${name}.json`, import.meta.url),
      ),
      bytes(value),
    );
});
