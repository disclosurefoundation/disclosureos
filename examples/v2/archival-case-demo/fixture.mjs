import {
  fixture as archivalFixture,
  bundle,
  bytes,
  digest,
  snapshot,
  artifacts,
  entitiesSchema,
} from "../archival-editions-demo/fixture.mjs";
import { fixture as contextFixture } from "../context-case-demo/fixture.mjs";
export { bytes, digest };
export function refresh(f) {
  bundle(f);
  f.caseRecord.observationRefs = [
    snapshot(f.observation, "urn:disclosureos:experimental:observation:0.1.0"),
  ];
  f.presentation.presentation.caseRef = snapshot(
    f.caseRecord,
    "urn:disclosureos:experimental:case-record:0.1.0",
  );
  f.presentation.archival.document = snapshot(f.entities, entitiesSchema);
  f.presentation.archival.history = snapshot(
    f.history,
    "urn:disclosureos:experimental:claim-history:0.4.0",
  );
  return f;
}
export function fixture() {
  const f = archivalFixture();
  f.artifacts = new Map(
    Object.entries(artifacts).map(([file, value]) => [
      file,
      Buffer.from(value),
    ]),
  );
  f.caseRecord = contextFixture().caseRecord;
  f.caseRecord.id = "archival-editions-case";
  f.caseRecord.entities[0].fields.label[0].content.value =
    "Synthetic archive record";
  f.caseRecord.entities[1].member.id = f.observation.id;
  f.caseRecord.entities[1].basis.text =
    "The fictional archive groups two supplied editions of a document.";
  for (const p of [
    f.caseRecord.entities[0].fields.label[0].content.provenance,
    f.caseRecord.entities[1].basis.provenance,
  ]) {
    p.observationId = f.observation.id;
    p.sourceRef = "source:archive-log";
    p.attributedTo = "Synthetic archive";
  }
  const citations = [
    ["memo-a", "Release copy"],
    ["memo-b", "Second edition"],
    ["archive-log", "Archive log"],
  ];
  f.presentation = {
    kind: "archival_case_presentation",
    schemaVersion: "0.1.0",
    presentation: {
      kind: "case_presentation",
      schemaVersion: "0.1.0",
      publicId: "archival-editions-control",
      caseRef: {},
      title: "One title. Two distinct editions.",
      summary:
        "Follow a passage across two editions, inspect their release details and trace the declared custody of each file.",
      updatedAt: "2026-09-12T12:00:00Z",
      status: "published",
      citations: citations.map(([id, label]) => ({
        id,
        label,
        description:
          id === "archive-log"
            ? "Fictional archive log describing release and an unavailable original."
            : "Fictional text control with page breaks; it is not an archival scan or a PDF.",
        target: {
          kind: "artifact",
          observationId: f.observation.id,
          ref: `source:${id}`,
        },
      })),
      blocks: [
        {
          id: "record",
          heading: "Read the copy you are citing",
          text: "The release copy and second edition share the title Memo A. Their page counts, release details and digital custody declarations belong to the specific copy they describe.",
          citationIds: ["memo-a", "memo-b", "archive-log"],
        },
      ],
      findings: [],
      attachments: citations.map(([id, label]) => ({
        id,
        kind: "data",
        role: "supporting",
        observationId: f.observation.id,
        ref: `source:${id}`,
        sha256: digest(f.artifacts.get(`${id}.txt`)),
        caption: label,
        credit: "DisclosureOS synthetic example",
        rights: "Fictional text control for software testing.",
        citationIds: [id],
        mimeType: "text/plain",
        fileSizeBytes: f.artifacts.get(`${id}.txt`).length,
      })),
      notices: [
        {
          id: "synthetic",
          kind: "scope",
          text: "Fictional control, not a historical archive or ELDÆON data. These text files demonstrate edition and custody relationships; they do not establish authenticity.",
        },
      ],
    },
    archival: {
      document: {},
      history: {},
      editions: [
        {
          id: "release-copy",
          label: "Release copy",
          entityId: "edition-a",
          titleAssertionId: "title",
          pageCountAssertionId: "pages",
          attachmentId: "memo-a",
          citationIds: ["memo-a", "archive-log"],
          fields: [
            ["originalClassification", "original-marking"],
            ["classificationLevel", "current-marking"],
            ["redactionLevel", "redaction"],
            ["redactionDescription", "description"],
            ["redactionPercent", "extent"],
          ].map(([field, assertionId]) => ({ field, assertionId })),
          events: [
            {
              id: "release",
              entityId: "release-a",
              typeAssertionId: "type",
              dateAssertionId: "date",
              citationIds: ["archive-log"],
            },
            {
              id: "declassification",
              entityId: "declassification-a",
              typeAssertionId: "type",
              dateAssertionId: "date",
              citationIds: ["archive-log"],
            },
          ],
          digital: {
            entityId: "file-a",
            custodyStatusAssertionId: "custody",
            declaredHashesAssertionId: "old-hash",
            actions: [
              {
                id: "received",
                entityId: "receive-a",
                actionAssertionId: "action",
                dateAssertionId: "date",
                citationIds: ["archive-log"],
              },
              {
                id: "stored",
                entityId: "store-a",
                actionAssertionId: "action",
                dateAssertionId: "date",
                citationIds: ["archive-log"],
              },
            ],
          },
        },
        {
          id: "second-edition",
          label: "Second edition",
          entityId: "edition-b",
          titleAssertionId: "title",
          pageCountAssertionId: "pages",
          attachmentId: "memo-b",
          citationIds: ["memo-b", "archive-log"],
          fields: [],
          events: [],
          digital: { entityId: "file-b", actions: [] },
        },
      ],
      passages: [
        {
          id: "passage",
          claimId: "passage",
          attributionLabel: "Synthetic memo, as transcribed",
          citationIds: ["memo-a"],
        },
      ],
      review: {
        id: "edition-review",
        claimId: "edition-review",
        title: "A shared title does not establish equivalence",
        summary:
          "Different file bytes and pagination are declared. The review remains inconclusive about faithful reproduction and authenticity.",
        reviewerLabel: "Synthetic reviewer",
        methodLabel: "Comparison of supplied edition declarations",
        citationIds: ["memo-a", "memo-b", "archive-log"],
      },
    },
  };
  return refresh(f);
}
export const documents = (f) =>
  new Map(
    [f.observation, f.entities, f.history, f.caseRecord].map((v) => [
      digest(bytes(v)),
      bytes(v),
    ]),
  );
export const approval = (f) => ({
  presentationSha256: digest(bytes(f.presentation)),
  policyVersion: "fictional-archival-policy-1",
});
