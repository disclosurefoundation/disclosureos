import {
  fixture as contextFixture,
  bundle,
  bytes,
  digest,
  snapshot,
  contextSchema,
  observationSchema,
} from "../context-demo/fixture.mjs";
export { bytes, digest };
export function refresh(f) {
  bundle(f);
  f.caseRecord.observationRefs = [snapshot(f.observation, observationSchema)];
  f.presentation.presentation.caseRef = snapshot(
    f.caseRecord,
    "urn:disclosureos:experimental:case-record:0.1.0",
  );
  f.presentation.context.document = snapshot(f.context, contextSchema);
  f.presentation.context.history = snapshot(
    f.history,
    "urn:disclosureos:experimental:claim-history:0.2.0",
  );
  return f;
}
export function fixture() {
  const f = contextFixture();
  f.caseRecord = {
    kind: "case_record",
    schemaVersion: "0.1.0",
    id: "sensor-context-case",
    recordedAt: "2026-07-28T02:10:00Z",
    recordedBy: "Synthetic curator",
    observationRefs: [],
    entities: [
      {
        kind: "event_group",
        id: "station-group",
        fields: {
          label: [
            {
              id: "label",
              content: {
                state: "known",
                value: "Synthetic station record",
                provenance: {
                  observationId: "capture-A",
                  sourceRef: "source:log",
                  attributedTo: "Synthetic station recorder",
                  extractedBy: "Synthetic curator",
                },
              },
            },
          ],
        },
      },
      {
        kind: "membership",
        id: "member",
        member: { kind: "observation", id: "capture-A" },
        groupId: "station-group",
        basis: {
          text: "The synthetic log identifies the station record.",
          provenance: {
            observationId: "capture-A",
            sourceRef: "source:log",
            attributedTo: "Synthetic station recorder",
            extractedBy: "Synthetic curator",
          },
        },
      },
    ],
  };
  const sourceNames = [
    ["log", "Station log"],
    ["account-a", "Account A"],
    ["account-b", "Account B"],
    ["optical", "Optical control"],
    ["radio", "Radio control"],
  ];
  f.presentation = {
    kind: "context_case_presentation",
    schemaVersion: "0.1.0",
    presentation: {
      kind: "case_presentation",
      schemaVersion: "0.1.0",
      publicId: "sensor-context-control",
      caseRef: {},
      title: "A station record, in context",
      summary:
        "Two reported shapes, one ambient reading and separate optical and radio records. Follow what was supplied and how it was reviewed.",
      updatedAt: "2026-09-12T12:00:00Z",
      status: "published",
      citations: sourceNames.map(([id, label]) => ({
        id,
        label,
        description: f.artifacts.get(`${id}.txt`).toString().trim(),
        target: {
          kind: "artifact",
          observationId: "capture-A",
          ref: `${["optical", "radio"].includes(id) ? "product" : "source"}:${id}`,
        },
      })),
      blocks: [
        {
          id: "setting",
          heading: "At the station",
          text: "This fictional control records ambient temperature at station A. Two accounts describe different shapes. Neither description is selected as the established shape.",
          citationIds: ["log", "account-a", "account-b"],
        },
      ],
      findings: [],
      attachments: sourceNames.map(([id, label]) => ({
        id,
        kind: "data",
        role: "supporting",
        observationId: "capture-A",
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
          text: "Fictional control, not ELDÆON data. These text files are software-test inputs, not sensor telemetry or independent scientific findings.",
        },
      ],
    },
    context: {
      document: {},
      history: {},
      fields: [
        {
          id: "station",
          label: "Station",
          entityId: "place-A",
          field: "name",
          assertions: [
            {
              assertionId: "name",
              attributionLabel: "Station recorder",
              citationIds: ["log"],
            },
          ],
        },
        {
          id: "shape",
          label: "Reported shape",
          entityId: "object-A",
          field: "shape",
          assertions: [
            {
              assertionId: "shape-1",
              attributionLabel: "Account A",
              citationIds: ["account-a"],
            },
            {
              assertionId: "shape-2",
              attributionLabel: "Account B",
              citationIds: ["account-b"],
            },
          ],
        },
        {
          id: "alignment",
          label: "Alignment between sensors",
          entityId: "collection-A",
          field: "alignmentDescription",
          assertions: [
            {
              assertionId: "alignment",
              attributionLabel: "Not supplied",
              citationIds: ["log"],
            },
          ],
        },
      ],
      measurements: [
        {
          id: "ambient",
          label: "Ambient temperature",
          entityId: "weather-A",
          bindingId: "ambient-link",
          citationIds: ["log"],
        },
      ],
      tracks: [
        {
          id: "optical",
          label: "Optical record",
          collectionId: "collection-A",
          assertionId: "products",
          productId: "optical",
          citationIds: ["optical"],
        },
        {
          id: "radio",
          label: "Radio record",
          collectionId: "collection-A",
          assertionId: "products",
          productId: "radio",
          citationIds: ["radio"],
        },
      ],
      reviews: [
        {
          id: "shape-review",
          claimId: "shape-review",
          fieldId: "shape",
          title: "The shape remains unresolved",
          summary:
            "The two supplied accounts disagree. This review selects neither description as the established shape.",
          reviewerLabel: "Synthetic reviewer",
          methodLabel: "Comparison of source descriptions",
          citationIds: ["account-a", "account-b"],
        },
      ],
    },
  };
  return refresh(f);
}
export const documents = (f) =>
  new Map(
    [f.observation, f.context, f.acquisition, f.history, f.caseRecord].map(
      (v) => [digest(bytes(v)), bytes(v)],
    ),
  );
export const approval = (f) => ({
  presentationSha256: digest(bytes(f.presentation)),
  policyVersion: "fictional-context-policy-1",
});
