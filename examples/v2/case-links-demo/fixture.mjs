import {
  fixture as connected,
  refresh as refreshCase,
  bytes,
  digest,
  provenance,
} from "../connected-case-demo/fixture.mjs";
export { bytes, digest };
export const snapshot = (v, schemaId) => ({
  documentId: v.id,
  schemaId,
  sha256: digest(bytes(v)),
});
export const contextSchema =
  "urn:disclosureos:experimental:observation-context:0.1.0";
export const caseSchema = "urn:disclosureos:experimental:case-record:0.1.0";
export const intakeSchema = "urn:disclosureos:experimental:source-intake:0.1.0";
export const entitiesSchema = (v) =>
  `urn:disclosureos:experimental:research-entities:${v}`;
export function refresh(f) {
  refreshCase(f);
  f.context.observationRef = f.caseRecord.observationRefs[0];
  f.entities.observationRef = f.caseRecord.observationRefs[0];
  f.links.caseRef = snapshot(f.caseRecord, caseSchema);
  for (const l of f.links.links) {
    if (l.kind === "context")
      l.reference.document = snapshot(f.context, contextSchema);
    else if (l.kind === "entities")
      l.reference.document = snapshot(
        f.entities,
        entitiesSchema(f.entities.schemaVersion),
      );
    else l.document = snapshot(f.intake, intakeSchema);
  }
  return f;
}
export const documents = (f) =>
  new Map(
    [f.first, f.second, f.caseRecord, f.context, f.entities, f.intake].map(
      (v) => [digest(bytes(v)), bytes(v)],
    ),
  );
const sourced = (id, value) => [
  {
    id,
    content: {
      state: "known",
      value,
      provenance: {
        sourceRef: "source:log",
        attributedTo: "Fictional station recorder",
        extractedBy: "Fictional editor",
      },
    },
  },
];
const unknown = {
  state: "unknown",
  reason: "Not supplied in this fictional example",
};
/** Fictional associations, not partner records or a demonstration of public authorization. */
export function fixture() {
  const f = connected(),
    time = "2026-09-11T00:00:00Z",
    rawLog = Buffer.from("Fictional station log for this control.\n");
  f.first.sources[0].digest = { algorithm: "sha256", value: digest(rawLog) };
  f.context = {
    kind: "observation_context",
    schemaVersion: "0.1.0",
    id: "case-context",
    recordedAt: time,
    recordedBy: "Fictional editor",
    observationRef: f.caseRecord.observationRefs[0],
    entities: [
      {
        kind: "event",
        id: "event",
        fields: {
          description: sourced(
            "description",
            "A fictional station observation, without a proposed origin.",
          ),
        },
      },
    ],
  };
  f.entities = {
    kind: "research_entities",
    schemaVersion: "0.4.0",
    id: "case-witnesses",
    recordedAt: time,
    recordedBy: "Fictional editor",
    observationRef: f.caseRecord.observationRefs[0],
    contextRefs: [],
    entities: [
      {
        kind: "witness",
        id: "witness-a",
        fields: {
          publicIdentity: sourced("identity", {
            kind: "pseudonym",
            display: "Witness A",
          }),
          anonymous: sourced("anonymous", false),
        },
      },
    ],
  };
  f.intake = {
    kind: "source_intake",
    schemaVersion: "0.1.0",
    id: "station-intake",
    receivedAt: time,
    source: {
      publisher: { state: "declared", value: "Fictional station" },
      uri: "https://example.invalid/source-receipt",
    },
    access: "restricted",
    license: unknown,
    artifacts: [
      {
        id: "log-file",
        originalName: "fictional-log.txt",
        role: "documentation",
        format: { state: "declared", value: "text/plain" },
        sha256: digest(rawLog),
        byteLength: rawLog.length,
        context: {
          instrument: unknown,
          calibration: unknown,
          clock: unknown,
          acquisitionTime: unknown,
        },
      },
    ],
  };
  const basis = (text) => ({ text, provenance: provenance() });
  f.links = {
    kind: "case_links",
    schemaVersion: "0.1.0",
    id: "case-link-control",
    recordedAt: time,
    recordedBy: "Fictional editor",
    caseRef: snapshot(f.caseRecord, caseSchema),
    links: [
      {
        id: "setting",
        kind: "context",
        observationId: "capture-a",
        reference: {
          document: snapshot(f.context, contextSchema),
          target: { kind: "event", id: "event", field: "description" },
        },
        basis: basis("The station log supplies this event description."),
      },
      {
        id: "witness",
        kind: "entities",
        observationId: "capture-a",
        reference: {
          document: snapshot(f.entities, entitiesSchema("0.4.0")),
          target: { kind: "witness", id: "witness-a", field: "publicIdentity" },
        },
        basis: basis(
          "The supplied witness supplement describes this observation.",
        ),
      },
      {
        id: "receipt",
        kind: "intake",
        observationId: "capture-a",
        document: snapshot(f.intake, intakeSchema),
        artifactLinks: [
          { artifactId: "log-file", observationRef: "source:log" },
        ],
        basis: basis(
          "The receipt and observation inventory declare the same file digest; original bytes are not supplied.",
        ),
      },
    ],
  };
  return refresh(f);
}
