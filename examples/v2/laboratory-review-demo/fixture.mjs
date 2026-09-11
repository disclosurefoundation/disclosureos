import {
  fixture as materialFixture,
  bytes,
  digest,
  sourced,
  unknown,
} from "../material-lineage-demo/fixture.mjs";
export { bytes, digest, sourced, unknown };
export const schemaId = "urn:disclosureos:experimental:research-entities:0.4.0";
export const snapshot = (value, schemaId) => ({
  documentId: value.id,
  schemaId,
  sha256: digest(bytes(value)),
});
const time = "2026-09-11T00:00:00Z";
export function refresh(f) {
  f.entities.observationRef = snapshot(
    f.observation,
    "urn:disclosureos:experimental:observation:0.1.0",
  );
  const ref = snapshot(f.entities, schemaId);
  f.history.entityRefs = [ref];
  for (const c of f.history.claims) {
    if (c.subject.kind === "entity") c.subject.reference.document = ref;
    for (const r of c.entityInputRefs ?? []) r.document = ref;
    for (const r of c.editionInputRefs ?? []) r.document = ref;
    if (c.editionCitation) c.editionCitation.document = ref;
  }
  return f;
}
/** Fictional declarations only; no actual laboratory work or partner material is represented. */
export function fixture() {
  const { observation, entities } = materialFixture();
  observation.methods = [
    {
      id: "lab-method",
      version: "1",
      description: "Fictional analytical protocol",
    },
    { id: "review", version: "1", description: "Fictional limitations review" },
  ];
  observation.sources.push({
    id: "lab-report",
    kind: "document",
    access: "public",
    title: "Fictional laboratory report declaration; bytes not supplied",
    digest: { algorithm: "sha256", value: "b".repeat(64) },
  });
  observation.measurements = [
    {
      id: "concentration-a",
      quantity: "mass_fraction",
      value: {
        value: 1.25,
        unit: "mg/kg",
        uncertainty: { kind: "unknown", reason: "not_reported" },
      },
      sourceRefs: ["source:lab-report"],
    },
  ];
  entities.schemaVersion = "0.4.0";
  const report = {
    sourceRef: "source:lab-report",
    digest: observation.sources.at(-1).digest,
  };
  const lab = (id, value) =>
    sourced(id, value).map((a) => ({
      ...a,
      content: {
        ...a.content,
        provenance: {
          ...a.content.provenance,
          sourceRef: "source:lab-report",
          attributedTo: "Fictional laboratory",
          sourceDigest: report.digest,
        },
      },
    }));
  const limit = {
    kind: "detection",
    magnitude: 0.1,
    unit: "mg/kg",
    basis:
      "Fictional report threshold; method performance has not been reviewed",
  };
  entities.entities.push(
    {
      kind: "laboratory_analysis",
      id: "analysis-a",
      inputMaterialIds: ["aliquot-a"],
      preparationIds: ["split"],
      resultIds: ["numeric", "below-limit", "qualitative"],
      fields: {
        method: lab("method", {
          methodRef: "method:lab-method",
          methodVersion: "1",
        }),
        laboratory: lab("laboratory", "Fictional laboratory"),
        operator: unknown("operator"),
        performedAt: unknown("time"),
        reportArtifacts: lab("report", [report]),
      },
    },
    {
      kind: "laboratory_result",
      id: "numeric",
      analysisId: "analysis-a",
      materialId: "aliquot-a",
      fields: {
        analyte: lab("analyte", "Fictional constituent A"),
        result: lab("result", {
          kind: "quantitative",
          measurementId: "concentration-a",
          limit: { state: "reported", value: limit },
        }),
        reportArtifacts: lab("report", [report]),
      },
    },
    {
      kind: "laboratory_result",
      id: "below-limit",
      analysisId: "analysis-a",
      materialId: "aliquot-a",
      fields: {
        analyte: lab("analyte", "Fictional constituent B"),
        result: lab("result", { kind: "below_limit", limit }),
      },
    },
    {
      kind: "laboratory_result",
      id: "qualitative",
      analysisId: "analysis-a",
      materialId: "aliquot-a",
      fields: {
        result: lab("result", {
          kind: "qualitative",
          text: "Fictional report: gray particulate matter observed.",
        }),
      },
    },
  );
  const selection = {
    kind: "physical_sample_selection",
    schemaVersion: "0.1.0",
    id: "specimen-selection",
    historyId: "laboratory-history",
    observationId: observation.id,
    samples: [
      {
        id: "parent",
        lineage: "collected_specimen",
        label: { state: "known", value: "Fictional parent soil specimen" },
        collection: {
          state: "unknown",
          reason: "Collection record unavailable",
        },
        custody: {
          state: "documented",
          transfers: [
            {
              id: "receive",
              from: "Fictional collector",
              to: "Fictional repository",
              recordRef: "source:handling-log",
            },
            {
              id: "store",
              from: "Fictional repository",
              to: "Fictional repository",
              recordRef: "source:handling-log",
            },
          ],
        },
        currentCustodian: { state: "unknown", reason: "Not supplied" },
      },
    ],
  };
  const selectionRef = {
    document: snapshot(
      selection,
      "urn:disclosureos:experimental:physical-sample-selection:0.1.0",
    ),
    sampleId: "parent",
  };
  entities.entities.find((e) => e.id === "parent").selectionRef = selectionRef;
  for (const id of ["receive", "store"])
    entities.entities.find((e) => e.id === id).transferRef = {
      ...selectionRef,
      transferId: id,
    };
  const subject = {
    kind: "entity",
    reference: {
      document: {},
      target: { kind: "laboratory_result", id: "numeric", field: "result" },
    },
  };
  const history = {
    kind: "claim_history",
    schemaVersion: "0.5.0",
    id: "laboratory-history",
    contextRefs: [],
    entityRefs: [],
    observation,
    claims: [
      {
        id: "reported-quality",
        kind: "source_assertion",
        recordedAt: time,
        topic: "material_quality",
        subject: {
          kind: "entity",
          reference: {
            document: {},
            target: { kind: "material", id: "aliquot-a" },
          },
        },
        text: "Fictional report describes this aliquot as field collected.",
        provenance: lab("p", true)[0].content.provenance,
        reportedMaterialReview: {
          quality: "field_collected",
          findings: "Source wording retained without independent validation.",
        },
      },
      {
        id: "review-a",
        kind: "assessment",
        status: "assessed",
        recordedAt: time,
        evaluatedAt: time,
        topic: "analytical_limitations",
        subject,
        inputRefs: ["measurement:concentration-a"],
        entityInputRefs: [
          {
            document: {},
            target: {
              kind: "laboratory_result",
              id: "numeric",
              field: "result",
            },
            assertionId: "result",
          },
        ],
        rationale:
          "The source does not supply uncertainty or independent custody for this aliquot.",
        outcome: "inconclusive",
        evaluatedBy: "Fictional reviewer A",
        methodRef: "method:review",
        methodVersion: "1",
        materialReview: {
          contamination: "unknown",
          representativeness: "unknown",
          limitations: [
            "Uncertainty not reported",
            "Aliquot custody has a gap",
          ],
          findings: "Composition alone does not determine an unusual origin.",
        },
      },
    ],
  };
  return refresh({ observation, entities, selection, history });
}
export function documents(f) {
  return new Map(
    [f.observation, f.entities, f.selection].map((value) => {
      const data = bytes(value);
      return [digest(data), data];
    }),
  );
}
