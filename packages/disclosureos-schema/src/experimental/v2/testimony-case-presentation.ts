import { z } from "zod";
import { capturePresentationSnapshots } from "./presentation-snapshots";
import {
  parseResearchEntities,
  parseResearchClaimHistory,
  parseObservationContext,
  parseCaseRecord,
  researchEntityAssertions,
  contextAssertions,
  caseSnapshotKey,
  type DocumentSnapshotRef,
  type ResearchEntity,
} from "@disclosureos/records/experimental/v2";
import { evaluateResearchClaimHistory } from "./research-entities-review";
import {
  CasePresentationSchema,
  parseCasePresentation,
  buildPublicCase,
  formatPublicCaseOutputs,
  type CasePublicationApproval,
  type PublicCasePayload,
} from "./case-presentation";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const text = z.string().min(1).max(20000).regex(/\S/);
const hash = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const ref = (schema: string) =>
  z.strictObject({
    documentId: id,
    schemaId: z.literal(`urn:disclosureos:experimental:${schema}`),
    sha256: hash,
  });
const citations = z.array(id).min(1);
export const TESTIMONY_CASE_PRESENTATION_SCHEMA_ID =
  "urn:disclosureos:experimental:testimony-case-presentation:0.1.0";
/** A bounded selection of a public pseudonym, recorded accounts and a qualification review. */
export const TestimonyCasePresentationSchema = z.strictObject({
  kind: z.literal("testimony_case_presentation"),
  schemaVersion: z.literal("0.1.0"),
  presentation: CasePresentationSchema,
  testimony: z.strictObject({
    document: ref("research-entities:0.1.0"),
    context: ref("observation-context:0.1.0"),
    history: ref("claim-history:0.3.0"),
    event: z.strictObject({
      entityId: id,
      assertionId: id,
      citationIds: citations,
    }),
    witness: z.strictObject({
      entityId: id,
      identityAssertionId: id,
      experienceAssertionId: id,
      citationIds: citations,
    }),
    accounts: z
      .array(
        z.strictObject({
          id,
          label: text,
          entityId: id,
          speakerAssertionId: id,
          recordedAssertionId: id,
          sourceAssertionId: id,
          contentAssertionId: id.optional(),
          eventAssertionId: id.optional(),
          oathAssertionId: id.optional(),
          citationIds: citations,
        }),
      )
      .min(1),
    review: z.strictObject({
      id,
      claimId: id,
      title: text,
      summary: text,
      reviewerLabel: text,
      methodLabel: text,
      citationIds: citations,
    }),
  }),
});
export function testimonyCasePresentationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(TestimonyCasePresentationSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: TESTIMONY_CASE_PRESENTATION_SCHEMA_ID,
  };
}
export function parseTestimonyCasePresentation(input: unknown) {
  const p = TestimonyCasePresentationSchema.safeParse(input);
  if (!p.success || !parseCasePresentation(p.data.presentation).success)
    return { success: false as const };
  const s = p.data.testimony,
    unique = (xs: string[]) => new Set(xs).size === xs.length;
  const citationIds = new Set(p.data.presentation.citations.map((c) => c.id));
  if (
    !unique(s.accounts.map((a) => a.id)) ||
    !unique(s.accounts.map((a) => a.entityId)) ||
    [s.event, s.witness, ...s.accounts, s.review].some(
      (x) =>
        !unique(x.citationIds) ||
        x.citationIds.some((i) => !citationIds.has(i)),
    )
  )
    return { success: false as const };
  return { success: true as const, data: p.data };
}
export interface PublicTestimonySelection {
  event: {
    label: string;
    precision: "quarter";
    year: number;
    quarter: number;
    citationIds: string[];
  };
  witness: {
    id: string;
    label: string;
    identityKind: "pseudonym";
    experienceYears: number;
    relevantTime: string;
    citationIds: string[];
  };
  accounts: Array<{
    id: string;
    label: string;
    witnessId: string;
    recordedYear: string;
    eventPeriod?: string;
    content?: string;
    contentNotice?: string;
    oath: string;
    citationIds: string[];
  }>;
  review: {
    id: string;
    title: string;
    summary: string;
    reviewerLabel: string;
    status: "assessed";
    outcome: string;
    revision: "current" | "superseded";
    independence: string;
    method: string;
    citationIds: string[];
  };
  limitations: string[];
}
export type PublicTestimonyCasePayload = Omit<
  PublicCasePayload,
  "schemaVersion"
> & { schemaVersion: "0.3.0"; testimony: PublicTestimonySelection };
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const decode = (b: Uint8Array): unknown =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b));
const digest = async (b: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(b))),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const invalid = () => ({
  success: false as const,
  code: "INVALID_REFERENCES" as const,
});
/** Approval pins the entire selection. Only allowlisted primitives leave this builder. No fetches. */
export async function buildPublicTestimonyCase(
  input: Uint8Array,
  options: {
    documents: ReadonlyMap<string, Uint8Array>;
    approval?: CasePublicationApproval;
  },
) {
  const approval = z
    .strictObject({ presentationSha256: hash, policyVersion: text })
    .safeParse(options.approval);
  if (!approval.success)
    return { success: false as const, code: "APPROVAL_REQUIRED" as const };
  const inputBytes = Uint8Array.from(input);
  let parsed: ReturnType<typeof parseTestimonyCasePresentation>;
  try {
    parsed = parseTestimonyCasePresentation(decode(inputBytes));
  } catch {
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  }
  if (!parsed.success)
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  const d = parsed.data,
    s = d.testimony;
  try {
    // Snapshot the declared graph before any await. Private extra map entries are never read.
    const copies = capturePresentationSnapshots(options.documents, [
      s.document,
      s.context,
      s.history,
      d.presentation.caseRef,
      ...d.presentation.findings.map((f) => f.historyRef),
      ...(d.presentation.linksRef ? [d.presentation.linksRef] : []),
    ]);
    if ((await digest(inputBytes)) !== approval.data.presentationSha256)
      return { success: false as const, code: "APPROVAL_REQUIRED" as const };
    const baseBytes = bytes(d.presentation);
    const base = await buildPublicCase(baseBytes, {
      documents: copies,
      approval: {
        presentationSha256: await digest(baseBytes),
        policyVersion: approval.data.policyVersion,
      },
    });
    if (!base.success) return base;
    const load = async (r: DocumentSnapshotRef) => {
      const b = copies.get(r.sha256);
      if (!b || (await digest(b)) !== r.sha256) throw Error("snapshot");
      const v = decode(b) as { id?: string };
      if (v.id !== r.documentId) throw Error("identity");
      return v;
    };
    const entities = parseResearchEntities(await load(s.document)),
      context = parseObservationContext(await load(s.context)),
      history = parseResearchClaimHistory(await load(s.history)),
      owner = parseCaseRecord(await load(d.presentation.caseRef));
    if (
      !entities.success ||
      !context.success ||
      !history.success ||
      !owner.success
    )
      return invalid();
    const same = (a: DocumentSnapshotRef, b: DocumentSnapshotRef) =>
      caseSnapshotKey(a) === caseSnapshotKey(b);
    if (
      !same(entities.data.observationRef, context.data.observationRef) ||
      !owner.data.observationRefs.some((r) =>
        same(r, entities.data.observationRef),
      ) ||
      !history.data.entityRefs.some((r) => same(r, s.document)) ||
      !history.data.contextRefs.some((r) => same(r, s.context)) ||
      !entities.data.contextRefs.some((r) => same(r, s.context))
    )
      return invalid();
    const evaluation = await evaluateResearchClaimHistory(history.data, {
      documents: copies,
    });
    if (!evaluation.success) return invalid();
    const observationId = entities.data.observationRef.documentId;
    const cite = (ids: string[], refs: string[]) => {
      const targets = ids.map(
        (id) => d.presentation.citations.find((c) => c.id === id)!.target,
      );
      if (
        refs.some(
          (ref) =>
            !targets.some(
              (t) =>
                t.kind === "artifact" &&
                t.observationId === observationId &&
                t.ref === ref,
            ),
        )
      )
        throw Error("citation");
    };
    const assertion = (
      entity: ResearchEntity,
      field: string,
      assertionId: string,
      citationIds: string[],
    ) => {
      const list = researchEntityAssertions(entity).filter(
        (a) => a.field === field,
      );
      // Multiple declarations/precision states need their own presentation rather than silent collapse.
      if (list.length !== 1) throw Error("multiple declarations");
      const a = list.find((a) => a.assertion.id === assertionId)?.assertion;
      if (!a || !["known", "unknown"].includes(a.content.state))
        throw Error("assertion");
      cite(
        citationIds,
        a.content.provenance ? [a.content.provenance.sourceRef] : [],
      );
      return a.content;
    };
    const temporal = context.data.entities.find(
      (e) => e.kind === "temporal" && e.id === s.event.entityId,
    );
    if (
      !temporal ||
      temporal.selections?.some((x) => x.field === "calendarPeriod")
    )
      return invalid();
    const periods = contextAssertions(temporal).filter(
      (a) => a.field === "calendarPeriod",
    );
    const period = periods.find((a) => a.assertion.id === s.event.assertionId)
      ?.assertion.content;
    const pv = z
      .strictObject({
        kind: z.literal("quarter"),
        year: z.number().int(),
        quarter: z.number().int().min(1).max(4),
      })
      .safeParse(period?.value);
    if (periods.length !== 1 || period?.state !== "known" || !pv.success)
      return invalid();
    cite(
      s.event.citationIds,
      period.provenance ? [period.provenance.sourceRef] : [],
    );
    const eventLabel = `${["First", "Second", "Third", "Fourth"][pv.data.quarter - 1]} quarter of ${pv.data.year}`;
    const witness = entities.data.entities.find(
      (e) => e.kind === "witness" && e.id === s.witness.entityId,
    );
    if (!witness) return invalid();
    const identity = assertion(
      witness,
      "publicIdentity",
      s.witness.identityAssertionId,
      s.witness.citationIds,
    );
    const publicIdentity = z
      .strictObject({ kind: z.literal("pseudonym"), display: text })
      .safeParse(identity.value);
    if (identity.state !== "known" || !publicIdentity.success) return invalid();
    const matchesEvent = (v: unknown) => {
      const r = z
        .object({
          document: z.object({
            documentId: z.string(),
            schemaId: z.string(),
            sha256: z.string(),
          }),
          target: z.object({
            kind: z.literal("temporal"),
            id: z.string(),
            field: z.string().optional(),
          }),
        })
        .safeParse(v);
      return (
        r.success &&
        same(r.data.document, s.context) &&
        r.data.target.id === s.event.entityId &&
        (!r.data.target.field || r.data.target.field === "calendarPeriod")
      );
    };
    const experience = assertion(
      witness,
      "experienceYears",
      s.witness.experienceAssertionId,
      s.witness.citationIds,
    );
    const qualification = z
      .object({
        value: z.number().min(0),
        relevantTime: z.object({
          kind: z.literal("context"),
          reference: z.unknown(),
        }),
      })
      .safeParse(experience.value);
    if (
      experience.state !== "known" ||
      !qualification.success ||
      !matchesEvent(qualification.data.relevantTime.reference)
    )
      return invalid();
    const publicAccounts: PublicTestimonySelection["accounts"] = [];
    for (const a of s.accounts) {
      const account = entities.data.entities.find(
        (e) => e.kind === "account" && e.id === a.entityId,
      );
      if (!account) return invalid();
      if (
        researchEntityAssertions(account).some(
          (x) => x.field === "dateCertainty",
        )
      )
        return invalid();
      const speaker = assertion(
        account,
        "speakerWitnessIds",
        a.speakerAssertionId,
        a.citationIds,
      );
      if (
        speaker.state !== "known" ||
        !Array.isArray(speaker.value) ||
        speaker.value.length !== 1 ||
        speaker.value[0] !== witness.id
      )
        return invalid();
      const recorded = assertion(
        account,
        "recordedTime",
        a.recordedAssertionId,
        a.citationIds,
      );
      const year = z
        .strictObject({
          kind: z.literal("year"),
          value: z.string().regex(/^\d{4}$/),
        })
        .safeParse(recorded.value);
      if (recorded.state !== "known" || !year.success) return invalid();
      const source = assertion(
        account,
        "sourceDocument",
        a.sourceAssertionId,
        a.citationIds,
      );
      if (source.state !== "known" || typeof source.value !== "string")
        return invalid();
      cite(a.citationIds, [source.value]);
      let content: string | undefined,
        eventPeriod: string | undefined,
        oath = "Not selected for this public view";
      if (a.contentAssertionId) {
        const c = assertion(
          account,
          "content",
          a.contentAssertionId,
          a.citationIds,
        );
        if (c.state !== "known" || typeof c.value !== "string")
          return invalid();
        content = c.value;
      }
      if (a.eventAssertionId) {
        const e = assertion(
          account,
          "eventContext",
          a.eventAssertionId,
          a.citationIds,
        );
        if (e.state !== "known" || !matchesEvent(e.value)) return invalid();
        eventPeriod = eventLabel;
      }
      if (a.oathAssertionId) {
        const o = assertion(
          account,
          "underOath",
          a.oathAssertionId,
          a.citationIds,
        );
        if (o.state === "unknown" && "reason" in o)
          oath = `Unknown (${String(o.reason).replace(/_/g, " ")})`;
        else if (typeof o.value === "boolean")
          oath = o.value ? "Reported under oath" : "Reported not under oath";
        else return invalid();
      }
      publicAccounts.push({
        id: a.id,
        label: a.label,
        witnessId: "witness",
        recordedYear: year.data.value,
        ...(eventPeriod ? { eventPeriod } : {}),
        ...(content
          ? { content }
          : {
              contentNotice:
                "Account wording is not included in this public selection.",
            }),
        oath,
        citationIds: [...a.citationIds],
      });
    }
    const r = s.review,
      claim = history.data.claims.find((c) => c.id === r.claimId);
    if (
      !claim ||
      claim.kind !== "assessment" ||
      claim.status !== "assessed" ||
      claim.topic !== "reported_qualification" ||
      claim.subject.kind !== "entity"
    )
      return invalid();
    const target = claim.subject.reference;
    const qualificationRef = (i: typeof target) =>
      same(i.document, s.document) &&
      i.target.kind === "witness" &&
      i.target.id === witness.id &&
      i.target.field === "experienceYears";
    if (
      !qualificationRef(target) ||
      !claim.entityInputRefs?.length ||
      claim.entityInputRefs.some(
        (i) =>
          !qualificationRef(i) ||
          i.assertionId !== s.witness.experienceAssertionId,
      ) ||
      (claim.contextInputRefs ?? []).length ||
      claim.inputRefs.some((i) => !/^source:/.test(i))
    )
      return invalid();
    cite(r.citationIds, claim.inputRefs);
    // A qualification review does not establish the independence of accounts.
    if (claim.witnessReview?.multipleIndependent !== "unknown")
      return invalid();
    const testimony: PublicTestimonySelection = {
      event: {
        label: eventLabel,
        precision: "quarter",
        year: pv.data.year,
        quarter: pv.data.quarter,
        citationIds: [...s.event.citationIds],
      },
      witness: {
        id: "witness",
        label: publicIdentity.data.display,
        identityKind: "pseudonym",
        experienceYears: qualification.data.value,
        relevantTime: eventLabel,
        citationIds: [...s.witness.citationIds],
      },
      accounts: publicAccounts,
      review: {
        id: r.id,
        title: r.title,
        summary: r.summary,
        reviewerLabel: r.reviewerLabel,
        status: claim.status,
        outcome: claim.outcome,
        revision: evaluation.currentClaimRefs.includes(`claim:${claim.id}`)
          ? "current"
          : "superseded",
        independence: "Unknown",
        method: `${r.methodLabel} (version ${claim.methodVersion})`,
        citationIds: [...r.citationIds],
      },
      limitations: [
        "The selected accounts refer to one witness. Multiple accounts do not establish independent witnesses.",
        "Event time retains quarter precision; recording time retains year precision. No exact event instant is inferred.",
        "The qualification is a source declaration. The review does not authenticate the witness or assign a credibility score.",
        "Source artifact bytes, consent to publish underlying files and scientific conclusions have not been verified. Procedures and unselected fields are outside this public selection.",
      ],
    };
    return {
      success: true as const,
      data: {
        ...base.data,
        schemaVersion: "0.3.0" as const,
        assessmentNotice:
          "These are attributed assessments. Reference checks do not independently verify their conclusions.",
        testimony,
      },
    };
  } catch {
    return invalid();
  }
}
export async function buildPublicTestimonyCaseOutputs(
  input: Uint8Array,
  options: Parameters<typeof buildPublicTestimonyCase>[1],
) {
  const result = await buildPublicTestimonyCase(input, options);
  if (!result.success) return result;
  const t = result.data.testimony,
    escape = (s: string) => s.replace(/[!-/:-@\[-`{-~]/g, "\\$&");
  const lines: string[] = [],
    search: string[] = [];
  const add = (title: string, body: string[], ids: string[]) => {
    lines.push(
      `## ${escape(title)}`,
      "",
      ...body.map(escape),
      "",
      `Sources: ${ids.map(escape).join(", ")}`,
      "",
    );
    search.push(title, ...body);
  };
  add("Reported event", [t.event.label], t.event.citationIds);
  add(
    t.witness.label,
    [
      `Public pseudonym; reported experience: ${t.witness.experienceYears} years, relevant to ${t.witness.relevantTime}.`,
    ],
    t.witness.citationIds,
  );
  for (const a of t.accounts)
    add(
      a.label,
      [
        `Recorded: ${a.recordedYear}; ${t.witness.label}`,
        `Event period: ${a.eventPeriod ?? "Not selected for this account"}`,
        a.content ?? a.contentNotice!,
        `Under oath: ${a.oath}`,
      ],
      a.citationIds,
    );
  const r = t.review;
  add(
    r.title,
    [
      r.summary,
      `${r.reviewerLabel} · ${r.status} · ${r.outcome} · ${r.revision}`,
      `Independent witnesses: ${r.independence}`,
      r.method,
    ],
    r.citationIds,
  );
  lines.push(...t.limitations.map(escape));
  search.push(...t.limitations);
  return formatPublicCaseOutputs(result.data, lines, search);
}
