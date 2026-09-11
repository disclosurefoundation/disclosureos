import {
  bytes,
  digest,
  snapshot,
  observationSchema,
  contextSchema,
} from "../context-demo/fixture.mjs";
export { bytes, digest };
export const entitiesSchema =
  "urn:disclosureos:experimental:research-entities:0.1.0";
const time = "2026-09-10T12:00:00Z";
export const sourced = (id, value, sourceRef = "source:account-1981") => [
  {
    id,
    content: {
      state: "known",
      value,
      provenance: {
        sourceRef,
        attributedTo: "Synthetic source author",
        extractedBy: "Synthetic curator",
        locator: { kind: "page", page: 1 },
      },
    },
  },
];
const unknown = (id) => [
  { id, content: { state: "unknown", reason: "not_recorded" } },
];
/** Fictional control based on the approved historical-account scenario, not historical evidence. */
export function fixture() {
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "historical-control",
    status: "draft",
    createdAt: time,
    updatedAt: time,
    summary:
      "SYNTHETIC: one public pseudonym, two recorded accounts; event quarter has no invented UTC instant.",
    eventTime: { state: "unknown", reason: "not_recorded" },
    position: { state: "unknown", reason: "not_recorded" },
    sources: [
      {
        id: "account-1981",
        kind: "testimony",
        access: "unknown",
        title: "Synthetic interview recorded in 1981",
      },
      {
        id: "retelling-1990",
        kind: "testimony",
        access: "unknown",
        title: "Synthetic later retelling",
      },
    ],
    products: [],
    methods: [
      {
        id: "review",
        version: "1.0",
        description:
          "Manual review of supplied declarations; no credibility score.",
      },
    ],
    frames: [],
    assertions: [],
    measurements: [],
    processing: [],
  };
  const context = {
    kind: "observation_context",
    schemaVersion: "0.1.0",
    id: "historical-context",
    observationRef: snapshot(observation, observationSchema),
    recordedAt: time,
    recordedBy: "Synthetic curator",
    entities: [
      {
        kind: "temporal",
        id: "event-quarter",
        fields: {
          calendarPeriod: sourced("quarter", {
            kind: "quarter",
            year: 1952,
            quarter: 3,
          }),
          display: sourced("display", "Third quarter of 1952"),
        },
      },
    ],
  };
  const contextRef = {
    document: snapshot(context, contextSchema),
    target: { kind: "temporal", id: "event-quarter" },
  };
  const qualification = (value) => ({
    value,
    relevantTime: { kind: "context", reference: contextRef },
  });
  const entities = {
    kind: "research_entities",
    schemaVersion: "0.1.0",
    id: "historical-entities",
    observationRef: snapshot(observation, observationSchema),
    contextRefs: [snapshot(context, contextSchema)],
    recordedAt: time,
    recordedBy: "Synthetic curator",
    entities: [
      {
        kind: "witness",
        id: "A",
        fields: {
          publicIdentity: sourced("public-identity", {
            kind: "pseudonym",
            display: "Witness A",
          }),
          anonymous: sourced("anonymous", true),
          willingToBeIdentified: unknown("consent"),
          category: sourced("category", qualification("private_pilot")),
          experienceYears: sourced("experience", qualification(5)),
          hasAviationExperience: sourced("aviation", qualification(true)),
        },
      },
      {
        kind: "account",
        id: "A",
        fields: {
          speakerWitnessIds: sourced("speaker", ["A"]),
          recorder: sourced("recorder", "Recorder A"),
          recordedTime: sourced("recorded", { kind: "year", value: "1981" }),
          context: sourced("setting", "recorded_interview"),
          eventContext: sourced("event", contextRef),
          content: sourced(
            "wording",
            "SYNTHETIC: I saw a light during the third quarter of 1952."
          ),
          summary: sourced("summary", {
            text: "Synthetic account of a light; no sensor measurements supplied.",
            summarizedBy: "Synthetic editor",
          }),
          sourceDocument: sourced("source", "source:account-1981"),
          underOath: unknown("oath"),
          interviewAvailable: unknown("recording"),
          writtenReportAvailable: unknown("report"),
        },
      },
      {
        kind: "account",
        id: "retelling",
        fields: {
          speakerWitnessIds: sourced("speaker", ["A"], "source:retelling-1990"),
          recorder: sourced("recorder", "Recorder B", "source:retelling-1990"),
          recordedTime: sourced(
            "recorded",
            { kind: "year", value: "1990" },
            "source:retelling-1990"
          ),
          sourceDocument: sourced(
            "source",
            "source:retelling-1990",
            "source:retelling-1990"
          ),
        },
      },
      {
        kind: "procedure",
        id: "polygraph",
        fields: {
          procedureType: sourced("type", "polygraph"),
          witnessId: sourced("witness", "A"),
          accountId: sourced("account", "A"),
          administered: unknown("administration"),
          passed: unknown("result"),
        },
      },
      {
        kind: "witness_group",
        id: "roster",
        fields: {
          witnessIds: sourced("members", ["A"]),
          reportedCount: unknown("count"),
        },
      },
    ],
  };
  const ref = {
    document: snapshot(entities, entitiesSchema),
    target: { kind: "witness", id: "A", field: "experienceYears" },
  };
  const history = {
    kind: "claim_history",
    schemaVersion: "0.3.0",
    id: "historical-review",
    observation,
    contextRefs: [snapshot(context, contextSchema)],
    entityRefs: [snapshot(entities, entitiesSchema)],
    claims: [
      {
        id: "qualification-review",
        kind: "assessment",
        recordedAt: time,
        topic: "reported_qualification",
        subject: { kind: "entity", reference: ref },
        inputRefs: ["source:account-1981"],
        entityInputRefs: [{ ...ref, assertionId: "experience" }],
        rationale:
          "Five years is a source declaration relevant to the event quarter. It does not authenticate the witness or establish independence.",
        status: "assessed",
        outcome: "reported",
        evaluatedBy: "Synthetic reviewer",
        evaluatedAt: time,
        methodRef: "method:review",
        methodVersion: "1.0",
        witnessReview: {
          multipleIndependent: "unknown",
          notes:
            "Two accounts share one scoped witness. No credibility score is calculated.",
        },
      },
    ],
  };
  return { observation, context, entities, history };
}
/** Rebind exact snapshots after a test mutation, retaining deliberately altered IDs or targets. */
export function bundle(f) {
  f.context.observationRef = snapshot(f.observation, observationSchema);
  f.entities.observationRef = snapshot(f.observation, observationSchema);
  const c = snapshot(f.context, contextSchema);
  f.entities.contextRefs = [c];
  f.history.contextRefs = [c];
  f.history.observation = f.observation;
  for (const e of f.entities.entities)
    for (const assertions of Object.values(e.fields))
      for (const a of Array.isArray(assertions) ? assertions : []) {
        const v = a.content.value;
        if (v?.relevantTime?.kind === "context")
          v.relevantTime.reference.document = c;
        if (v?.document?.schemaId === contextSchema) v.document = c;
      }
  const r = snapshot(f.entities, entitiesSchema);
  f.history.entityRefs = [r];
  for (const claim of f.history.claims) {
    if (claim.subject.kind === "entity") claim.subject.reference.document = r;
    if (claim.kind === "assessment")
      for (const ref of claim.entityInputRefs ?? []) ref.document = r;
  }
  const documents = new Map(
    [f.observation, f.context, f.entities].map((d) => {
      const b = bytes(d);
      return [digest(b), b];
    })
  );
  return { history: f.history, options: { documents } };
}
