import { createHash } from "node:crypto";
export const bytes = (x) => Buffer.from(JSON.stringify(x, null, 2) + "\n");
export const digest = (x) => createHash("sha256").update(x).digest("hex");
export const sourced = (id, value) => [
  {
    id,
    content: {
      state: "known",
      value,
      provenance: {
        sourceRef: "source:handling-log",
        attributedTo: "Fictional collection team",
        extractedBy: "Fictional curator",
        locator: { kind: "page", page: 1 },
      },
    },
  },
];
export const unknown = (id) => [
  { id, content: { state: "unknown", reason: "not_recorded" } },
];
export function fixture() {
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "material-control",
    status: "draft",
    createdAt: "2026-09-11T00:00:00Z",
    updatedAt: "2026-09-11T00:00:00Z",
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_recorded" },
    sources: [
      {
        id: "handling-log",
        kind: "document",
        access: "public",
        title: "Fictional handling declarations",
      },
    ],
    products: [],
    methods: [],
    frames: [],
    assertions: [],
    measurements: [],
    processing: [],
  };
  const entities = {
    kind: "research_entities",
    schemaVersion: "0.3.0",
    id: "material-control-entities",
    observationRef: {
      documentId: observation.id,
      schemaId: "urn:disclosureos:experimental:observation:0.1.0",
      sha256: digest(bytes(observation)),
    },
    contextRefs: [],
    recordedAt: "2026-09-11T00:00:00Z",
    recordedBy: "Fictional curator",
    entities: [
      {
        kind: "material_trace",
        id: "trace",
        fields: {
          type: sourced("type", "impression"),
          description: sourced(
            "description",
            "SYNTHETIC surface impression; no specimen collected from the trace.",
          ),
          photographed: unknown("photo"),
        },
      },
      {
        kind: "material",
        id: "parent",
        lineage: { kind: "collected" },
        fields: {
          type: sourced("type", "soil_sample"),
          collectionTime: unknown("time"),
          collectorName: sourced("collector", "Fictional collector"),
          reportedQuality: unknown("quality"),
          reportedAnalyses: sourced("analyses", [
            "Spectroscopy reportedly performed; result not supplied.",
          ]),
          labReportAvailable: unknown("report"),
        },
      },
      {
        kind: "material",
        id: "aliquot-a",
        lineage: { kind: "derived", preparationId: "split" },
        fields: {
          description: sourced("description", "Fictional aliquot A"),
          reportedCustodyStatus: unknown("custody"),
        },
      },
      {
        kind: "material",
        id: "aliquot-b",
        lineage: { kind: "derived", preparationId: "split" },
        fields: { description: sourced("description", "Fictional aliquot B") },
      },
      {
        kind: "material_preparation",
        id: "split",
        operation: "split",
        inputMaterialIds: ["parent"],
        outputMaterialIds: ["aliquot-a", "aliquot-b"],
        fields: {
          method: sourced(
            "method",
            "SYNTHETIC division into two retained aliquots",
          ),
          performedAt: unknown("when"),
        },
      },
      {
        kind: "material_custody_action",
        id: "receive",
        materialId: "parent",
        predecessor: {
          kind: "unknown",
          reason: "Earlier physical handoffs were not recorded.",
        },
        fields: {
          action: sourced("action", "transfer"),
          to: sourced("to", "Fictional repository"),
          occurredAt: unknown("time"),
        },
      },
      {
        kind: "material_custody_action",
        id: "store",
        materialId: "parent",
        predecessor: { kind: "action", id: "receive" },
        fields: {
          action: sourced("action", "storage"),
          from: sourced("from", "Fictional repository"),
          to: sourced("to", "Fictional repository"),
          occurredAt: unknown("time"),
        },
      },
      {
        kind: "material_custody_action",
        id: "aliquot-receive",
        materialId: "aliquot-a",
        predecessor: {
          kind: "unknown",
          reason: "Custody after preparation was not supplied.",
        },
        fields: {
          action: sourced("action", "transfer"),
          occurredAt: unknown("time"),
        },
      },
    ],
  };
  return { observation, entities };
}
