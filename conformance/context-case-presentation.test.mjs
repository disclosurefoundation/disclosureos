import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildPublicContextCaseOutputs,
  parseContextCasePresentation,
  contextCasePresentationJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  bytes,
  digest,
  documents,
  approval,
} from "../examples/v2/context-case-demo/fixture.mjs";
const run = (f, extra = {}) =>
  buildPublicContextCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
    ...extra,
  });
test("selected fields, measurement and contextual review form one public record", async () => {
  const r = await run(fixture());
  assert.equal(r.success, true);
  assert.deepEqual(
    r.data.context.fields[1].assertions.map((a) => a.value),
    ["triangle", "oval"],
  );
  assert.deepEqual(r.data.context.fields[1].reviewIds, ["shape-review"]);
  assert.equal(r.data.context.measurements[0].value, 18.2);
  assert.equal(
    r.data.context.measurements[0].uncertainty,
    "Unknown (not reported)",
  );
  assert.match(r.data.context.measurements[0].method, /not supplied/);
  assert.equal(r.data.context.reviews[0].outcome, "inconclusive");
  assert.equal(r.data.context.tracks.length, 2);
  assert.deepEqual(JSON.parse(r.json), r.data);
  assert.match(r.markdown, /18/);
  assert.match(r.search.text, /triangle/);
});
for (const [name, mutate, code = "INVALID_REFERENCES"] of [
  [
    "wrong citation",
    (f) => {
      f.presentation.context.fields[1].assertions[0].citationIds = ["log"];
    },
  ],
  [
    "hidden review input",
    (f) => {
      f.presentation.context.fields[1].assertions.pop();
    },
  ],
  [
    "foreign context",
    (f) => {
      f.presentation.context.document.documentId = "other";
    },
  ],
  [
    "foreign history",
    (f) => {
      f.presentation.context.history.documentId = "other";
    },
  ],
  [
    "wrong reviewed field",
    (f) => {
      f.presentation.context.reviews[0].fieldId = "station";
    },
  ],
  [
    "wrong measurement quantity",
    (f) => {
      f.observation.measurements[0].quantity = "target_temperature";
      refresh(f);
    },
  ],
  [
    "wrong environment binding",
    (f) => {
      f.presentation.context.measurements[0].entityId = "object-A";
    },
  ],
  [
    "missing product",
    (f) => {
      f.presentation.context.tracks[0].productId = "missing";
    },
  ],
  [
    "duplicate assertion selection",
    (f) => {
      f.presentation.context.fields[1].assertions.push(
        f.presentation.context.fields[1].assertions[0],
      );
    },
    "INVALID_PRESENTATION",
  ],
  [
    "private selection property",
    (f) => {
      f.presentation.context.privateNotes = "PRIVATE_CANARY";
    },
    "INVALID_PRESENTATION",
  ],
  [
    "unsupported field",
    (f) => {
      f.presentation.context.fields[0].field = "privateLocation";
    },
    "INVALID_PRESENTATION",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    assert.deepEqual(await run(f), { success: false, code });
  });
test("missing or changed source bytes fail with no diagnostic data", async () => {
  const f = fixture();
  const docs = documents(f);
  docs.set(
    f.presentation.context.document.sha256,
    bytes({ privateNotes: "PRIVATE_CANARY" }),
  );
  assert.deepEqual(await run(f, { documents: docs }), {
    success: false,
    code: "INVALID_REFERENCES",
  });
  docs.delete(f.presentation.context.document.sha256);
  assert.equal((await run(f, { documents: docs })).success, false);
});
test("approval is separate and pins the complete envelope", async () => {
  const f = fixture();
  assert.equal(
    (await run(f, { approval: undefined })).code,
    "APPROVAL_REQUIRED",
  );
  const granted = approval(f);
  f.presentation.context.fields[0].label = "Changed";
  assert.equal((await run(f, { approval: granted })).code, "APPROVAL_REQUIRED");
});
for (const status of ["draft", "withdrawn"])
  test(`${status} does not publish`, async () => {
    const f = fixture();
    f.presentation.presentation.status = status;
    f.presentation.presentation.notices.push({
      id: "withdraw",
      kind: "withdrawal",
      text: "Removed.",
    });
    assert.equal((await run(f)).code, "NOT_PUBLISHED");
  });
test("selected values do not expose source URLs, private identity, unselected fields or extensions", async () => {
  const f = fixture();
  f.observation.sources.forEach((s) => {
    s.uri = "https://private.invalid/PRIVATE_CANARY";
  });
  f.observation.methods[0].uri = "https://private.invalid/PRIVATE_METHOD";
  f.context.recordedBy = "PRIVATE_CURATOR";
  f.history.claims[0].evaluatedBy = "PRIVATE_REVIEWER";
  f.observation.extensions = {
    "private.notes": { secret: "PRIVATE_EXTENSION" },
  };
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.doesNotMatch(
    JSON.stringify(r),
    /PRIVATE_|private\.invalid|observationRef|historyRef/,
  );
});
test("dependencies and approval cannot be mutated across the first await", async () => {
  const f = fixture(),
    docs = documents(f),
    granted = approval(f);
  const pending = buildPublicContextCaseOutputs(bytes(f.presentation), {
    documents: docs,
    approval: granted,
  });
  for (const b of docs.values()) b.fill(0);
  docs.clear();
  granted.presentationSha256 = "0".repeat(64);
  assert.equal((await pending).success, true);
});
test("historical reviews retain supersession rather than silently replacing selected review", async () => {
  const f = fixture();
  const later = structuredClone(f.history.claims[0]);
  later.id = "later";
  later.supersedes = ["claim:shape-review"];
  f.history.claims.push(later);
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.data.context.reviews[0].revision, "superseded");
});
test("schema identity and generated artifact agree with a validating JSON Schema", () => {
  const schema = contextCasePresentationJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/context-case-presentation-0.1.0.schema.json",
          import.meta.url,
        ),
      ),
    ),
    schema,
  );
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  assert.equal(ajv.compile(schema)(fixture().presentation), true);
  assert.equal(
    parseContextCasePresentation(fixture().presentation).success,
    true,
  );
});

test('unsupported precision and field decisions fail instead of losing their semantics', async () => {
  const f = fixture();
  const shape = f.context.entities.find(e => e.id === 'object-A');
  shape.fields.shape[0].content.state = 'approximate';
  shape.fields.shape[0].content.precision = 'Only a rough description';
  refresh(f);
  assert.equal((await run(f)).success, false);
  shape.fields.shape[0].content.state = 'known';
  delete shape.fields.shape[0].content.precision;
  shape.selections = [{ field: 'shape', assertionId: 'shape-1', consideredAssertionIds: ['shape-1','shape-2'], evaluatedBy: 'Synthetic reviewer', evaluatedAt: '2026-07-28T02:10:00Z', methodRef: 'method:review', methodVersion: '1', rationale: 'A fictional selection decision.' }];
  refresh(f);
  assert.equal((await run(f)).success, false);
});
test('known uncertainty retains numeric coverage and its supporting citation', async () => {
  const f = fixture();
  f.observation.measurements[0].value.uncertainty = { kind:'expanded', magnitude:0.3, unit:'Cel', coverageFactor:2, coverageProbability:0.95, sourceRefs:['source:log'] };
  refresh(f);
  const r = await run(f);
  assert.equal(r.success,true);
  assert.equal(r.data.context.measurements[0].uncertainty,'expanded: 0.3 Cel; coverage factor 2; coverage probability 0.95');
});
