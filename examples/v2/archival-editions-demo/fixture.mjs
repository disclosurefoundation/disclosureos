import { createHash } from "node:crypto";
export const bytes = (value) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const entitiesSchema =
  "urn:disclosureos:experimental:research-entities:0.2.0";
const observationSchema = "urn:disclosureos:experimental:observation:0.1.0";
export const snapshot = (value, schemaId) => ({
  documentId: value.id,
  schemaId,
  sha256: digest(bytes(value)),
});
const time = "2026-09-11T12:00:00Z";
export const artifacts = {
  "memo-a.txt":
    "SYNTHETIC MEMO A / RELEASE COPY / SYN-17 / original marking SECRET\nPage 1\fPage 2: SYNTHETIC passage with redactions.\fPage 3: End.\n",
  "memo-b.txt":
    "SYNTHETIC MEMO A / SECOND EDITION\nPage 1\fPage 2: Different pagination.\fPage 3: SYNTHETIC passage with redactions.\fPage 4: End.\n",
  "archive-log.txt":
    "SYNTHETIC Archive A released Memo A on 2026-09-10. Declassification date unknown. Old original-file MD5 declaration: 00000000000000000000000000000000. Original file unavailable.\n",
};
export const sourced = (id, value, sourceRef = "source:archive-log") => [
  {
    id,
    content: {
      state: "known",
      value,
      provenance: {
        sourceRef,
        attributedTo: "Synthetic archive",
        extractedBy: "Synthetic curator",
        locator: { kind: "page", page: 1 },
      },
    },
  },
];
export const unknown = (id) => [
  { id, content: { state: "unknown", reason: "not_recorded" } },
];
/** All content is fictional. These text controls stand in for two described scans; no real archive or partner data. */
export function fixture() {
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "archival-control",
    status: "draft",
    createdAt: time,
    updatedAt: time,
    summary:
      "SYNTHETIC: two editions with separate pagination, an unknown declassification date and a digital custody gap.",
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_recorded" },
    sources: Object.entries(artifacts).map(([name, value]) => ({
      id: name.replace(".txt", ""),
      kind: "document",
      access: "public",
      title: name.startsWith("memo")
        ? "Synthetic Memo A"
        : "Synthetic archive log",
      digest: { algorithm: "sha256", value: digest(Buffer.from(value)) },
    })),
    products: [],
    methods: [
      {
        id: "review",
        version: "1.0",
        description:
          "Compare supplied edition declarations without deciding authenticity.",
      },
    ],
    frames: [],
    assertions: [],
    measurements: [],
    processing: [],
  };
  const artifact = (id) => ({
    sourceRef: `source:${id}`,
    digest: observation.sources.find((s) => s.id === id).digest,
  });
  const entities = {
    kind: "research_entities",
    schemaVersion: "0.2.0",
    id: "archival-entities",
    observationRef: snapshot(observation, observationSchema),
    contextRefs: [],
    recordedAt: time,
    recordedBy: "Synthetic curator",
    entities: [
      {
        kind: "source_edition",
        id: "edition-a",
        artifact: artifact("memo-a"),
        fields: {
          title: sourced("title", "Memo A"),
          documentType: sourced("type", "military_memo"),
          originatingAgency: sourced("agency", "Fictional Agency A"),
          controlNumbers: sourced("control", ["SYN-17"]),
          originalClassification: sourced("original-marking", "SECRET"),
          classificationLevel: unknown("current-marking"),
          pageCount: sourced("pages", 3),
          redactionLevel: sourced("redaction", "partial"),
          redactionDescription: sourced(
            "description",
            "Source describes redacted passages.",
          ),
          redactionPercent: unknown("extent"),
        },
      },
      {
        kind: "source_edition",
        id: "edition-b",
        artifact: artifact("memo-b"),
        fields: {
          title: sourced("title", "Memo A"),
          pageCount: sourced("pages", 4),
        },
      },
      {
        kind: "document_event",
        id: "release-a",
        editionId: "edition-a",
        fields: {
          eventType: sourced("type", "release"),
          occurredAt: sourced("date", { kind: "date", value: "2026-09-10" }),
          authority: sourced("authority", "Fictional Archive A"),
          reference: sourced("reference", "Synthetic release listing"),
        },
      },
      {
        kind: "document_event",
        id: "declassification-a",
        editionId: "edition-a",
        fields: {
          eventType: sourced("type", "declassification"),
          occurredAt: unknown("date"),
        },
      },
      {
        kind: "digital_artifact",
        id: "file-a",
        artifact: artifact("memo-a"),
        fields: {
          originalFilename: sourced("name", "memo-a.txt"),
          custodyStatus: sourced("custody", "partial"),
          declaredHashes: sourced("old-hash", [
            {
              hash: { algorithm: "md5", value: "0".repeat(32) },
              appliesTo: {
                kind: "unavailable_original",
                description:
                  "Original file named by the archive; bytes unavailable.",
              },
            },
          ]),
          metadataStripped: unknown("stripped"),
          metadataPreserved: unknown("preserved"),
        },
      },
      {
        kind: "digital_artifact",
        id: "file-b",
        artifact: artifact("memo-b"),
        fields: { originalFilename: sourced("name", "memo-b.txt") },
      },
      {
        kind: "digital_custody_action",
        id: "receive-a",
        artifactId: "file-a",
        predecessor: {
          kind: "unknown",
          reason: "Earlier digital custody was not supplied.",
        },
        fields: {
          action: sourced("action", "collection"),
          occurredAt: unknown("date"),
          from: unknown("from"),
          to: sourced("to", "Fictional Archive A"),
        },
      },
      {
        kind: "digital_custody_action",
        id: "store-a",
        artifactId: "file-a",
        predecessor: { kind: "action", id: "receive-a" },
        fields: {
          action: sourced("action", "storage"),
          occurredAt: unknown("date"),
          from: sourced("from", "Fictional Archive A"),
          to: sourced("to", "Fictional Repository A"),
        },
      },
      {
        kind: "external_identifier",
        id: "catalog-a",
        subject: { kind: "source_edition", editionId: "edition-a" },
        fields: {
          value: sourced("identifier", {
            system: "custom",
            systemName: "Fictional Archive",
            value: "SYN-17",
            url: "https://archive.example/memo-a",
          }),
          primaryDisplay: sourced("display", true),
        },
      },
      {
        kind: "identifier_check",
        id: "access-a",
        identifierId: "catalog-a",
        identifierAssertionId: "identifier",
        fields: {
          checkedAt: sourced("date", { kind: "date", value: "2026-09-10" }),
          agent: sourced("agent", "Fictional catalog checker"),
          method: sourced("method", "Recorded access check"),
          methodVersion: unknown("version"),
          outcome: sourced("result", { kind: "access", result: "accessible" }),
        },
      },
    ],
  };
  const reference = {
    document: snapshot(entities, entitiesSchema),
    target: { kind: "source_edition", id: "edition-a" },
  };
  const citation = (editionId, source, page) => ({
    document: reference.document,
    editionId,
    artifact: artifact(source),
    locator: { kind: "page", page },
  });
  const history = {
    kind: "claim_history",
    schemaVersion: "0.4.0",
    id: "archival-review",
    observation,
    contextRefs: [],
    entityRefs: [reference.document],
    claims: [
      {
        id: "passage",
        kind: "source_assertion",
        recordedAt: time,
        topic: "recorded_passage",
        subject: { kind: "entity", reference },
        text: "SYNTHETIC passage with redactions.",
        provenance: {
          sourceRef: "source:memo-a",
          sourceDigest: artifact("memo-a").digest,
          locator: { kind: "page", page: 2 },
          extractedBy: "Synthetic curator",
          attributedTo: "Synthetic memo",
        },
        editionCitation: citation("edition-a", "memo-a", 2),
      },
      {
        id: "edition-review",
        kind: "assessment",
        recordedAt: time,
        topic: "edition_relationship",
        subject: { kind: "entity", reference },
        inputRefs: ["source:archive-log"],
        editionInputRefs: [
          citation("edition-a", "memo-a", 2),
          citation("edition-b", "memo-b", 3),
        ],
        rationale:
          "Different bytes and pagination are declared. This does not establish faithful reproduction or authenticity.",
        status: "assessed",
        outcome: "inconclusive",
        evaluatedBy: "Synthetic reviewer",
        evaluatedAt: time,
        methodRef: "method:review",
        methodVersion: "1.0",
        artifactReview: {
          result: "inconclusive",
          findings:
            "Original-file MD5 is retained as a declaration, not verified against either edition.",
        },
      },
    ],
  };
  return { observation, entities, history };
}
export function bundle(f) {
  f.entities.observationRef = snapshot(f.observation, observationSchema);
  f.history.observation = f.observation;
  const ref = snapshot(f.entities, entitiesSchema);
  f.history.entityRefs = [ref];
  for (const claim of f.history.claims) {
    if (claim.subject.kind === "entity") claim.subject.reference.document = ref;
    for (const input of claim.entityInputRefs ?? []) input.document = ref;
    if (claim.editionCitation) claim.editionCitation.document = ref;
    for (const input of claim.editionInputRefs ?? []) input.document = ref;
  }
  return {
    history: f.history,
    options: {
      documents: new Map(
        [f.observation, f.entities].map((v) => [digest(bytes(v)), bytes(v)]),
      ),
    },
  };
}
