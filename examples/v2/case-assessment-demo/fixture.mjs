import {
  fixture as connected,
  refresh as refreshCase,
  bytes,
  digest,
} from "../connected-case-demo/fixture.mjs";
export { bytes, digest };
export const caseSnapshot = (value) => ({
  documentId: value.id,
  schemaId: "urn:disclosureos:experimental:case-record:0.1.0",
  sha256: digest(bytes(value)),
});
export function refresh(f) {
  refreshCase(f);
  const document = caseSnapshot(f.caseRecord);
  f.history.caseRefs = [document];
  for (const c of f.history.claims) {
    if (c.subject.kind === "case") c.subject.document = document;
    else if (c.subject.kind === "case_entity")
      c.subject.reference.document = document;
    else {
      c.subject.from.case = document;
      c.subject.to.case = document;
    }
    if (c.kind === "source_assertion") c.provenance.case = document;
    else {
      for (const r of c.caseInputRefs ?? []) r.document = document;
      for (const r of c.observationInputRefs ?? []) r.case = document;
      if (c.status === "assessed") c.methodRef.case = document;
    }
  }
  return f;
}
export const documents = (f) =>
  new Map(
    [f.first, f.second, f.caseRecord].map((value) => [
      digest(bytes(value)),
      bytes(value),
    ]),
  );
/** Fictional declared reviews; outcomes are supplied, never computed by validation. */
export function fixture() {
  const f = connected();
  f.first.methods.push({
    id: "case-review",
    version: "1",
    description:
      "Fictional comparison protocol; no scientific validation is claimed",
  });
  refreshCase(f);
  const document = caseSnapshot(f.caseRecord),
    time = "2026-09-11T01:00:00Z";
  const subject = {
    kind: "case_entity",
    reference: {
      document,
      target: {
        kind: "investigation",
        id: "review-a",
        field: "reportedConclusion",
      },
    },
  };
  const input = (assertionId) => ({
    kind: "case_assertion",
    document,
    target: {
      kind: "investigation",
      id: "review-a",
      field: "reportedConclusion",
    },
    assertionId,
  });
  const assessment = {
    kind: "assessment",
    status: "assessed",
    recordedAt: time,
    evaluatedAt: time,
    evaluatedBy: "Fictional reviewer A",
    methodRef: {
      case: document,
      observationId: "capture-a",
      methodId: "case-review",
    },
    methodVersion: "1",
    inputRefs: [],
    outcome: "inconclusive",
  };
  f.history = {
    kind: "case_claim_history",
    schemaVersion: "0.1.0",
    id: "case-review-control",
    caseRefs: [document],
    claims: [
      {
        id: "source-conclusion",
        kind: "source_assertion",
        recordedAt: time,
        topic: "investigation-conclusion",
        subject: structuredClone(subject),
        text: "The report describes the case as unresolved.",
        provenance: {
          case: document,
          observationId: "capture-a",
          sourceRef: "source:log",
          attributedTo: "Fictional investigation group",
          extractedBy: "Fictional recorder",
          locator: { kind: "page", page: 1 },
        },
      },
      {
        ...structuredClone(assessment),
        id: "same-object",
        topic: "identity",
        subject: {
          kind: "case_relation",
          relation: "same_object",
          from: { case: document, observationId: "capture-a" },
          to: { case: document, observationId: "capture-b" },
        },
        caseInputRefs: [
          {
            kind: "case_basis",
            document,
            target: { kind: "relationship", id: "later" },
          },
        ],
        observationInputRefs: [
          { case: document, observationId: "capture-a", ref: "source:log" },
          { case: document, observationId: "capture-b", ref: "source:log" },
        ],
        rationale:
          "Chronological sequence alone does not establish a shared object.",
      },
      {
        ...structuredClone(assessment),
        id: "finding-original",
        topic: "investigation-conclusion",
        subject: structuredClone(subject),
        caseInputRefs: [input("conclusion-a")],
        rationale: "Initial review of the unresolved conclusion.",
      },
      {
        ...structuredClone(assessment),
        id: "finding-revised",
        topic: "investigation-conclusion",
        subject: structuredClone(subject),
        recordedAt: "2026-09-11T02:00:00Z",
        evaluatedAt: "2026-09-11T02:00:00Z",
        supersedes: ["claim:finding-original"],
        inputRefs: ["claim:finding-original"],
        caseInputRefs: [input("conclusion-a"), input("conclusion-b")],
        rationale:
          "Both conflicting conclusions are now considered; neither is selected.",
      },
      {
        ...structuredClone(assessment),
        id: "independent-review",
        topic: "investigation-conclusion",
        subject: structuredClone(subject),
        evaluatedBy: "Fictional reviewer B",
        caseInputRefs: [input("conclusion-b")],
        rationale:
          "Independent review remains alongside reviewer A's revised assessment.",
      },
      {
        kind: "assessment",
        status: "unassessed",
        id: "corroboration-pending",
        recordedAt: time,
        topic: "independence",
        subject: {
          kind: "case_relation",
          relation: "corroborates",
          from: { case: document, observationId: "capture-a" },
          to: { case: document, observationId: "capture-b" },
        },
        inputRefs: [],
        rationale: "Source independence has not been reviewed.",
      },
    ],
  };
  return f;
}
