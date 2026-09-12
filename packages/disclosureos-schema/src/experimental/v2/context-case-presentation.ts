import { z } from "zod";
import {
  parseObservationContext,
  parseContextClaimHistory,
  parseCaseRecord,
  contextAssertions,
  caseSnapshotKey,
  type DocumentSnapshotRef,
} from "@disclosureos/records/experimental/v2";
import { evaluateContextClaimHistory } from "./context-review";
import {
  CasePresentationSchema,
  parseCasePresentation,
  buildPublicCase,
  formatPublicCaseOutputs,
  type PublicCasePayload,
  type CasePublicationApproval,
} from "./case-presentation";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const text = z.string().min(1).max(20000).regex(/\S/);
const hash = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const ref = (schemaId: string) =>
  z.strictObject({
    documentId: id,
    schemaId: z.literal(schemaId),
    sha256: hash,
  });
const citationIds = z.array(id).min(1);
const field = z.strictObject({
  id,
  label: text,
  entityId: id,
  field: z.enum(["name", "shape", "alignmentDescription"]),
  assertions: z
    .array(
      z.strictObject({ assertionId: id, attributionLabel: text, citationIds }),
    )
    .min(1),
});
export const CONTEXT_CASE_PRESENTATION_SCHEMA_ID =
  "urn:disclosureos:experimental:context-case-presentation:0.1.0";
/** Explicit, bounded context selection around the existing editorial presentation. */
export const ContextCasePresentationSchema = z.strictObject({
  kind: z.literal("context_case_presentation"),
  schemaVersion: z.literal("0.1.0"),
  presentation: CasePresentationSchema,
  context: z.strictObject({
    document: ref("urn:disclosureos:experimental:observation-context:0.1.0"),
    history: ref("urn:disclosureos:experimental:claim-history:0.2.0"),
    fields: z.array(field),
    measurements: z.array(
      z.strictObject({
        id,
        label: text,
        entityId: id,
        bindingId: id,
        citationIds,
      }),
    ),
    tracks: z.array(
      z.strictObject({
        id,
        label: text,
        collectionId: id,
        assertionId: id,
        productId: id,
        citationIds,
      }),
    ),
    reviews: z.array(
      z.strictObject({
        id,
        claimId: id,
        fieldId: id,
        title: text,
        summary: text,
        reviewerLabel: text,
        methodLabel: text,
        citationIds,
      }),
    ),
  }),
});
export type ContextCasePresentation = z.infer<
  typeof ContextCasePresentationSchema
>;
export function contextCasePresentationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ContextCasePresentationSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: CONTEXT_CASE_PRESENTATION_SCHEMA_ID,
  };
}
export function parseContextCasePresentation(input: unknown) {
  const p = ContextCasePresentationSchema.safeParse(input);
  if (!p.success || !parseCasePresentation(p.data.presentation).success)
    return { success: false as const };
  const c = p.data.context;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    ![c.fields, c.measurements, c.tracks, c.reviews].every((xs) =>
      unique(xs.map((x) => x.id)),
    )
  )
    return { success: false as const };
  const ids = new Set(p.data.presentation.citations.map((c) => c.id));
  const selections = [
    ...c.fields.flatMap((f) => f.assertions),
    ...c.measurements,
    ...c.tracks,
    ...c.reviews,
  ];
  if (
    selections.some(
      (s) => !unique(s.citationIds) || s.citationIds.some((i) => !ids.has(i)),
    )
  )
    return { success: false as const };
  if (
    c.fields.some((f) => !unique(f.assertions.map((a) => a.assertionId))) ||
    c.reviews.some((r) => !c.fields.some((f) => f.id === r.fieldId))
  )
    return { success: false as const };
  return { success: true as const, data: p.data };
}
export interface PublicContextSelection {
  fields: Array<{
    id: string;
    label: string;
    assertions: Array<{
      id: string;
      state: string;
      value?: string;
      reason?: string;
      attributionLabel: string;
      citationIds: string[];
    }>;
    reviewIds: string[];
  }>;
  measurements: Array<{
    id: string;
    label: string;
    value: number;
    unit: string;
    uncertainty: string;
    method: string;
    citationIds: string[];
  }>;
  tracks: Array<{
    id: string;
    label: string;
    format: string;
    citationIds: string[];
  }>;
  reviews: Array<{
    id: string;
    fieldId: string;
    title: string;
    summary: string;
    reviewerLabel: string;
    status: "assessed" | "unassessed";
    outcome?: string;
    revision: "current" | "superseded";
    method: string;
    citationIds: string[];
  }>;
  limitations: string[];
}
export type PublicContextCasePayload = Omit<
  PublicCasePayload,
  "schemaVersion"
> & { schemaVersion: "0.2.0"; context: PublicContextSelection };
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

/** No fetching. Approval covers exact envelope bytes, including selected snapshot identities.
 * Access labels do not grant disclosure. Only selected primitives and approved editorial labels leave this function. */
export async function buildPublicContextCase(
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
  let parsed: ReturnType<typeof parseContextCasePresentation>;
  try {
    parsed = parseContextCasePresentation(decode(inputBytes));
  } catch {
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  }
  if (!parsed.success)
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  const d = parsed.data,
    selection = d.context;
  // Capture selected context/history dependencies before the first await.
  const copies = new Map<string, Uint8Array>();
  const copy = (ref: DocumentSnapshotRef) => {
    const b = options.documents.get(ref.sha256);
    if (b && !copies.has(ref.sha256))
      copies.set(ref.sha256, Uint8Array.from(b));
  };
  [selection.document, selection.history, d.presentation.caseRef].forEach(copy);
  try {
    const h = parseContextClaimHistory(
      decode(copies.get(selection.history.sha256)!),
    );
    if (!h.success) return invalid();
    for (const r of h.data.contextRefs) {
      copy(r);
      const c = parseObservationContext(decode(copies.get(r.sha256)!));
      if (!c.success) return invalid();
      copy(c.data.observationRef);
      if (c.data.acquisitionRef) copy(c.data.acquisitionRef);
    }
    // Capture the base graph before awaiting. Its approval is derived only after
    // the full envelope approval passes below.
    const baseDocuments = new Map<string, Uint8Array>();
    // Base graph capture is handled by buildPublicCase; use an immutable view for its delayed call.
    // Only supplied objects named by the base case/history/link graph are included.
    const pending: DocumentSnapshotRef[] = [
      d.presentation.caseRef,
      ...d.presentation.findings.map((f) => f.historyRef),
      ...(d.presentation.linksRef ? [d.presentation.linksRef] : []),
    ];
    for (let i = 0; i < pending.length; i++) {
      const r = pending[i]!;
      if (baseDocuments.has(r.sha256)) continue;
      const b = options.documents.get(r.sha256);
      if (!b) return invalid();
      const captured = Uint8Array.from(b);
      baseDocuments.set(r.sha256, captured);
      // Known graph edges only; the base builder validates their schema and identity.
      const value = decode(captured) as {
        observationRefs?: DocumentSnapshotRef[];
        caseRefs?: DocumentSnapshotRef[];
        links?: Array<{
          kind: string;
          document: DocumentSnapshotRef;
          reference: { document: DocumentSnapshotRef };
        }>;
      };
      pending.push(...(value.observationRefs ?? []), ...(value.caseRefs ?? []));
      for (const link of value.links ?? [])
        pending.push(
          link.kind === "intake" ? link.document : link.reference.document,
        );
    }
    if ((await digest(inputBytes)) !== approval.data.presentationSha256)
      return { success: false as const, code: "APPROVAL_REQUIRED" as const };
    const baseBytes = bytes(d.presentation);
    const base = await buildPublicCase(baseBytes, {
      documents: baseDocuments,
      approval: {
        presentationSha256: await digest(baseBytes),
        policyVersion: approval.data.policyVersion,
      },
    });
    if (!base.success) return base;
    const load = async (ref: DocumentSnapshotRef) => {
      const b = copies.get(ref.sha256);
      if (!b || (await digest(b)) !== ref.sha256) throw new Error("reference");
      const v = decode(b) as { id?: string };
      if (v.id !== ref.documentId) throw new Error("reference");
      return v;
    };
    const context = parseObservationContext(await load(selection.document));
    const history = parseContextClaimHistory(await load(selection.history));
    const owner = parseCaseRecord(await load(d.presentation.caseRef));
    if (!context.success || !history.success || !owner.success)
      return invalid();
    if (
      !owner.data.observationRefs.some(
        (r) =>
          caseSnapshotKey(r) === caseSnapshotKey(context.data.observationRef),
      ) ||
      !history.data.contextRefs.some(
        (r) => caseSnapshotKey(r) === caseSnapshotKey(selection.document),
      )
    )
      return invalid();
    const result = await evaluateContextClaimHistory(history.data, {
      documents: copies,
    });
    if (!result.success) return invalid();
    const observation = history.data.observation;
    if (observation.id !== context.data.observationRef.documentId)
      return invalid();
    const citeRefs = (ids: string[], required: string[]) => {
      const selected = ids.map(
        (id) => d.presentation.citations.find((c) => c.id === id)!.target,
      );
      if (
        required.some(
          (ref) =>
            !selected.some(
              (t) =>
                t.kind === "artifact" &&
                t.observationId === observation.id &&
                t.ref === ref,
            ),
        )
      )
        throw new Error("citation");
    };
    const publicContext: PublicContextSelection = {
      fields: [],
      measurements: [],
      tracks: [],
      reviews: [],
      limitations: [
        "Source descriptions and numeric readings retain their supplied scope. Snapshot checks do not establish source authenticity or scientific validity.",
        "The selected tracks are separate records. Clock alignment and multi-sensor fusion have not been verified.",
      ],
    };
    for (const f of selection.fields) {
      const entity = context.data.entities.find((e) => e.id === f.entityId);
      const allowed = {
        name: "place",
        shape: "reported_object",
        alignmentDescription: "collection",
      };
      if (
        !entity ||
        entity.kind !== allowed[f.field] ||
        entity.selections?.some((s) => s.field === f.field)
      )
        return invalid();
      const assertions: PublicContextSelection["fields"][number]["assertions"] =
        [];
      for (const chosen of f.assertions) {
        const a = contextAssertions(entity).find(
          (a) => a.field === f.field && a.assertion.id === chosen.assertionId,
        )?.assertion;
        if (!a || !["known", "unknown"].includes(a.content.state))
          return invalid();
        const value = a.content.value;
        if (value !== undefined && typeof value !== "string") return invalid();
        citeRefs(
          chosen.citationIds,
          a.content.provenance ? [a.content.provenance.sourceRef] : [],
        );
        assertions.push({
          id: chosen.assertionId,
          state: a.content.state,
          ...(typeof value === "string" ? { value } : {}),
          ...(a.content.state === "unknown" && "reason" in a.content && typeof a.content.reason === "string"
            ? { reason: a.content.reason }
            : {}),
          attributionLabel: chosen.attributionLabel,
          citationIds: [...chosen.citationIds],
        });
      }
      publicContext.fields.push({
        id: f.id,
        label: f.label,
        assertions,
        reviewIds: selection.reviews
          .filter((r) => r.fieldId === f.id)
          .map((r) => r.id),
      });
    }
    for (const m of selection.measurements) {
      const entity = context.data.entities.find(
        (e) => e.id === m.entityId && e.kind === "environment",
      );
      const binding =
        entity && "measurements" in entity
          ? entity.measurements?.find((mb) => mb.id === m.bindingId)
          : undefined;
      if (!binding || binding.role !== "ambient_temperature") return invalid();
      const measurement = observation.measurements.find(
        (m) => m.id === binding.measurementId,
      );
      if (!measurement || measurement.selection) return invalid();
      const u = measurement.value.uncertainty;
      citeRefs(m.citationIds, [
        ...measurement.sourceRefs,
        ...(u.kind === "unknown" ? [] : u.sourceRefs),
      ]);
      // Measurement selection methods compare assertions; they are not acquisition methods.
      publicContext.measurements.push({
        id: m.id,
        label: m.label,
        value: measurement.value.value,
        unit: measurement.value.unit,
        uncertainty:
          u.kind === "unknown"
            ? `Unknown (${u.reason.replace(/_/g, " ")})`
            : `${u.kind}: ${u.magnitude} ${u.unit}${u.kind === "expanded" ? `; coverage factor ${u.coverageFactor}${u.coverageProbability === undefined ? "" : `; coverage probability ${u.coverageProbability}`}` : ""}`,
        method:
          "An acquisition method is not supplied by this measurement binding.",
        citationIds: [...m.citationIds],
      });
    }
    for (const t of selection.tracks) {
      const entity = context.data.entities.find(
        (e) => e.id === t.collectionId && e.kind === "collection",
      );
      const assertion =
        entity &&
        contextAssertions(entity).find(
          (a) => a.field === "productRefs" && a.assertion.id === t.assertionId,
        )?.assertion;
      if (
        !assertion ||
        !Array.isArray(assertion.content.value) ||
        !assertion.content.value.includes(`product:${t.productId}`)
      )
        return invalid();
      const product = observation.products.find((p) => p.id === t.productId);
      if (!product) return invalid();
      citeRefs(t.citationIds, [`product:${product.id}`]);
      publicContext.tracks.push({
        id: t.id,
        label: t.label,
        format: product.format,
        citationIds: [...t.citationIds],
      });
    }
    for (const r of selection.reviews) {
      const claim = history.data.claims.find((c) => c.id === r.claimId);
      const selectedField = selection.fields.find((f) => f.id === r.fieldId)!;
      if (
        !claim ||
        claim.kind !== "assessment" ||
        claim.subject.kind !== "context"
      )
        return invalid();
      const subject = claim.subject.reference;
      if (
        caseSnapshotKey(subject.document) !==
          caseSnapshotKey(selection.document) ||
        subject.target.id !== selectedField.entityId ||
        subject.target.field !== selectedField.field
      )
        return invalid();
      // Every contextual input must be visible among this field's selected assertions.
      if (
        (claim.contextInputRefs ?? []).some(
          (i) =>
            caseSnapshotKey(i.document) !==
              caseSnapshotKey(selection.document) ||
            i.target.id !== selectedField.entityId ||
            i.target.field !== selectedField.field ||
            !selectedField.assertions.some(
              (a) => a.assertionId === i.assertionId,
            ),
        )
      )
        return invalid();
      // This first bounded reader supports direct artifact inputs only; no hidden claim chains.
      if (claim.inputRefs.some((i) => !/^(source|product):/.test(i)))
        return invalid();
      citeRefs(r.citationIds, claim.inputRefs);
      publicContext.reviews.push({
        id: r.id,
        fieldId: r.fieldId,
        title: r.title,
        summary: r.summary,
        reviewerLabel: r.reviewerLabel,
        status: claim.status,
        ...(claim.status === "assessed" ? { outcome: claim.outcome } : {}),
        revision: result.currentClaimRefs.includes(`claim:${claim.id}`)
          ? "current"
          : "superseded",
        method:
          claim.status === "assessed"
            ? `${r.methodLabel} (version ${claim.methodVersion})`
            : "No assessment method supplied.",
        citationIds: [...r.citationIds],
      });
    }
    return {
      success: true as const,
      data: {
        ...base.data,
        schemaVersion: "0.2.0" as const,
        assessmentNotice:
          "These are attributed assessments. Reference checks do not independently verify their conclusions.",
        context: publicContext,
      },
    };
  } catch {
    return invalid();
  }
}

export async function buildPublicContextCaseOutputs(
  input: Uint8Array,
  options: Parameters<typeof buildPublicContextCase>[1],
) {
  const result = await buildPublicContextCase(input, options);
  if (!result.success) return result;
  const c = result.data.context,
    escape = (s: string) => s.replace(/[!-/:-@\[-`{-~]/g, "\\$&");
  const lines: string[] = [],
    search: string[] = [];
  const add = (title: string, body: string[], citations: string[]) => {
    lines.push(
      `## ${escape(title)}`,
      "",
      ...body.map(escape),
      "",
      `Sources: ${citations.map(escape).join(", ")}`,
      "",
    );
    search.push(title, ...body);
  };
  for (const f of c.fields)
    add(
      f.label,
      f.assertions.map(
        (a) =>
          `${a.value ?? a.state}${a.reason ? ` (${a.reason})` : ""} · ${a.attributionLabel}`,
      ),
      [...new Set(f.assertions.flatMap((a) => a.citationIds))],
    );
  for (const m of c.measurements)
    add(
      m.label,
      [`${m.value} ${m.unit}`, `Uncertainty: ${m.uncertainty}`, m.method],
      m.citationIds,
    );
  for (const t of c.tracks)
    add(t.label, [`Separate product: ${t.format}`], t.citationIds);
  for (const r of c.reviews)
    add(
      r.title,
      [
        r.summary,
        `${r.reviewerLabel} · ${r.status} · ${r.outcome ?? ""} · ${r.revision}`,
        r.method,
      ],
      r.citationIds,
    );
  lines.push(...c.limitations.map(escape));
  search.push(...c.limitations);
  return formatPublicCaseOutputs(result.data, lines, search);
}
