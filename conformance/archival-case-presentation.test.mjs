import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildPublicArchivalCaseOutputs,
  parseArchivalCasePresentation,
  archivalCasePresentationJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import {
  fixture,
  refresh,
  bytes,
  digest,
  documents,
  approval,
} from "../examples/v2/archival-case-demo/fixture.mjs";
const run = (f, extra = {}) =>
  buildPublicArchivalCaseOutputs(bytes(f.presentation), {
    documents: documents(f),
    approval: approval(f),
    ...extra,
  });
test("same title retains distinct editions, pagination, events and explicit custody gap", async () => {
  const r = await run(fixture());
  assert.equal(r.success, true);
  const a = r.data.archival;
  assert.deepEqual(
    a.editions.map((e) => e.title),
    ["Memo A", "Memo A"],
  );
  assert.deepEqual(
    a.editions.map((e) => e.pages),
    [3, 4],
  );
  assert.notEqual(a.editions[0].digital.sha256, a.editions[1].digital.sha256);
  assert.equal(a.editions[0].events[0].value, "2026-09-10");
  assert.equal(a.editions[0].events[1].state, "unknown");
  assert.equal(
    a.editions[0].fields.find((f) => f.id === "redactionPercent").state,
    "unknown",
  );
  assert.deepEqual(
    a.editions[0].digital.actions.map((a) => a.predecessor),
    [{ kind: "unknown" }, { kind: "action", id: "received" }],
  );
  assert.equal(a.editions[0].digital.custodyStatus.value, "partial");
  assert.equal(a.editions[1].digital.custodyStatus, undefined);
  assert.equal(
    a.editions[0].digital.declaredHashes[0].scope,
    "unavailable_original",
  );
  assert.equal(a.passages[0].editionId, "release-copy");
  assert.equal(a.passages[0].page, 2);
  assert.deepEqual(a.review.inputs, [
    { editionId: "release-copy", page: 2 },
    { editionId: "second-edition", page: 3 },
  ]);
  assert.equal(a.review.outcome, "inconclusive");
  assert.deepEqual(JSON.parse(r.json), r.data);
  assert.match(r.markdown, /page 3/);
  assert.match(r.search.text, /unavailable original/);
  assert.equal(r.data.attachments.length, 3);
});
for (const [name, mutate, code = "INVALID_REFERENCES"] of [
  [
    "same title cannot substitute a different artifact",
    (f) => {
      f.presentation.archival.editions[0].digital.entityId = "file-b";
      f.presentation.archival.editions[1].digital.entityId = "file-a";
    },
  ],
  [
    "wrong attachment",
    (f) => {
      f.presentation.archival.editions[0].attachmentId = "memo-b";
    },
  ],
  [
    "wrong edition source citation",
    (f) => {
      f.presentation.archival.editions[0].citationIds = [
        "memo-b",
        "archive-log",
      ];
    },
  ],
  [
    "wrong passage citation",
    (f) => {
      f.presentation.archival.passages[0].citationIds = ["memo-b"];
    },
  ],
  [
    "missing review edition citation",
    (f) => {
      f.presentation.archival.review.citationIds = ["memo-a", "archive-log"];
    },
  ],
  [
    "hidden edition input",
    (f) => {
      f.presentation.archival.editions.pop();
    },
  ],
  [
    "wrong release edition",
    (f) => {
      f.presentation.archival.editions[1].events =
        f.presentation.archival.editions[0].events;
      f.presentation.archival.editions[0].events = [];
    },
  ],
  [
    "wrong custody artifact",
    (f) => {
      f.presentation.archival.editions[1].digital.actions =
        f.presentation.archival.editions[0].digital.actions;
      f.presentation.archival.editions[0].digital.actions = [];
    },
  ],
  [
    "hidden predecessor",
    (f) => {
      f.presentation.archival.editions[0].digital.actions.shift();
    },
  ],
  [
    "wrong page",
    (f) => {
      f.history.claims[1].editionInputRefs[0].locator.page = 4;
      refresh(f);
    },
  ],
  [
    "wrong passage edition",
    (f) => {
      f.history.claims[0].editionCitation.editionId = "edition-b";
      refresh(f);
    },
  ],
  [
    "foreign entity identity",
    (f) => {
      f.presentation.archival.document.documentId = "foreign";
    },
  ],
  [
    "foreign history identity",
    (f) => {
      f.presentation.archival.history.documentId = "foreign";
    },
  ],
  [
    "unsupported precision",
    (f) => {
      const a = f.entities.entities[0].fields.pageCount[0];
      a.content.state = "approximate";
      a.content.precision = "Approximate";
      refresh(f);
    },
  ],
  [
    "multiple page declarations",
    (f) => {
      const a = structuredClone(f.entities.entities[0].fields.pageCount[0]);
      a.id = "other";
      a.content.value = 9;
      f.entities.entities[0].fields.pageCount.push(a);
      refresh(f);
    },
  ],
  [
    "unsupported release precision",
    (f) => {
      f.entities.entities.find(
        (e) => e.id === "release-a",
      ).fields.occurredAt[0].content.value = { kind: "year", value: "2026" };
      refresh(f);
    },
  ],
  [
    "legacy hash bound to supplied edition",
    (f) => {
      const h = f.entities.entities.find((e) => e.id === "file-a").fields
        .declaredHashes[0].content.value[0];
      h.appliesTo = {
        kind: "artifact",
        reference: f.entities.entities[0].artifact,
      };
      refresh(f);
    },
  ],
  [
    "wrong review topic",
    (f) => {
      f.history.claims[1].topic = "unrelated";
      refresh(f);
    },
  ],
  [
    "source assertion selected as review",
    (f) => {
      f.presentation.archival.review.claimId = "passage";
    },
  ],
  [
    "duplicate edition",
    (f) => {
      f.presentation.archival.editions.push(
        f.presentation.archival.editions[0],
      );
    },
    "INVALID_PRESENTATION",
  ],
  [
    "private selector",
    (f) => {
      f.presentation.archival.privateNotes = "PRIVATE";
    },
    "INVALID_PRESENTATION",
  ],
])
  test(name, async () => {
    const f = fixture();
    mutate(f);
    assert.deepEqual(await run(f), { success: false, code });
  });
test("approval covers full envelope and draft/withdrawn outputs are unavailable", async () => {
  const f = fixture();
  assert.equal(
    (await run(f, { approval: undefined })).code,
    "APPROVAL_REQUIRED",
  );
  const a = approval(f);
  f.presentation.archival.editions[0].label = "Changed";
  assert.equal((await run(f, { approval: a })).code, "APPROVAL_REQUIRED");
  for (const status of ["draft", "withdrawn"]) {
    const f = fixture();
    f.presentation.presentation.status = status;
    f.presentation.presentation.notices.push({
      id: "removed",
      kind: "withdrawal",
      text: "Removed",
    });
    assert.equal((await run(f)).code, "NOT_PUBLISHED");
  }
});
test("altered or missing bytes and foreign case membership fail without diagnostics", async () => {
  const f = fixture(),
    docs = documents(f);
  docs.set(
    f.presentation.archival.document.sha256,
    bytes({ secret: "PRIVATE" }),
  );
  assert.deepEqual(await run(f, { documents: docs }), {
    success: false,
    code: "INVALID_REFERENCES",
  });
  docs.delete(f.presentation.archival.document.sha256);
  assert.equal((await run(f, { documents: docs })).success, false);
  f.caseRecord.observationRefs[0].sha256 = "0".repeat(64);
  f.presentation.presentation.caseRef.sha256 = digest(bytes(f.caseRecord));
  assert.equal((await run(f)).success, false);
});
test("private archive and custody details never enter any public output", async () => {
  const f = fixture();
  for (const s of f.observation.sources) {
    s.uri = "https://private.invalid/PRIVATE_SOURCE";
    s.title = "PRIVATE_TITLE";
  }
  f.entities.recordedBy = "PRIVATE_CURATOR";
  f.entities.entities.find((e) => e.id === "receive-a").predecessor.reason =
    "PRIVATE_GAP";
  f.entities.entities.find(
    (e) => e.id === "store-a",
  ).fields.to[0].content.value = "PRIVATE_RECIPIENT";
  f.entities.entities.find(
    (e) => e.id === "file-a",
  ).fields.originalFilename[0].content.value = "PRIVATE_FILENAME";
  f.entities.entities.find(
    (e) => e.id === "catalog-a",
  ).fields.value[0].content.value.url =
    "https://private.invalid/PRIVATE_CATALOG";
  f.history.claims[1].rationale = "PRIVATE_RATIONALE";
  f.history.claims[1].evaluatedBy = "PRIVATE_REVIEWER";
  f.history.claims[1].artifactReview.reportUrl =
    "https://private.invalid/PRIVATE_REPORT";
  f.history.claims[1].artifactReview.notes = "PRIVATE_REVIEW_NOTES";
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.doesNotMatch(
    JSON.stringify(r),
    /PRIVATE_|private\.invalid|observationRef|entityInputRefs|editionInputRefs/,
  );
});
test("custody uses links rather than array order", async () => {
  const f = fixture();
  f.entities.entities.reverse();
  f.presentation.archival.editions[0].digital.actions.reverse();
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.deepEqual(
    r.data.archival.editions[0].digital.actions.map((a) => a.id),
    ["received", "stored"],
  );
});
test("unknown custody and superseded reviews remain explicit", async () => {
  const f = fixture(),
    later = structuredClone(f.history.claims[1]);
  later.id = "later";
  later.supersedes = ["claim:edition-review"];
  f.history.claims.push(later);
  refresh(f);
  const r = await run(f);
  assert.equal(r.success, true);
  assert.equal(r.data.archival.review.revision, "superseded");
  assert.equal(
    r.data.archival.editions[0].digital.actions[0].occurredAt.state,
    "unknown",
  );
});
test("input, dependencies and approval are copied before the first await", async () => {
  const f = fixture(),
    docs = documents(f),
    a = approval(f),
    input = bytes(f.presentation);
  const pending = buildPublicArchivalCaseOutputs(input, {
    documents: docs,
    approval: a,
  });
  input.fill(0);
  for (const b of docs.values()) b.fill(0);
  docs.clear();
  a.presentationSha256 = "0".repeat(64);
  assert.equal((await pending).success, true);
});
test("schema artifact agrees and validates the selected envelope", () => {
  const schema = archivalCasePresentationJsonSchema();
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL(
          "../packages/disclosureos-schema/schema/experimental/archival-case-presentation-0.1.0.schema.json",
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
    parseArchivalCasePresentation(fixture().presentation).success,
    true,
  );
});
