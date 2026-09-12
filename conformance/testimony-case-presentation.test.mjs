import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildPublicTestimonyCaseOutputs,
  parseTestimonyCasePresentation,
  testimonyCasePresentationJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  bytes,
  digest,
  documents,
  approval,
} from "../examples/v2/testimony-case-demo/fixture.mjs";
const run = (f, extra = {}) =>
  buildPublicTestimonyCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
    ...extra,
  });
test("one pseudonym, two accounts, distinct date precision and a scoped qualification review", async () => {
  const r = await run(fixture());
  assert.equal(r.success, true);
  const t = r.data.testimony;
  assert.equal(t.witness.label, "Witness A");
  assert.equal(t.witness.experienceYears, 5);
  assert.equal(t.event.label, "Third quarter of 1952");
  assert.equal(t.event.precision, "quarter");
  assert.deepEqual(
    t.accounts.map((a) => a.recordedYear),
    ["1981", "1990"],
  );
  assert.deepEqual(
    t.accounts.map((a) => a.witnessId),
    ["witness", "witness"],
  );
  assert.equal(t.accounts[0].eventPeriod, t.event.label);
  assert.equal(t.accounts[1].eventPeriod, undefined);
  assert.equal(t.accounts[1].content, undefined);
  assert.match(t.accounts[1].contentNotice, /not included/);
  assert.equal(t.accounts[0].oath, "Unknown (not recorded)");
  assert.equal(t.review.outcome, "reported");
  assert.equal(t.review.independence, "Unknown");
  assert.deepEqual(r.data.attachments, []);
  assert.deepEqual(JSON.parse(r.json), r.data);
  assert.match(r.markdown, /1981/);
  assert.match(r.search.text, /Third quarter of 1952/);
});
for (const [name, mutate, code = "INVALID_REFERENCES"] of [
  [
    "wrong witness kind",
    (f) => {
      f.presentation.testimony.witness.entityId = "retelling";
    },
  ],
  [
    "wrong source citation",
    (f) => {
      f.presentation.testimony.accounts[0].citationIds = ["retelling"];
    },
  ],
  [
    "wrong event citation",
    (f) => {
      f.presentation.testimony.event.citationIds = ["retelling"];
    },
  ],
  [
    "foreign entity identity",
    (f) => {
      f.presentation.testimony.document.documentId = "foreign";
    },
  ],
  [
    "foreign history identity",
    (f) => {
      f.presentation.testimony.history.documentId = "foreign";
    },
  ],
  [
    "foreign context identity",
    (f) => {
      f.presentation.testimony.context.documentId = "foreign";
    },
  ],
  [
    "wrong qualification assertion",
    (f) => {
      f.presentation.testimony.witness.experienceAssertionId =
        "public-identity";
    },
  ],
  [
    "wrong reviewed subject",
    (f) => {
      f.history.claims[0].subject.reference.target.field = "publicIdentity";
      refresh(f);
    },
  ],
  [
    "hidden review input",
    (f) => {
      f.history.claims[0].entityInputRefs[0].assertionId = "category";
      refresh(f);
    },
  ],
  [
    "non-pseudonym identity",
    (f) => {
      f.entities.entities[0].fields.publicIdentity[0].content.value.kind =
        "public_name";
      refresh(f);
    },
  ],
  [
    "approximate experience",
    (f) => {
      const a = f.entities.entities[0].fields.experienceYears[0];
      a.content.state = "approximate";
      a.content.precision = "About five years";
      refresh(f);
    },
  ],
  [
    "multiple experience declarations",
    (f) => {
      const a = structuredClone(
        f.entities.entities[0].fields.experienceYears[0],
      );
      a.id = "other";
      a.content.value.value = 10;
      f.entities.entities[0].fields.experienceYears.push(a);
      refresh(f);
    },
  ],
  [
    "different date precision",
    (f) => {
      f.entities.entities[1].fields.recordedTime[0].content.value = {
        kind: "date",
        value: "1981-01-01",
      };
      refresh(f);
    },
  ],
  [
    "independence assertion",
    (f) => {
      f.history.claims[0].witnessReview.multipleIndependent = "yes";
      refresh(f);
    },
  ],
  [
    "duplicate account",
    (f) => {
      f.presentation.testimony.accounts.push(
        f.presentation.testimony.accounts[0],
      );
    },
    "INVALID_PRESENTATION",
  ],
  [
    "private selector",
    (f) => {
      f.presentation.testimony.privateNotes = "PRIVATE";
    },
    "INVALID_PRESENTATION",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    assert.deepEqual(await run(f), { success: false, code });
  });
test("full selection approval, draft and withdrawal remain enforced", async () => {
  const f = fixture();
  assert.equal(
    (await run(f, { approval: undefined })).code,
    "APPROVAL_REQUIRED",
  );
  const granted = approval(f);
  f.presentation.testimony.witness.citationIds = ["retelling"];
  assert.equal((await run(f, { approval: granted })).code, "APPROVAL_REQUIRED");
  for (const status of ["draft", "withdrawn"]) {
    const f = fixture();
    f.presentation.presentation.status = status;
    f.presentation.presentation.notices.push({
      id: "withdraw",
      kind: "withdrawal",
      text: "Removed",
    });
    assert.equal((await run(f)).code, "NOT_PUBLISHED");
  }
});
test("source bytes and selected case membership are exact", async () => {
  const f = fixture(),
    docs = documents(f);
  docs.set(
    f.presentation.testimony.document.sha256,
    bytes({ secret: "PRIVATE" }),
  );
  assert.deepEqual(await run(f, { documents: docs }), {
    success: false,
    code: "INVALID_REFERENCES",
  });
  docs.delete(f.presentation.testimony.document.sha256);
  assert.equal((await run(f, { documents: docs })).success, false);
  const other = fixture();
  other.caseRecord.observationRefs[0].sha256 = "0".repeat(64);
  other.presentation.presentation.caseRef.sha256 = digest(
    bytes(other.caseRecord),
  );
  assert.equal((await run(other)).success, false);
});
test("private identities, recorder names, notes, URIs and extensions do not enter any public output", async () => {
  const f = fixture();
  f.observation.sources.forEach((s) => {
    s.uri = "https://private.invalid/PRIVATE_SOURCE";
    s.title = "PRIVATE_TITLE";
  });
  f.observation.methods[0].description = "PRIVATE_METHOD";
  f.entities.recordedBy = "PRIVATE_CURATOR";
  for (const e of f.entities.entities)
    if (e.kind === "account")
      e.fields.recorder[0].content.value = "PRIVATE_RECORDER";
  f.history.claims[0].rationale = "PRIVATE_RATIONALE";
  f.history.claims[0].evaluatedBy = "PRIVATE_REVIEWER";
  f.history.claims[0].witnessReview.notes = "PRIVATE_NOTES";
  f.observation.extensions = {
    "private.secret": { identity: "PRIVATE_IDENTITY" },
  };
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.doesNotMatch(
    JSON.stringify(r),
    /PRIVATE_|private\.invalid|historyRef|observationRef|entityInputRefs/,
  );
});
test("caller mutations across the first await cannot change the selected output", async () => {
  const f = fixture(),
    docs = documents(f),
    granted = approval(f),
    input = bytes(f.presentation);
  const p = buildPublicTestimonyCaseOutputs(input, {
    documents: docs,
    approval: granted,
  });
  input.fill(0);
  for (const b of docs.values()) b.fill(0);
  docs.clear();
  granted.presentationSha256 = "0".repeat(64);
  assert.equal((await p).success, true);
});
test("superseded selected review retains its revision", async () => {
  const f = fixture(),
    later = structuredClone(f.history.claims[0]);
  later.id = "later";
  later.supersedes = ["claim:qualification-review"];
  f.history.claims.push(later);
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.data.testimony.review.revision, "superseded");
});
test("schema is exported, emitted and validates the bounded envelope", () => {
  const schema = testimonyCasePresentationJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/testimony-case-presentation-0.1.0.schema.json",
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
    parseTestimonyCasePresentation(fixture().presentation).success,
    true,
  );
});
