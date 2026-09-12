import {
  fixture as witnessFixture,
  bundle,
  bytes,
  digest,
  entitiesSchema,
} from "../witness-accounts-demo/fixture.mjs";
import {
  snapshot,
  observationSchema,
  contextSchema,
} from "../context-demo/fixture.mjs";
import { fixture as contextCaseFixture } from "../context-case-demo/fixture.mjs";
export { bytes, digest };
export function refresh(f) {
  bundle(f);
  f.caseRecord.observationRefs = [snapshot(f.observation, observationSchema)];
  f.presentation.presentation.caseRef = snapshot(
    f.caseRecord,
    "urn:disclosureos:experimental:case-record:0.1.0",
  );
  f.presentation.testimony.document = snapshot(f.entities, entitiesSchema);
  f.presentation.testimony.context = snapshot(f.context, contextSchema);
  f.presentation.testimony.history = snapshot(
    f.history,
    "urn:disclosureos:experimental:claim-history:0.3.0",
  );
  return f;
}
export function fixture() {
  const f = witnessFixture(),
    base = contextCaseFixture();
  // Reuse the case grouping shape, with explicit fictional testimony attribution.
  f.caseRecord = base.caseRecord;
  f.caseRecord.id = "historical-account-case";
  f.caseRecord.entities[0].fields.label[0].content.value =
    "Synthetic historical account";
  f.caseRecord.entities[1].member.id = f.observation.id;
  for (const provenance of [
    f.caseRecord.entities[0].fields.label[0].content.provenance,
    f.caseRecord.entities[1].basis.provenance,
  ]) {
    provenance.observationId = f.observation.id;
    provenance.sourceRef = "source:account-1981";
    provenance.attributedTo = "Synthetic source author";
  }
  f.caseRecord.entities[1].basis.text =
    "A synthetic account describes the reported event.";
  f.presentation = {
    kind: "testimony_case_presentation",
    schemaVersion: "0.1.0",
    presentation: {
      kind: "case_presentation",
      schemaVersion: "0.1.0",
      publicId: "historical-testimony-control",
      caseRef: {},
      title: "One witness. Two recorded accounts.",
      summary:
        "A reported event in 1952, an interview in 1981 and a later retelling in 1990. Follow the account, its source and the limits of the review.",
      updatedAt: "2026-09-12T12:00:00Z",
      status: "published",
      citations: [
        {
          id: "interview",
          label: "Interview recorded in 1981",
          description:
            "Fictional account declaration. Original interview media and source-file bytes are not supplied.",
          target: {
            kind: "artifact",
            observationId: f.observation.id,
            ref: "source:account-1981",
          },
        },
        {
          id: "retelling",
          label: "Retelling recorded in 1990",
          description:
            "Fictional later account attributed to the same witness. Wording and original source-file bytes are not supplied.",
          target: {
            kind: "artifact",
            observationId: f.observation.id,
            ref: "source:retelling-1990",
          },
        },
      ],
      blocks: [
        {
          id: "setting",
          heading: "How these accounts relate",
          text: "Both selected accounts refer to the same public pseudonym. The interview describes an event quarter; the later retelling has a recording year but no separately selected event period or wording.",
          citationIds: ["interview", "retelling"],
        },
      ],
      findings: [],
      attachments: [],
      notices: [
        {
          id: "synthetic",
          kind: "scope",
          text: "Fictional control, not a historical case or ELDÆON data. The public pseudonym, wording and review are software-test declarations.",
        },
      ],
    },
    testimony: {
      document: {},
      context: {},
      history: {},
      event: {
        entityId: "event-quarter",
        assertionId: "quarter",
        citationIds: ["interview"],
      },
      witness: {
        entityId: "A",
        identityAssertionId: "public-identity",
        experienceAssertionId: "experience",
        citationIds: ["interview"],
      },
      accounts: [
        {
          id: "interview",
          label: "The recorded interview",
          entityId: "A",
          speakerAssertionId: "speaker",
          recordedAssertionId: "recorded",
          sourceAssertionId: "source",
          contentAssertionId: "wording",
          eventAssertionId: "event",
          oathAssertionId: "oath",
          citationIds: ["interview"],
        },
        {
          id: "retelling",
          label: "The later retelling",
          entityId: "retelling",
          speakerAssertionId: "speaker",
          recordedAssertionId: "recorded",
          sourceAssertionId: "source",
          citationIds: ["retelling"],
        },
      ],
      review: {
        id: "qualification-review",
        claimId: "qualification-review",
        title: "Experience reported, identity not authenticated",
        summary:
          "Five years of experience is a source declaration relevant to the event quarter. This review does not establish the witness’s identity or the independence of the accounts.",
        reviewerLabel: "Synthetic reviewer",
        methodLabel: "Review of supplied qualification declarations",
        citationIds: ["interview"],
      },
    },
  };
  return refresh(f);
}
export const documents = (f) =>
  new Map(
    [f.observation, f.context, f.entities, f.history, f.caseRecord].map((v) => [
      digest(bytes(v)),
      bytes(v),
    ]),
  );
export const approval = (f) => ({
  presentationSha256: digest(bytes(f.presentation)),
  policyVersion: "fictional-testimony-policy-1",
});
