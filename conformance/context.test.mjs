import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  fixture,
  bundle,
  bytes,
  digest,
  contextSchema,
} from "../examples/v2/context-demo/fixture.mjs";
import {
  parseObservationContext,
  parseContextClaimHistory,
  parseExperimentalClaimHistory,
  observationContextJsonSchema,
  contextClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
import { evaluateContextClaimHistory } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const run = (f) => {
  const b = bundle(f);
  return evaluateContextClaimHistory(b.history, b.options);
};
const find = (f, kind) => f.context.entities.find((e) => e.kind === kind);
const reject = (result, code) => {
  assert.equal(result.success, false, JSON.stringify(result));
  assert.ok(
    result.issues.some((i) => i.code === code),
    JSON.stringify(result.issues),
  );
};
const negative = (name, mutate, code) =>
  test(name, async () => {
    const f = fixture();
    mutate(f);
    reject(await run(f), code);
  });

test("complete sensor example preserves source conflicts, missingness and input objects", async () => {
  const f = fixture(),
    before = structuredClone(f),
    result = await run(f);
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.deepEqual(structuredClone(f), before);
  assert.deepEqual(result.checks, {
    structural: "passed",
    semantic: "passed",
    profile: "not_checked",
    external: "passed",
  });
  assert.equal(result.scientificInterpretation, "not_checked");
  assert.equal(result.multiSensorFusion, "not_checked");
  assert.equal(result.sourceArtifactIntegrity, "not_checked");
  assert.equal(find(f, "reported_object").fields.shape.length, 2);
  assert.equal(find(f, "reported_object").selections, undefined);
  assert.equal(
    find(f, "collection").fields.alignmentDescription[0].content.state,
    "unknown",
  );
});
test("version dispatch never strips new fields into the old history parser", async () => {
  const f = fixture();
  assert.equal(parseContextClaimHistory(f.history).success, true);
  assert.equal(parseExperimentalClaimHistory(f.history).success, false);
  const legacy = JSON.parse(
    readFileSync(new URL("../examples/v2/claim-history.json", import.meta.url)),
  );
  assert.equal(parseExperimentalClaimHistory(legacy).success, true);
  assert.equal(parseContextClaimHistory(legacy).success, false);
  assert.equal(
    parseContextClaimHistory({
      ...legacy,
      schemaVersion: "0.2.0",
      contextRefs: [],
    }).success,
    true,
  );
});
test("parsing alone leaves external references unchecked", async () => {
  const f = fixture();
  assert.equal(
    parseObservationContext(f.context).checks.external,
    "not_checked",
  );
  assert.equal(
    parseContextClaimHistory(f.history).checks.external,
    "not_checked",
  );
});
test("missing snapshot bytes cannot pass", async () => {
  const b = bundle(fixture());
  b.options.documents.delete(b.history.contextRefs[0].sha256);
  const r = await evaluateContextClaimHistory(b.history, b.options);
  reject(r, "SNAPSHOT.UNAVAILABLE");
  assert.equal(r.checks.external, "not_checked");
});
test("altered bytes under a declared hash fail integrity", async () => {
  const b = bundle(fixture());
  b.options.documents.set(b.history.contextRefs[0].sha256, Buffer.from("{}"));
  const r = await evaluateContextClaimHistory(b.history, b.options);
  reject(r, "SNAPSHOT.DIGEST");
  assert.equal(r.checks.external, "failed");
});
test("a correctly hashed non-JSON snapshot still fails", async () => {
  const b = bundle(fixture()),
    data = Buffer.from("not json"),
    hash = digest(data);
  b.history.contextRefs[0].sha256 = hash;
  b.options.documents.set(hash, data);
  reject(
    await evaluateContextClaimHistory(b.history, b.options),
    "SNAPSHOT.JSON",
  );
});
test("same observation ID with different contents fails scope", async () => {
  const b = bundle(fixture());
  b.history.observation = structuredClone(b.history.observation);
  b.history.observation.summary = "Different revision";
  reject(
    await evaluateContextClaimHistory(b.history, b.options),
    "CONTEXT.OBSERVATION_SCOPE",
  );
});
test("object key serialization order does not change parsed scope equality", async () => {
  const b = bundle(fixture());
  b.history.observation = Object.fromEntries(
    Object.entries(b.history.observation).reverse(),
  );
  assert.equal(
    (await evaluateContextClaimHistory(b.history, b.options)).success,
    true,
  );
});
test("snapshot document ID must match bytes", async () => {
  const b = bundle(fixture());
  b.history.contextRefs[0].documentId = "wrong";
  reject(
    await evaluateContextClaimHistory(b.history, b.options),
    "SNAPSHOT.IDENTITY",
  );
});
negative(
  "unrecognized descriptive term cannot become a shared shape",
  (f) =>
    (find(f, "reported_object").fields.shape[0].content.value =
      "new-unknown-shape"),
  "STRUCT.VALUE",
);
negative(
  "unknown values cannot acquire a numeric zero",
  (f) => {
    find(f, "reported_object").fields.sizeDescription[0].content.value = 0;
  },
  "STRUCT.VALUE",
);
test("unmapped wording is retained explicitly", async () => {
  const f = fixture();
  find(f, "reported_object").fields.shape[0].content = {
    state: "unmapped",
    originalWording: "unfamiliar source term",
    provenance: { sourceRef: "source:account-a" },
  };
  assert.equal((await run(f)).success, true);
});
negative(
  "duplicate entity IDs fail within a kind",
  (f) => f.context.entities.push(structuredClone(find(f, "reported_object"))),
  "REF.UNIQUE_ID",
);
negative(
  "duplicate assertion IDs across fields fail",
  (f) => (find(f, "reported_object").fields.sizeDescription[0].id = "shape-1"),
  "REF.UNIQUE_ID",
);
negative(
  "wrong entity kind does not resolve by matching ID alone",
  (f) => {
    f.history.claims[0].subject.reference.target = {
      kind: "place",
      id: "object-A",
    };
  },
  "REF.ENTITY",
);
negative(
  "field reference must exist on its entity",
  (f) => {
    f.history.claims[0].subject.reference.target.field = "sound";
  },
  "REF.FIELD",
);
negative(
  "assessment input must resolve its assertion on the named field",
  (f) => {
    f.history.claims[0].contextInputRefs[0].assertionId = "absent";
  },
  "REF.ASSERTION",
);
negative(
  "assessment input cannot omit field",
  (f) => {
    delete f.history.claims[0].contextInputRefs[0].target.field;
  },
  "REF.ASSERTION",
);
negative(
  "unknown source reference fails",
  (f) => {
    find(f, "reported_object").fields.shape[0].content.provenance.sourceRef =
      "source:missing";
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "source digest disagreement fails without claiming byte verification",
  (f) => {
    find(f, "reported_object").fields.shape[0].content.provenance.sourceDigest =
      { algorithm: "sha256", value: "0".repeat(64) };
  },
  "SOURCE.DIGEST_MISMATCH",
);
negative(
  "reversed source locator fails",
  (f) => {
    find(f, "reported_object").fields.shape[0].content.provenance.locator = {
      kind: "time_range",
      startSeconds: 10,
      endSeconds: 2,
    };
  },
  "TIME.INTERVAL",
);
negative(
  "measurement must belong to the scoped observation",
  (f) => {
    find(f, "environment").measurements[0].measurementId = "foreign";
  },
  "REF.MEASUREMENT",
);
negative(
  "target temperature cannot silently become ambient",
  (f) => {
    f.observation.measurements[0].quantity = "target_temperature";
  },
  "CONTEXT.MEASUREMENT_ROLE",
);
negative(
  "wrong temperature units fail",
  (f) => {
    f.observation.measurements[0].value.unit = "m";
  },
  "CONTEXT.MEASUREMENT_ROLE",
);
negative(
  "ambient association cannot move to reported object",
  (f) => {
    find(f, "reported_object").measurements = find(
      f,
      "environment",
    ).measurements;
    delete find(f, "environment").measurements;
  },
  "CONTEXT.MEASUREMENT_ROLE",
);
negative(
  "missing station place fails local resolution",
  (f) => {
    find(f, "environment").fields.placeId[0].content.value = "absent";
  },
  "REF.LOCAL_RESOLUTION",
);
negative(
  "relative dates cannot reference themselves",
  (f) => {
    find(f, "temporal").fields.relativeDate = [
      {
        id: "rel",
        content: {
          state: "known",
          value: {
            anchorTemporalId: "time-A",
            relation: "before",
            wording: "before",
          },
          provenance: { sourceRef: "source:log" },
        },
      },
    ];
  },
  "TIME.RELATIVE_CYCLE",
);
negative(
  "invalid historical period fails",
  (f) => {
    find(f, "temporal").fields.calendarPeriod = [
      {
        id: "period",
        content: {
          state: "known",
          value: { kind: "decade", startYear: 1950, endYear: 1980 },
          provenance: { sourceRef: "source:log" },
        },
      },
    ];
  },
  "TIME.CALENDAR_PERIOD",
);
test("quarter remains a quarter without a fabricated date", async () => {
  const f = fixture();
  find(f, "temporal").fields.calendarPeriod = [
    {
      id: "quarter",
      content: {
        state: "known",
        value: { kind: "quarter", year: 1952, quarter: 3 },
        provenance: { sourceRef: "source:log" },
      },
    },
  ];
  assert.equal((await run(f)).success, true);
  assert.deepEqual(find(f, "temporal").fields.calendarPeriod[0].content.value, {
    kind: "quarter",
    year: 1952,
    quarter: 3,
  });
});
negative(
  "timezone cannot be invented",
  (f) => {
    find(f, "temporal").fields.localTime = [
      {
        id: "clock",
        content: {
          state: "known",
          value: { clock: "12:00", timezone: "made/up" },
          provenance: { sourceRef: "source:log" },
        },
      },
    ];
  },
  "TIME.TIMEZONE",
);
negative(
  "acquisition IDs require the correct supplied inventory",
  (f) => {
    find(f, "collection").fields.acquisitionIds[0].content.value = ["foreign"];
  },
  "REF.ACQUISITION",
);
negative(
  "position frame must be declared",
  (f) => {
    find(f, "place").fields.position = [
      {
        id: "coords",
        content: {
          state: "known",
          value: {
            kind: "geodetic",
            frameRef: "frame:foreign",
            latitude: 0,
            longitude: 0,
          },
          provenance: { sourceRef: "source:log" },
        },
      },
    ];
  },
  "CONTEXT.POSITION",
);
const selection = {
  field: "shape",
  assertionId: "shape-1",
  consideredAssertionIds: ["shape-1", "shape-2"],
  evaluatedBy: "Synthetic reviewer",
  evaluatedAt: "2026-07-28T02:10:00Z",
  methodRef: "method:review",
  methodVersion: "1",
  rationale: "Explicit selection for a test, not scientific approval.",
};
test("explicit selection points to an assertion without copying its value", async () => {
  const f = fixture();
  find(f, "reported_object").selections = [structuredClone(selection)];
  assert.equal((await run(f)).success, true);
  assert.equal(find(f, "reported_object").fields.shape.length, 2);
});
negative(
  "selection cannot omit selected input",
  (f) => {
    find(f, "reported_object").selections = [
      { ...selection, consideredAssertionIds: ["shape-2"] },
    ];
  },
  "SELECTION.INPUTS",
);
negative(
  "selection cannot cross fields",
  (f) => {
    find(f, "reported_object").selections = [
      { ...selection, consideredAssertionIds: ["shape-1", "size"] },
    ];
  },
  "REF.FIELD_MISMATCH",
);
negative(
  "selection method version must resolve",
  (f) => {
    find(f, "reported_object").selections = [
      { ...selection, methodVersion: "2" },
    ];
  },
  "METHOD.VERSION_MISMATCH",
);
negative(
  "selection evaluation cannot follow recording",
  (f) => {
    find(f, "reported_object").selections = [
      { ...selection, evaluatedAt: "2026-08-01T00:00:00Z" },
    ];
  },
  "SELECTION.ORDER",
);
negative(
  "supersession preserves entity and field",
  (f) => {
    const c = structuredClone(f.history.claims[0]);
    c.id = "revision";
    c.subject.reference.target.field = "sizeDescription";
    c.supersedes = ["claim:shape-review"];
    f.history.claims.push(c);
  },
  "CLAIM.SUPERSESSION_SCOPE",
);
negative(
  "another evaluator cannot overwrite a prior assessment",
  (f) => {
    const c = structuredClone(f.history.claims[0]);
    c.id = "revision";
    c.evaluatedBy = "Different reviewer";
    c.supersedes = ["claim:shape-review"];
    f.history.claims.push(c);
  },
  "CLAIM.REVISION_ATTRIBUTION",
);
negative(
  "claim input cycles fail",
  (f) => {
    f.history.claims[0].inputRefs.push("claim:shape-review");
  },
  "CLAIM.DEPENDENCY_CYCLE",
);
test("different context revisions are different claim subjects", async () => {
  const f = fixture(),
    c = structuredClone(f.history.claims[0]);
  c.id = "new";
  c.supersedes = ["claim:shape-review"];
  c.subject.reference.document.sha256 = "0".repeat(64);
  f.history.contextRefs.push(c.subject.reference.document);
  f.history.claims.push(c);
  reject(parseContextClaimHistory(f.history), "CLAIM.SUPERSESSION_SCOPE");
});
test("new JSON schemas match emitted files and reject structural invalid inputs", async () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  for (const [name, schema, valid, invalid] of [
    [
      "observation-context-0.1.0",
      observationContextJsonSchema(),
      fixture().context,
      { ...fixture().context, extra: true },
    ],
    [
      "claim-history-0.2.0",
      contextClaimHistoryJsonSchema(),
      fixture().history,
      { ...fixture().history, schemaVersion: "0.1.0" },
    ],
  ]) {
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
    const validate = ajv.compile(schema);
    assert.equal(validate(valid), true, JSON.stringify(validate.errors));
    assert.equal(validate(invalid), false);
  }
});
test("canonical source artifacts and runnable snapshot files are reproducible", async () => {
  const f = fixture();
  for (const name of ["observation", "context", "acquisition", "history"])
    assert.deepEqual(
      readFileSync(
        new URL(`../examples/v2/context-demo/${name}.json`, import.meta.url),
      ),
      bytes(f[name]),
    );
  const output = JSON.parse(
    execFileSync(
      process.execPath,
      [
        new URL("../examples/v2/context-demo/run.mjs", import.meta.url)
          .pathname,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(output.success, true);
});

test("omitted optional fields in JavaScript cannot crash the parser", async () => {
  const f = fixture();
  find(f, "reported_object").fields.sound = undefined;
  assert.equal(parseObservationContext(f.context).success, true);
});
test("context subjects must be declared snapshots", async () => {
  const f = fixture();
  f.history.contextRefs = [];
  reject(parseContextClaimHistory(f.history), "REF.LOCAL_RESOLUTION");
});
test("empty context selection performs no external checks", async () => {
  const f = fixture();
  f.history.contextRefs = [];
  f.history.claims = [];
  const r = await evaluateContextClaimHistory(f.history, {
    documents: new Map(),
  });
  assert.equal(r.success, true);
  assert.equal(r.checks.external, "not_checked");
});
test("retention and sensitivity retain the baseline meanings", async () => {
  const f = fixture();
  find(f, "collection").fields.retentionStatus = [
    {
      id: "retention",
      content: {
        state: "known",
        value: "archived",
        provenance: { sourceRef: "source:log" },
      },
    },
  ];
  find(f, "place").fields.infrastructureSensitivity = [
    {
      id: "sensitivity",
      content: {
        state: "known",
        value: "critical",
        provenance: { sourceRef: "source:log" },
      },
    },
  ];
  assert.equal((await run(f)).success, true);
});
const historyCorpus = JSON.parse(
  readFileSync(new URL("./v2-claim-history-fixtures.json", import.meta.url)),
);
for (const sample of historyCorpus.cases)
  test(`retained claim semantics: ${sample.id}`, () => {
    const input = structuredClone(historyCorpus.bases[sample.base]);
    for (const change of sample.changes) {
      let target = input;
      for (const key of change.path.slice(0, -1)) target = target[key];
      const key = change.path.at(-1);
      if (change.op === "remove") delete target[key];
      else if (change.op === "append")
        target[key].push(structuredClone(change.value));
      else
        Object.defineProperty(target, key, {
          value: structuredClone(change.value),
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    const previous = parseExperimentalClaimHistory(input);
    const next = parseContextClaimHistory({
      ...input,
      schemaVersion:
        input.schemaVersion === "0.1.0" ? "0.2.0" : input.schemaVersion,
      contextRefs: [],
    });
    assert.equal(next.success, previous.success);
    assert.deepEqual(next.checks, previous.checks);
    assert.deepEqual(
      [...new Set(next.issues.map((i) => i.code))].sort(),
      [...new Set(previous.issues.map((i) => i.code))].sort(),
    );
    if (next.success)
      assert.deepEqual(next.currentClaimRefs, previous.currentClaimRefs);
  });

test("structurally invalid referenced documents fail the structural stage", async () => {
  const f = fixture();
  f.context.extra = true;
  const r = await run(f);
  assert.equal(r.checks.structural, "failed");
  assert.equal(r.checks.semantic, "not_checked");
  assert.equal(r.success, false);
});
