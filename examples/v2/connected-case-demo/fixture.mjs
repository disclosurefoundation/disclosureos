import { createHash } from "node:crypto";
export const bytes = (value) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const snapshot = (value) => ({
  documentId: value.id,
  schemaId: "urn:disclosureos:experimental:observation:0.1.0",
  sha256: digest(bytes(value)),
});
export const provenance = (observationId = "capture-a") => ({
  observationId,
  sourceRef: "source:log",
  attributedTo: "Fictional station recorder",
  extractedBy: "Fictional case assembler",
  locator: { kind: "page", page: 1 },
});
export const sourced = (id, value, observationId = "capture-a") => ({
  id,
  content: { state: "known", value, provenance: provenance(observationId) },
});
export const basis = (text) => ({ text, provenance: provenance() });
export function refresh(f) {
  f.caseRecord.observationRefs = [snapshot(f.first), snapshot(f.second)];
  return f;
}
export const documents = (f) =>
  new Map([f.first, f.second].map((o) => [digest(bytes(o)), bytes(o)]));
/** Entirely fictional. Chronological declarations do not imply repeated observation of the same object. */
export function fixture() {
  const time = "2026-09-11T00:00:00Z";
  const first = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "capture-a",
    status: "draft",
    createdAt: time,
    updatedAt: time,
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_recorded" },
    sources: [
      {
        id: "log",
        kind: "document",
        access: "public",
        title: "Fictional first station log; bytes not supplied",
      },
    ],
    products: [],
    methods: [
      {
        id: "interviews",
        version: "1",
        description: "Fictional interview protocol",
      },
    ],
    frames: [],
    assertions: [],
    measurements: [],
    processing: [],
  };
  const second = structuredClone(first);
  second.id = "capture-b";
  second.sources[0].title = "Fictional second station log; bytes not supplied";
  const caseRecord = {
    kind: "case_record",
    schemaVersion: "0.1.0",
    id: "connected-control",
    recordedAt: time,
    recordedBy: "Fictional case assembler",
    observationRefs: [],
    entities: [
      {
        kind: "event_group",
        id: "local-cluster",
        fields: {
          label: [sourced("name", "Fictional station cluster")],
          groupType: [sourced("type", "cluster")],
        },
      },
      {
        kind: "membership",
        id: "member-a",
        member: { kind: "observation", id: "capture-a" },
        groupId: "local-cluster",
        basis: basis(
          "The source groups the first capture with this station's records.",
        ),
      },
      {
        kind: "membership",
        id: "member-b",
        member: { kind: "observation", id: "capture-b" },
        groupId: "local-cluster",
        basis: basis(
          "The source groups the later capture with this station's records.",
        ),
      },
      {
        kind: "relationship",
        id: "later",
        fromObservationId: "capture-a",
        toObservationId: "capture-b",
        relation: "precedes",
        basis: basis(
          "The station log describes capture B as later; exact event times were not supplied.",
        ),
      },
      {
        kind: "investigation",
        id: "review-a",
        observationIds: ["capture-a", "capture-b"],
        fields: {
          investigatingBody: [sourced("body", "Fictional investigation group")],
          caseNumber: [sourced("number", "DEMO-1")],
          investigationTime: [
            {
              id: "when",
              content: { state: "unknown", reason: "not_recorded" },
            },
          ],
          reportedMethods: [
            sourced("methods", ["Interviews reportedly performed"]),
          ],
          methodReferences: [
            sourced("protocol", [
              { observationId: "capture-a", methodId: "interviews" },
            ]),
          ],
          reportedFindings: [
            sourced(
              "finding",
              "The report does not establish a common object.",
            ),
          ],
          reportedConclusion: [
            sourced("conclusion-a", "Unresolved"),
            sourced(
              "conclusion-b",
              "A second account offers a conventional explanation.",
              "capture-b",
            ),
          ],
          reportedRecommendations: [
            sourced("recommendation", "Seek underlying recordings."),
          ],
        },
      },
      {
        kind: "response_event",
        id: "public-response",
        observationIds: ["capture-a"],
        fields: {
          occurredAt: [
            {
              id: "time",
              content: { state: "unknown", reason: "not_recorded" },
            },
          ],
          officialResponse: [
            sourced("response", "Fictional office acknowledged the report."),
          ],
          mediaAttention: [sourced("media", false)],
          policyImpact: [
            {
              id: "policy",
              content: { state: "unknown", reason: "not_collected" },
            },
          ],
          reportedConcealmentAllegation: [
            sourced(
              "allegation",
              "A fictional correspondent alleged that a log was withheld; the allegation has not been assessed.",
            ),
          ],
        },
      },
    ],
  };
  return refresh({ first, second, caseRecord });
}
