import {
  fixture as laboratoryFixture,
  refresh as refreshLaboratory,
  bytes,
  digest,
  snapshot,
} from "../laboratory-review-demo/fixture.mjs";
import { fixture as contextFixture } from "../context-case-demo/fixture.mjs";
export { bytes, digest };
export function refresh(f) {
  const selection = snapshot(
    f.selection,
    "urn:disclosureos:experimental:physical-sample-selection:0.1.0"
  );
  for (const e of f.entities.entities) {
    if (e.selectionRef) e.selectionRef.document = selection;
    if (e.transferRef) e.transferRef.document = selection;
  }
  refreshLaboratory(f);
  f.caseRecord.observationRefs = [
    snapshot(f.observation, "urn:disclosureos:experimental:observation:0.1.0"),
  ];
  f.presentation.presentation.caseRef = snapshot(
    f.caseRecord,
    "urn:disclosureos:experimental:case-record:0.1.0"
  );
  f.presentation.material.document = snapshot(
    f.entities,
    "urn:disclosureos:experimental:research-entities:0.4.0"
  );
  f.presentation.material.history = snapshot(
    f.history,
    "urn:disclosureos:experimental:claim-history:0.5.0"
  );
  return f;
}
export function fixture() {
  const f = laboratoryFixture();
  f.caseRecord = contextFixture().caseRecord;
  f.caseRecord.id = "material-laboratory-case";
  f.caseRecord.entities[0].fields.label[0].content.value =
    "Fictional material record";
  f.caseRecord.entities[1].member.id = f.observation.id;
  f.caseRecord.entities[1].basis.text =
    "A fictional record groups specimen and laboratory declarations.";
  for (const p of [
    f.caseRecord.entities[0].fields.label[0].content.provenance,
    f.caseRecord.entities[1].basis.provenance,
  ]) {
    p.observationId = f.observation.id;
    p.sourceRef = "source:handling-log";
    p.attributedTo = "Fictional curator";
  }
  const item = (id, entityId, label, citationIds = ["handling-log"]) => ({
    id,
    entityId,
    label,
    citationIds,
  });
  const action = (id, entityId) => ({
    id,
    entityId,
    actionAssertionId: "action",
    dateAssertionId: "time",
    citationIds: ["handling-log"],
  });
  f.presentation = {
    kind: "material_case_presentation",
    schemaVersion: "0.1.0",
    presentation: {
      kind: "case_presentation",
      schemaVersion: "0.1.0",
      publicId: "material-laboratory-control",
      caseRef: {},
      title: "One specimen. Separate results.",
      summary:
        "Follow a specimen through preparation, inspect the results reported for one aliquot, and see what the review leaves unresolved.",
      updatedAt: "2026-09-12T18:00:00Z",
      status: "published",
      citations: [
        ["handling-log", "Handling declarations"],
        ["lab-report", "Laboratory report declaration"],
      ].map(([id, label]) => ({
        id,
        label,
        description:
          "Fictional source declaration only. The underlying report bytes are not supplied.",
        target: {
          kind: "artifact",
          observationId: f.observation.id,
          ref: `source:${id}`,
        },
      })),
      blocks: [
        {
          id: "account",
          heading: "Keep the specimen with the result",
          text: "A parent soil specimen is split into aliquots A and B. Three results are reported for aliquot A. No result is selected for aliquot B, and the nearby surface impression remains a separate trace.",
          citationIds: ["handling-log", "lab-report"],
        },
      ],
      findings: [],
      attachments: [],
      notices: [
        {
          id: "fictional",
          kind: "scope",
          text: "Fictional declarations for software testing. No physical specimen, laboratory work, report file or ELDÆON data is supplied.",
        },
      ],
    },
    material: {
      document: {},
      history: {},
      traces: [
        {
          ...item("trace", "trace", "Surface impression"),
          descriptionAssertionId: "description",
        },
      ],
      specimens: [
        {
          ...item("parent", "parent", "Parent soil specimen"),
          fields: [
            { field: "type", assertionId: "type" },
            { field: "collectionTime", assertionId: "time" },
          ],
          actions: [action("received", "receive"), action("stored", "store")],
        },
        {
          ...item("aliquot-a", "aliquot-a", "Aliquot A"),
          fields: [
            { field: "description", assertionId: "description" },
            { field: "reportedCustodyStatus", assertionId: "custody" },
          ],
          actions: [action("received", "aliquot-receive")],
        },
        {
          ...item("aliquot-b", "aliquot-b", "Aliquot B"),
          fields: [{ field: "description", assertionId: "description" }],
          actions: [],
        },
      ],
      preparations: [
        {
          ...item("split", "split", "Split into two aliquots"),
          methodAssertionId: "method",
          dateAssertionId: "when",
        },
      ],
      analyses: [
        {
          ...item("analysis", "analysis-a", "Reported laboratory analysis", [
            "lab-report",
          ]),
          methodAssertionId: "method",
          methodLabel: "Fictional analytical protocol",
          dateAssertionId: "time",
        },
      ],
      results: [
        {
          ...item("numeric", "numeric", "Constituent A", ["lab-report"]),
          resultAssertionId: "result",
          analyteAssertionId: "analyte",
        },
        {
          ...item("below-limit", "below-limit", "Constituent B", [
            "lab-report",
          ]),
          resultAssertionId: "result",
          analyteAssertionId: "analyte",
        },
        {
          ...item("qualitative", "qualitative", "Reported appearance", [
            "lab-report",
          ]),
          resultAssertionId: "result",
        },
      ],
      review: {
        id: "limitations-review",
        claimId: "review-a",
        title: "What the measurement leaves unresolved",
        summary:
          "The selected review of constituent A is inconclusive. Uncertainty and aliquot custody remain unresolved; composition alone does not determine an unusual origin.",
        reviewerLabel: "Fictional reviewer A",
        methodLabel: "Fictional limitations review",
        citationIds: ["lab-report"],
      },
    },
  };
  return refresh(f);
}
export const documents = (f) =>
  new Map(
    [f.observation, f.entities, f.selection, f.history, f.caseRecord].map(
      (v) => [digest(bytes(v)), bytes(v)]
    )
  );
export const approval = (f) => ({
  presentationSha256: digest(bytes(f.presentation)),
  policyVersion: "fictional-material-policy-1",
});
