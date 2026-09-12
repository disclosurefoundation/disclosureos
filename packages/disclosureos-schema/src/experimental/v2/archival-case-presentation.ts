import { z } from "zod";
import {
  parseArchivalEntities,
  parseArchivalClaimHistory,
  parseCaseRecord,
  researchEntityAssertions,
  caseSnapshotKey,
  type DocumentSnapshotRef,
  type ArchivalEntity,
  type EditionCitation,
} from "@disclosureos/records/experimental/v2";
import { evaluateArchivalClaimHistory } from "./archival-review";
import { capturePresentationSnapshots } from "./presentation-snapshots";
import {
  CasePresentationSchema,
  parseCasePresentation,
  buildPublicCase,
  formatPublicCaseOutputs,
  type CasePublicationApproval,
  type PublicCasePayload,
} from "./case-presentation";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  text = z.string().min(1).max(20000).regex(/\S/),
  hash = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const ref = (schema: string) =>
  z.strictObject({
    documentId: id,
    schemaId: z.literal(`urn:disclosureos:experimental:${schema}`),
    sha256: hash,
  });
const citationIds = z.array(id).min(1);
const fieldNames = [
  "originalClassification",
  "classificationLevel",
  "redactionLevel",
  "redactionDescription",
  "redactionPercent",
] as const;
const labels: Record<(typeof fieldNames)[number], string> = {
  originalClassification: "Original marking",
  classificationLevel: "Current marking",
  redactionLevel: "Redactions",
  redactionDescription: "Redaction description",
  redactionPercent: "Redaction percentage",
};
export const ARCHIVAL_CASE_PRESENTATION_SCHEMA_ID =
  "urn:disclosureos:experimental:archival-case-presentation:0.1.0";
export const ArchivalCasePresentationSchema = z.strictObject({
  kind: z.literal("archival_case_presentation"),
  schemaVersion: z.literal("0.1.0"),
  presentation: CasePresentationSchema,
  archival: z.strictObject({
    document: ref("research-entities:0.2.0"),
    history: ref("claim-history:0.4.0"),
    editions: z
      .array(
        z.strictObject({
          id,
          label: text,
          entityId: id,
          titleAssertionId: id,
          pageCountAssertionId: id,
          attachmentId: id.optional(),
          citationIds,
          fields: z.array(
            z.strictObject({ field: z.enum(fieldNames), assertionId: id }),
          ),
          events: z.array(
            z.strictObject({
              id,
              entityId: id,
              typeAssertionId: id,
              dateAssertionId: id,
              citationIds,
            }),
          ),
          digital: z.strictObject({
            entityId: id,
            custodyStatusAssertionId: id.optional(),
            declaredHashesAssertionId: id.optional(),
            actions: z.array(
              z.strictObject({
                id,
                entityId: id,
                actionAssertionId: id,
                dateAssertionId: id,
                citationIds,
              }),
            ),
          }),
        }),
      )
      .min(1),
    passages: z.array(
      z.strictObject({ id, claimId: id, attributionLabel: text, citationIds }),
    ),
    review: z.strictObject({
      id,
      claimId: id,
      title: text,
      summary: text,
      reviewerLabel: text,
      methodLabel: text,
      citationIds,
    }),
  }),
});
export function archivalCasePresentationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ArchivalCasePresentationSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: ARCHIVAL_CASE_PRESENTATION_SCHEMA_ID,
  };
}
export function parseArchivalCasePresentation(input: unknown) {
  const p = ArchivalCasePresentationSchema.safeParse(input);
  if (!p.success || !parseCasePresentation(p.data.presentation).success)
    return { success: false as const };
  const s = p.data.archival,
    unique = (xs: string[]) => new Set(xs).size === xs.length,
    citations = new Set(p.data.presentation.citations.map((c) => c.id));
  const lists = [
    s.editions,
    s.passages,
    ...s.editions.flatMap((e) => [e.events, e.digital.actions]),
  ];
  if (
    lists.some((xs) => !unique(xs.map((x) => x.id))) ||
    !unique(s.editions.map((e) => e.entityId)) ||
    !unique(s.editions.map((e) => e.digital.entityId)) ||
    !unique(s.passages.map((p) => p.claimId))
  )
    return { success: false as const };
  if (
    s.editions.some(
      (e) =>
        !unique(e.fields.map((f) => f.field)) ||
        !unique(e.events.map((x) => x.entityId)) ||
        !unique(e.digital.actions.map((x) => x.entityId)),
    )
  )
    return { success: false as const };
  if (
    [
      ...s.editions,
      ...s.editions.flatMap((e) => [...e.events, ...e.digital.actions]),
      ...s.passages,
      s.review,
    ].some(
      (x) =>
        !unique(x.citationIds) || x.citationIds.some((i) => !citations.has(i)),
    )
  )
    return { success: false as const };
  return { success: true as const, data: p.data };
}
type PublicValue = { state: "known" | "unknown"; value: string };
export interface PublicArchivalSelection {
  editions: Array<{
    id: string;
    label: string;
    title: string;
    pages: number;
    sourceCitationId: string;
    citationIds: string[];
    fields: Array<PublicValue & { id: string; label: string }>;
    events: Array<
      PublicValue & { id: string; type: string; citationIds: string[] }
    >;
    digital: {
      sha256: string;
      attachmentId?: string;
      custodyStatus?: PublicValue;
      declaredHashes: Array<{
        algorithm: string;
        value: string;
        scope: "unavailable_original";
      }>;
      actions: Array<{
        id: string;
        action: string;
        occurredAt: PublicValue;
        predecessor:
          | { kind: "action"; id: string }
          | { kind: "start" }
          | { kind: "unknown" };
        citationIds: string[];
      }>;
    };
  }>;
  passages: Array<{
    id: string;
    text: string;
    attributionLabel: string;
    editionId: string;
    page: number;
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
    method: string;
    inputs: Array<{ editionId: string; page: number }>;
    citationIds: string[];
  };
  limitations: string[];
}
export type PublicArchivalCasePayload = Omit<
  PublicCasePayload,
  "schemaVersion"
> & { schemaVersion: "0.4.0"; archival: PublicArchivalSelection };
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)),
  decode = (b: Uint8Array): unknown =>
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
/** Only selected edition declarations, page-bound passages and attributed review details are public. No fetching. */
export async function buildPublicArchivalCase(
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
  let parsed: ReturnType<typeof parseArchivalCasePresentation>;
  try {
    parsed = parseArchivalCasePresentation(decode(inputBytes));
  } catch {
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  }
  if (!parsed.success)
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  const d = parsed.data,
    s = d.archival;
  try {
    const copies = capturePresentationSnapshots(options.documents, [
      s.document,
      s.history,
      d.presentation.caseRef,
      ...d.presentation.findings.map((f) => f.historyRef),
      ...(d.presentation.linksRef ? [d.presentation.linksRef] : []),
    ]);
    if ((await digest(inputBytes)) !== approval.data.presentationSha256)
      return { success: false as const, code: "APPROVAL_REQUIRED" as const };
    const baseBytes = bytes(d.presentation),
      base = await buildPublicCase(baseBytes, {
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
    const entities = parseArchivalEntities(await load(s.document)),
      history = parseArchivalClaimHistory(await load(s.history)),
      owner = parseCaseRecord(await load(d.presentation.caseRef));
    if (!entities.success || !history.success || !owner.success)
      return invalid();
    const same = (a: DocumentSnapshotRef, b: DocumentSnapshotRef) =>
      caseSnapshotKey(a) === caseSnapshotKey(b);
    if (
      !owner.data.observationRefs.some((r) =>
        same(r, entities.data.observationRef),
      ) ||
      !history.data.entityRefs.some((r) => same(r, s.document))
    )
      return invalid();
    const evaluation = await evaluateArchivalClaimHistory(history.data, {
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
      entity: ArchivalEntity,
      field: string,
      assertionId: string,
      ids: string[],
    ) => {
      const list = researchEntityAssertions(entity).filter(
        (a) => a.field === field,
      );
      if (list.length !== 1) throw Error("multiple declarations");
      const a = list.find((a) => a.assertion.id === assertionId)?.assertion
        .content;
      if (!a || !["known", "unknown"].includes(a.state)) throw Error("state");
      cite(ids, a.provenance ? [a.provenance.sourceRef] : []);
      return a;
    };
    type Content = ReturnType<typeof assertion>;
    const value = (c: Content, date = false): PublicValue => {
      if (c.state === "unknown" && "reason" in c)
        return {
          state: "unknown",
          value: `Unknown (${String(c.reason).replace(/_/g, " ")})`,
        };
      if (date) {
        const p = z
          .strictObject({ kind: z.literal("date"), value: z.string() })
          .safeParse(c.value);
        if (!p.success) throw Error("date precision");
        return { state: "known", value: p.data.value };
      }
      if (typeof c.value !== "string" && typeof c.value !== "number")
        throw Error("value");
      return { state: "known", value: String(c.value) };
    };
    const knownString = (c: Content) => {
      if (c.state !== "known" || typeof c.value !== "string")
        throw Error("value");
      return c.value;
    };
    const publicEditions: PublicArchivalSelection["editions"] = [];
    for (const e of s.editions) {
      const edition = entities.data.entities.find(
          (x) => x.kind === "source_edition" && x.id === e.entityId,
        ),
        digital = entities.data.entities.find(
          (x) => x.kind === "digital_artifact" && x.id === e.digital.entityId,
        );
      if (
        edition?.kind !== "source_edition" ||
        digital?.kind !== "digital_artifact" ||
        edition.artifact.sourceRef !== digital.artifact.sourceRef ||
        edition.artifact.digest.value !== digital.artifact.digest.value
      )
        return invalid();
      cite(e.citationIds, [edition.artifact.sourceRef]);
      const title = knownString(
          assertion(edition, "title", e.titleAssertionId, e.citationIds),
        ),
        pages = assertion(
          edition,
          "pageCount",
          e.pageCountAssertionId,
          e.citationIds,
        );
      if (pages.state !== "known" || typeof pages.value !== "number")
        return invalid();
      if (e.attachmentId) {
        const a = d.presentation.attachments.find(
          (a) => a.id === e.attachmentId,
        );
        if (
          !a ||
          a.observationId !== observationId ||
          a.ref !== edition.artifact.sourceRef ||
          a.sha256 !== edition.artifact.digest.value
        )
          return invalid();
      }
      const fields = e.fields.map((f) => ({
        id: f.field,
        label: labels[f.field],
        ...value(assertion(edition, f.field, f.assertionId, e.citationIds)),
      }));
      const events: PublicArchivalSelection["editions"][number]["events"] = [];
      for (const event of e.events) {
        const entry = entities.data.entities.find(
          (x) => x.kind === "document_event" && x.id === event.entityId,
        );
        if (entry?.kind !== "document_event" || entry.editionId !== edition.id)
          return invalid();
        const type = knownString(
          assertion(
            entry,
            "eventType",
            event.typeAssertionId,
            event.citationIds,
          ),
        );
        if (!["release", "declassification"].includes(type)) return invalid();
        events.push({
          id: event.id,
          type,
          ...value(
            assertion(
              entry,
              "occurredAt",
              event.dateAssertionId,
              event.citationIds,
            ),
            true,
          ),
          citationIds: [...event.citationIds],
        });
      }
      const custodyStatus = e.digital.custodyStatusAssertionId
        ? value(
            assertion(
              digital,
              "custodyStatus",
              e.digital.custodyStatusAssertionId,
              e.citationIds,
            ),
          )
        : undefined;
      const declaredHashes: PublicArchivalSelection["editions"][number]["digital"]["declaredHashes"] =
        [];
      if (e.digital.declaredHashesAssertionId) {
        const content = assertion(
          digital,
          "declaredHashes",
          e.digital.declaredHashesAssertionId,
          e.citationIds,
        );
        const hashes = z
          .array(
            z.object({
              hash: z.object({
                algorithm: z.literal("md5"),
                value: z.string().regex(/^[a-fA-F0-9]{32}$/),
              }),
              appliesTo: z.object({ kind: z.literal("unavailable_original") }),
            }),
          )
          .min(1)
          .safeParse(content.value);
        if (content.state !== "known" || !hashes.success) return invalid();
        for (const h of hashes.data)
          declaredHashes.push({
            algorithm: h.hash.algorithm,
            value: h.hash.value,
            scope: "unavailable_original",
          });
      }
      const actions: PublicArchivalSelection["editions"][number]["digital"]["actions"] =
        [];
      for (const chosen of e.digital.actions) {
        const a = entities.data.entities.find(
          (x) =>
            x.kind === "digital_custody_action" && x.id === chosen.entityId,
        );
        if (a?.kind !== "digital_custody_action" || a.artifactId !== digital.id)
          return invalid();
        let predecessor: (typeof actions)[number]["predecessor"];
        if (a.predecessor.kind === "action") {
          const parentId = a.predecessor.id;
          const parent = e.digital.actions.find((x) => x.entityId === parentId);
          if (!parent) return invalid();
          predecessor = { kind: "action", id: parent.id };
        } else predecessor = { kind: a.predecessor.kind };
        actions.push({
          id: chosen.id,
          action: knownString(
            assertion(
              a,
              "action",
              chosen.actionAssertionId,
              chosen.citationIds,
            ),
          ),
          occurredAt: value(
            assertion(
              a,
              "occurredAt",
              chosen.dateAssertionId,
              chosen.citationIds,
            ),
            true,
          ),
          predecessor,
          citationIds: [...chosen.citationIds],
        });
      }
      // Order by explicit predecessor edges, never source-array order. Unknown predecessors stay gaps.
      const ordered: typeof actions = [];
      let pending = [...actions];
      while (pending.length) {
        const ready = pending.filter(
          (a) =>
            a.predecessor.kind !== "action" ||
            ordered.some(
              (x) =>
                a.predecessor.kind === "action" && x.id === a.predecessor.id,
            ),
        );
        if (!ready.length) return invalid();
        ready.sort((a, b) => a.id.localeCompare(b.id));
        ordered.push(...ready);
        pending = pending.filter((a) => !ready.includes(a));
      }
      const sourceCitationId = e.citationIds.find((id) => {
        const t = d.presentation.citations.find((c) => c.id === id)!.target;
        return (
          t.kind === "artifact" &&
          t.observationId === observationId &&
          t.ref === edition.artifact.sourceRef
        );
      })!;
      publicEditions.push({
        id: e.id,
        label: e.label,
        title,
        pages: pages.value,
        sourceCitationId,
        citationIds: [...e.citationIds],
        fields,
        events,
        digital: {
          sha256: edition.artifact.digest.value,
          ...(e.attachmentId ? { attachmentId: e.attachmentId } : {}),
          ...(custodyStatus ? { custodyStatus } : {}),
          declaredHashes,
          actions: ordered,
        },
      });
    }
    const pageCitation = (c: EditionCitation, ids: string[]) => {
      if (!same(c.document, s.document) || c.locator.kind !== "page")
        throw Error("edition");
      const chosen = s.editions.find((e) => e.entityId === c.editionId),
        edition = publicEditions.find((e) => e.id === chosen?.id);
      if (
        !chosen ||
        !edition ||
        edition.digital.sha256 !== c.artifact.digest.value ||
        c.locator.page > edition.pages
      )
        throw Error("edition");
      const raw = entities.data.entities.find(
        (e) => e.kind === "source_edition" && e.id === chosen.entityId,
      );
      if (
        raw?.kind !== "source_edition" ||
        raw.artifact.sourceRef !== c.artifact.sourceRef
      )
        throw Error("artifact");
      cite(ids, [c.artifact.sourceRef]);
      return { editionId: edition.id, page: c.locator.page };
    };
    const passages: PublicArchivalSelection["passages"] = [];
    for (const p of s.passages) {
      const c = history.data.claims.find((c) => c.id === p.claimId);
      if (
        !c ||
        c.kind !== "source_assertion" ||
        !c.editionCitation ||
        c.subject.kind !== "entity" ||
        c.subject.reference.target.kind !== "source_edition" ||
        c.subject.reference.target.id !== c.editionCitation.editionId ||
        !same(c.subject.reference.document, s.document) ||
        c.subject.reference.target.field
      )
        return invalid();
      cite(p.citationIds, [c.provenance.sourceRef]);
      passages.push({
        id: p.id,
        text: c.text,
        attributionLabel: p.attributionLabel,
        ...pageCitation(c.editionCitation, p.citationIds),
        citationIds: [...p.citationIds],
      });
    }
    const r = s.review,
      c = history.data.claims.find((c) => c.id === r.claimId);
    if (
      !c ||
      c.kind !== "assessment" ||
      c.status !== "assessed" ||
      c.topic !== "edition_relationship" ||
      c.subject.kind !== "entity" ||
      c.subject.reference.target.kind !== "source_edition" ||
      c.subject.reference.target.field ||
      !same(c.subject.reference.document, s.document) ||
      !s.editions.some(
        (e) =>
          c.subject.kind === "entity" &&
          e.entityId === c.subject.reference.target.id,
      ) ||
      !c.editionInputRefs?.length ||
      (c.entityInputRefs ?? []).length ||
      (c.contextInputRefs ?? []).length ||
      c.inputRefs.some((i) => !/^source:/.test(i))
    )
      return invalid();
    cite(r.citationIds, c.inputRefs);
    const inputs = c.editionInputRefs.map((i) =>
      pageCitation(i, r.citationIds),
    );
    const archival: PublicArchivalSelection = {
      editions: publicEditions,
      passages,
      review: {
        id: r.id,
        title: r.title,
        summary: r.summary,
        reviewerLabel: r.reviewerLabel,
        status: c.status,
        outcome: c.outcome,
        revision: evaluation.currentClaimRefs.includes(`claim:${c.id}`)
          ? "current"
          : "superseded",
        method: `${r.methodLabel} (version ${c.methodVersion})`,
        inputs,
        citationIds: [...r.citationIds],
      },
      limitations: [
        "Each citation belongs to a specific edition and page. A shared title does not make editions interchangeable.",
        "Release and declassification are separate declarations. A release date does not supply a missing declassification date.",
        "Custody actions follow declared predecessor links. A gap is not a complete chain, and array order is not a timeline.",
        "Checks cover supplied structured snapshots and references. File delivery checks matching bytes separately; neither check establishes authenticity or faithful reproduction.",
        "An MD5 declaration for an unavailable original cannot verify either supplied edition. Unselected fields and checks remain outside this public view.",
      ],
    };
    return {
      success: true as const,
      data: {
        ...base.data,
        schemaVersion: "0.4.0" as const,
        assessmentNotice:
          "These are attributed assessments. Reference checks do not independently verify their conclusions.",
        archival,
      },
    };
  } catch {
    return invalid();
  }
}
export async function buildPublicArchivalCaseOutputs(
  input: Uint8Array,
  options: Parameters<typeof buildPublicArchivalCase>[1],
) {
  const result = await buildPublicArchivalCase(input, options);
  if (!result.success) return result;
  const a = result.data.archival,
    escape = (s: string) => s.replace(/[!-/:-@\[-`{-~]/g, "\\$&"),
    lines: string[] = [],
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
  for (const e of a.editions) {
    add(
      e.label,
      [
        `${e.title}; ${e.pages} pages`,
        ...e.fields.map((f) => `${f.label}: ${f.value}`),
        `Declared file SHA-256: ${e.digital.sha256}`,
        ...(e.digital.custodyStatus
          ? [`Custody: ${e.digital.custodyStatus.value}`]
          : []),
        ...e.digital.declaredHashes.map(
          (h) =>
            `${h.algorithm}: ${h.value}; unavailable original, not verified against this edition`,
        ),
      ],
      e.citationIds,
    );
    for (const event of e.events)
      add(`${e.label}: ${event.type}`, [event.value], event.citationIds);
    for (const action of e.digital.actions)
      add(
        `${e.label}: ${action.action}`,
        [
          `When: ${action.occurredAt.value}`,
          `Predecessor: ${action.predecessor.kind === "action" ? action.predecessor.id : action.predecessor.kind === "unknown" ? "Earlier custody not supplied" : "Declared start"}`,
        ],
        action.citationIds,
      );
  }
  const editionLabel = (id: string) =>
    a.editions.find((e) => e.id === id)!.label;
  for (const p of a.passages)
    add(
      `${editionLabel(p.editionId)}, page ${p.page}`,
      [p.text, p.attributionLabel],
      p.citationIds,
    );
  const r = a.review;
  add(
    r.title,
    [
      r.summary,
      `${r.reviewerLabel} · ${r.outcome} · ${r.revision}`,
      r.method,
      ...r.inputs.map((i) => `${editionLabel(i.editionId)}, page ${i.page}`),
    ],
    r.citationIds,
  );
  lines.push(...a.limitations.map(escape));
  search.push(...a.limitations);
  return formatPublicCaseOutputs(result.data, lines, search);
}
