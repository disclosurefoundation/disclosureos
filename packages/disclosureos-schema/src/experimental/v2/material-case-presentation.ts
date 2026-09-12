import { z } from "zod";
import {
  parseLaboratoryEntities,
  parseLaboratoryClaimHistory,
  parseCaseRecord,
  researchEntityAssertions,
  caseSnapshotKey,
  type DocumentSnapshotRef,
  type LaboratoryEntity,
} from "@disclosureos/records/experimental/v2";
import { evaluateLaboratoryClaimHistory } from "./laboratory-review";
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
const selected = { id, entityId: id, label: text, citationIds };
export const MATERIAL_CASE_PRESENTATION_SCHEMA_ID =
  "urn:disclosureos:experimental:material-case-presentation:0.1.0";
export const MaterialCasePresentationSchema = z.strictObject({
  kind: z.literal("material_case_presentation"),
  schemaVersion: z.literal("0.1.0"),
  presentation: CasePresentationSchema,
  material: z.strictObject({
    document: ref("research-entities:0.4.0"),
    history: ref("claim-history:0.5.0"),
    traces: z.array(
      z.strictObject({ ...selected, descriptionAssertionId: id })
    ),
    specimens: z
      .array(
        z.strictObject({
          ...selected,
          fields: z.array(
            z.strictObject({
              field: z.enum([
                "type",
                "description",
                "collectionTime",
                "reportedCustodyStatus",
              ]),
              assertionId: id,
            })
          ),
          actions: z.array(
            z.strictObject({
              id,
              entityId: id,
              actionAssertionId: id,
              dateAssertionId: id,
              citationIds,
            })
          ),
        })
      )
      .min(1),
    preparations: z.array(
      z.strictObject({
        ...selected,
        methodAssertionId: id,
        dateAssertionId: id,
      })
    ),
    analyses: z
      .array(
        z.strictObject({
          ...selected,
          methodAssertionId: id,
          methodLabel: text,
          dateAssertionId: id,
        })
      )
      .min(1),
    results: z
      .array(
        z.strictObject({
          ...selected,
          resultAssertionId: id,
          analyteAssertionId: id.optional(),
        })
      )
      .min(1),
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
export function materialCasePresentationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MaterialCasePresentationSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: MATERIAL_CASE_PRESENTATION_SCHEMA_ID,
  };
}
export function parseMaterialCasePresentation(input: unknown) {
  const p = MaterialCasePresentationSchema.safeParse(input);
  if (!p.success || !parseCasePresentation(p.data.presentation).success)
    return { success: false as const };
  const s = p.data.material,
    unique = (xs: string[]) => new Set(xs).size === xs.length,
    citations = new Set(p.data.presentation.citations.map((c) => c.id)),
    lists = [
      s.traces,
      s.specimens,
      s.preparations,
      s.analyses,
      s.results,
      ...s.specimens.map((x) => x.actions),
    ];
  if (
    lists.some(
      (xs) => !unique(xs.map((x) => x.id)) || !unique(xs.map((x) => x.entityId))
    ) ||
    s.specimens.some((x) => !unique(x.fields.map((f) => f.field))) ||
    [...lists.flat(), s.review].some(
      (x) =>
        !unique(x.citationIds) || x.citationIds.some((i) => !citations.has(i))
    )
  )
    return { success: false as const };
  return { success: true as const, data: p.data };
}
type PublicValue = { state: "known" | "unknown"; value: string };
type PublicItem = { id: string; label: string; citationIds: string[] };
type Limit = {
  kind: "detection" | "quantification";
  magnitude: number;
  unit: string;
  basis: string;
};
type Uncertainty =
  | { kind: "unknown"; reason: string }
  | {
      kind: "standard" | "bound" | "expanded";
      magnitude: number;
      unit: string;
      coverageFactor?: number;
      coverageProbability?: number;
    };
export interface PublicMaterialSelection {
  traces: Array<PublicItem & { description: string }>;
  specimens: Array<
    PublicItem & {
      lineage:
        | { kind: "collected" | "unknown" }
        | { kind: "derived"; preparationId: string };
      fields: Array<PublicValue & { id: string; label: string }>;
      actions: Array<{
        id: string;
        action: string;
        occurredAt: PublicValue;
        predecessor:
          | { kind: "start" | "unknown" }
          | { kind: "action"; id: string };
        citationIds: string[];
      }>;
    }
  >;
  preparations: Array<
    PublicItem & {
      operation: string;
      inputs: string[];
      outputs: string[];
      method: string;
      occurredAt: PublicValue;
    }
  >;
  analyses: Array<
    PublicItem & {
      inputs: string[];
      preparations: string[];
      resultIds: string[];
      method: string;
      occurredAt: PublicValue;
    }
  >;
  results: Array<
    PublicItem & {
      analysisId: string;
      materialId: string;
      analyte?: PublicValue;
      value:
        | {
            kind: "quantitative";
            quantity: string;
            magnitude: number;
            unit: string;
            uncertainty: Uncertainty;
            limit:
              | { state: "reported"; value: Limit }
              | { state: "unknown" | "not_applicable" };
          }
        | { kind: "below_limit"; limit: Limit }
        | { kind: "qualitative"; text: string };
    }
  >;
  review: {
    id: string;
    title: string;
    summary: string;
    reviewerLabel: string;
    status: "assessed";
    outcome: string;
    revision: "current" | "superseded";
    method: string;
    resultIds: string[];
    citationIds: string[];
  };
  limitations: string[];
}
export type PublicMaterialCasePayload = Omit<
  PublicCasePayload,
  "schemaVersion"
> & { schemaVersion: "0.5.0"; material: PublicMaterialSelection };
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)),
  decode = (b: Uint8Array): unknown =>
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b));
const digest = async (b: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(b)))
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const invalid = () => ({
  success: false as const,
  code: "INVALID_REFERENCES" as const,
});
/** Explicit public projection of specimen lineage and selected results. No source-file fetching or scientific validation. */
export async function buildPublicMaterialCase(
  input: Uint8Array,
  options: {
    documents: ReadonlyMap<string, Uint8Array>;
    approval?: CasePublicationApproval;
  }
) {
  const approval = z
    .strictObject({ presentationSha256: hash, policyVersion: text })
    .safeParse(options.approval);
  if (!approval.success)
    return { success: false as const, code: "APPROVAL_REQUIRED" as const };
  const inputBytes = Uint8Array.from(input);
  let parsed: ReturnType<typeof parseMaterialCasePresentation>;
  try {
    parsed = parseMaterialCasePresentation(decode(inputBytes));
  } catch {
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  }
  if (!parsed.success)
    return { success: false as const, code: "INVALID_PRESENTATION" as const };
  const d = parsed.data,
    s = d.material;
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
    const entities = parseLaboratoryEntities(await load(s.document)),
      history = parseLaboratoryClaimHistory(await load(s.history)),
      owner = parseCaseRecord(await load(d.presentation.caseRef));
    if (!entities.success || !history.success || !owner.success)
      return invalid();
    const same = (a: DocumentSnapshotRef, b: DocumentSnapshotRef) =>
      caseSnapshotKey(a) === caseSnapshotKey(b);
    if (
      !owner.data.observationRefs.some((r) =>
        same(r, entities.data.observationRef)
      ) ||
      !history.data.entityRefs.some((r) => same(r, s.document))
    )
      return invalid();
    const evaluation = await evaluateLaboratoryClaimHistory(history.data, {
      documents: copies,
    });
    if (!evaluation.success) return invalid();
    const observation = history.data.observation;
    // The laboratory evaluator compares the full embedded observation to the entity snapshot.
    const cite = (ids: string[], refs: string[]) => {
      const targets = ids.map(
        (id) => d.presentation.citations.find((c) => c.id === id)!.target
      );
      if (
        refs.some(
          (ref) =>
            !targets.some(
              (t) =>
                t.kind === "artifact" &&
                t.observationId === observation.id &&
                t.ref === ref
            )
        )
      )
        throw Error("citation");
    };
    const entity = <K extends LaboratoryEntity["kind"]>(
      kind: K,
      entityId: string
    ): Extract<LaboratoryEntity, { kind: K }> => {
      const e = entities.data.entities.find(
        (e) => e.kind === kind && e.id === entityId
      );
      if (!e) throw Error("entity");
      return e as Extract<LaboratoryEntity, { kind: K }>;
    };
    const assertion = (
      e: LaboratoryEntity,
      field: string,
      assertionId: string,
      ids: string[]
    ) => {
      const list = researchEntityAssertions(e).filter((a) => a.field === field);
      if (list.length !== 1) throw Error("competing declarations");
      const c = list.find((a) => a.assertion.id === assertionId)?.assertion
        .content;
      if (!c || !["known", "unknown"].includes(c.state)) throw Error("state");
      cite(ids, c.provenance ? [c.provenance.sourceRef] : []);
      return c;
    };
    type Content = ReturnType<typeof assertion>;
    const value = (c: Content, date = false): PublicValue => {
      if (c.state === "unknown")
        return { state: "unknown", value: "Unknown (not supplied)" };
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
    const publicId = (
      list: Array<{ id: string; entityId: string }>,
      entityId: string
    ) => {
      const x = list.find((x) => x.entityId === entityId);
      if (!x) throw Error("unselected dependency");
      return x.id;
    };
    const item = (x: (typeof s.specimens)[number]): PublicItem => ({
      id: x.id,
      label: x.label,
      citationIds: [...x.citationIds],
    });
    const simpleItem = (x: {
      id: string;
      label: string;
      citationIds: string[];
    }): PublicItem => ({
      id: x.id,
      label: x.label,
      citationIds: [...x.citationIds],
    });
    const labels = {
      type: "Material type",
      description: "Description",
      collectionTime: "Collection date",
      reportedCustodyStatus: "Reported custody",
    };
    const specimens: PublicMaterialSelection["specimens"] = s.specimens.map(
      (x) => {
        const e = entity("material", x.entityId);
        const lineage =
          e.lineage.kind === "derived"
            ? {
                kind: "derived" as const,
                preparationId: publicId(
                  s.preparations,
                  e.lineage.preparationId
                ),
              }
            : { kind: e.lineage.kind };
        const actions: PublicMaterialSelection["specimens"][number]["actions"] =
          x.actions.map((a) => {
            const raw = entity("material_custody_action", a.entityId);
            if (raw.materialId !== e.id) throw Error("custody scope");
            const predecessor =
              raw.predecessor.kind === "action"
                ? {
                    kind: "action" as const,
                    id: publicId(x.actions, raw.predecessor.id),
                  }
                : { kind: raw.predecessor.kind };
            return {
              id: a.id,
              action: knownString(
                assertion(raw, "action", a.actionAssertionId, a.citationIds)
              ),
              occurredAt: value(
                assertion(raw, "occurredAt", a.dateAssertionId, a.citationIds),
                true
              ),
              predecessor,
              citationIds: [...a.citationIds],
            };
          });
        const ordered: typeof actions = [];
        let pending = [...actions];
        while (pending.length) {
          const ready = pending.filter(
            (a) =>
              a.predecessor.kind !== "action" ||
              ordered.some(
                (x) =>
                  a.predecessor.kind === "action" && x.id === a.predecessor.id
              )
          );
          if (!ready.length) throw Error("cycle");
          ready.sort((a, b) => a.id.localeCompare(b.id));
          ordered.push(...ready);
          pending = pending.filter((a) => !ready.includes(a));
        }
        return {
          ...item(x),
          lineage,
          fields: x.fields.map((f) => ({
            id: f.field,
            label: labels[f.field],
            ...value(
              assertion(e, f.field, f.assertionId, x.citationIds),
              f.field === "collectionTime"
            ),
          })),
          actions: ordered,
        };
      }
    );
    const preparations: PublicMaterialSelection["preparations"] =
      s.preparations.map((x) => {
        const e = entity("material_preparation", x.entityId);
        return {
          ...simpleItem(x),
          operation: e.operation,
          inputs: e.inputMaterialIds.map((i) => publicId(s.specimens, i)),
          outputs: e.outputMaterialIds.map((i) => publicId(s.specimens, i)),
          method: knownString(
            assertion(e, "method", x.methodAssertionId, x.citationIds)
          ),
          occurredAt: value(
            assertion(e, "performedAt", x.dateAssertionId, x.citationIds),
            true
          ),
        };
      });
    const analyses: PublicMaterialSelection["analyses"] = s.analyses.map(
      (x) => {
        const e = entity("laboratory_analysis", x.entityId),
          c = assertion(e, "method", x.methodAssertionId, x.citationIds),
          m = z
            .strictObject({ methodRef: text, methodVersion: text })
            .safeParse(c.value);
        if (c.state !== "known" || !m.success) throw Error("method");
        return {
          ...simpleItem(x),
          inputs: e.inputMaterialIds.map((i) => publicId(s.specimens, i)),
          preparations: (e.preparationIds ?? []).map((i) =>
            publicId(s.preparations, i)
          ),
          resultIds: e.resultIds.map((i) => publicId(s.results, i)),
          method: `${x.methodLabel} (version ${m.data.methodVersion})`,
          occurredAt: value(
            assertion(e, "performedAt", x.dateAssertionId, x.citationIds),
            true
          ),
        };
      }
    );
    const limit = (v: Limit): Limit => ({
      kind: v.kind,
      magnitude: v.magnitude,
      unit: v.unit,
      basis: v.basis,
    });
    const results: PublicMaterialSelection["results"] = s.results.map((x) => {
      const e = entity("laboratory_result", x.entityId),
        c = assertion(e, "result", x.resultAssertionId, x.citationIds);
      // The parser owns the result union; exact selection above rejects alternatives and non-known states.
      const selected = e.fields.result?.find(
        (a) => a.id === x.resultAssertionId
      )?.content;
      if (c.state !== "known" || selected?.state !== "known")
        throw Error("result");
      const raw = selected.value;
      let result: PublicMaterialSelection["results"][number]["value"];
      if (raw.kind === "quantitative") {
        const m = observation.measurements.find(
          (m) => m.id === raw.measurementId
        );
        if (!m) throw Error("measurement");
        cite(x.citationIds, m.sourceRefs);
        const u = m.value.uncertainty;
        let uncertainty: Uncertainty;
        if (u.kind === "unknown")
          uncertainty = { kind: "unknown", reason: u.reason };
        else {
          cite(x.citationIds, u.sourceRefs);
          uncertainty = {
            kind: u.kind,
            magnitude: u.magnitude,
            unit: u.unit,
            ...(u.kind === "expanded"
              ? {
                  coverageFactor: u.coverageFactor,
                  ...(u.coverageProbability !== undefined
                    ? { coverageProbability: u.coverageProbability }
                    : {}),
                }
              : {}),
          };
        }
        result = {
          kind: raw.kind,
          quantity: m.quantity,
          magnitude: m.value.value,
          unit: m.value.unit,
          uncertainty,
          limit:
            raw.limit.state === "reported"
              ? { state: "reported", value: limit(raw.limit.value) }
              : { state: raw.limit.state },
        };
      } else if (raw.kind === "below_limit")
        result = { kind: raw.kind, limit: limit(raw.limit) };
      else result = { kind: raw.kind, text: raw.text };
      return {
        ...simpleItem(x),
        analysisId: publicId(s.analyses, e.analysisId),
        materialId: publicId(s.specimens, e.materialId),
        ...(x.analyteAssertionId
          ? {
              analyte: value(
                assertion(e, "analyte", x.analyteAssertionId, x.citationIds)
              ),
            }
          : {}),
        value: result,
      };
    });
    const traces = s.traces.map((x) => ({
      ...simpleItem(x),
      description: knownString(
        assertion(
          entity("material_trace", x.entityId),
          "description",
          x.descriptionAssertionId,
          x.citationIds
        )
      ),
    }));
    const r = s.review,
      c = history.data.claims.find((c) => c.id === r.claimId);
    if (
      !c ||
      c.kind !== "assessment" ||
      c.status !== "assessed" ||
      c.topic !== "analytical_limitations" ||
      c.subject.kind !== "entity" ||
      !same(c.subject.reference.document, s.document) ||
      c.subject.reference.target.kind !== "laboratory_result" ||
      c.subject.reference.target.field !== "result" ||
      !c.entityInputRefs?.length ||
      (c.contextInputRefs ?? []).length ||
      (c.editionInputRefs ?? []).length
    )
      return invalid();
    const subjectId = c.subject.reference.target.id;
    const reviewed = c.entityInputRefs.map((i) => {
      if (
        !same(i.document, s.document) ||
        i.target.kind !== "laboratory_result" ||
        i.target.field !== "result"
      )
        throw Error("review scope");
      const chosen = s.results.find(
        (x) =>
          x.entityId === i.target.id && x.resultAssertionId === i.assertionId
      );
      if (!chosen) throw Error("review input");
      return chosen.id;
    });
    if (!c.entityInputRefs.some((i) => i.target.id === subjectId))
      return invalid();
    const refs: string[] = [];
    for (const input of c.inputRefs) {
      if (input.startsWith("source:") || input.startsWith("product:")) {
        refs.push(input);
        continue;
      }
      if (!input.startsWith("measurement:")) return invalid();
      const measurementId = input.slice("measurement:".length);
      if (
        !s.results.some(
          (x) =>
            reviewed.includes(x.id) &&
            entity("laboratory_result", x.entityId).fields.result?.some(
              (a) =>
                a.id === x.resultAssertionId &&
                a.content.state === "known" &&
                a.content.value.kind === "quantitative" &&
                a.content.value.measurementId === measurementId
            )
        )
      )
        return invalid();
      const m = observation.measurements.find((m) => m.id === measurementId);
      if (!m) return invalid();
      refs.push(...m.sourceRefs);
    }
    for (const chosen of s.results.filter((x) => reviewed.includes(x.id))) {
      const a = assertion(
        entity("laboratory_result", chosen.entityId),
        "result",
        chosen.resultAssertionId,
        r.citationIds
      );
      if (a.provenance) refs.push(a.provenance.sourceRef);
    }
    cite(r.citationIds, refs);
    const material: PublicMaterialSelection = {
      traces,
      specimens,
      preparations,
      analyses,
      results,
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
        resultIds: [...new Set(reviewed)],
        citationIds: [...r.citationIds],
      },
      limitations: [
        "Results belong to the analyzed specimen. They do not automatically apply to its parent, sibling aliquots or a nearby trace.",
        "A below-limit result is not zero or absence. A detection threshold is not measurement uncertainty.",
        "Custody follows declared predecessor links; a preparation relationship does not supply missing handoffs.",
        "Reference checks cover supplied structured snapshots. They do not verify physical specimens, report bytes, laboratory execution or scientific conclusions.",
        "Unselected information remains outside this public view. Composition alone does not determine an unusual origin.",
      ],
    };
    return {
      success: true as const,
      data: {
        ...base.data,
        schemaVersion: "0.5.0" as const,
        assessmentNotice:
          "These are attributed assessments. Reference checks do not independently verify their conclusions.",
        material,
      },
    };
  } catch {
    return invalid();
  }
}
export async function buildPublicMaterialCaseOutputs(
  input: Uint8Array,
  options: Parameters<typeof buildPublicMaterialCase>[1]
) {
  const r = await buildPublicMaterialCase(input, options);
  if (!r.success) return r;
  const m = r.data.material,
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
      ""
    );
    search.push(title, ...body);
  };
  const specimen = (id: string) => m.specimens.find((x) => x.id === id)!.label;
  for (const t of m.traces)
    add(
      t.label,
      [t.description, "Trace only; no specimen relationship is inferred."],
      t.citationIds
    );
  for (const s of m.specimens) {
    add(
      s.label,
      [
        `Lineage: ${s.lineage.kind}`,
        ...s.fields.map((f) => `${f.label}: ${f.value}`),
      ],
      s.citationIds
    );
    for (const a of s.actions)
      add(
        `${s.label}: ${a.action}`,
        [
          `When: ${a.occurredAt.value}`,
          `Predecessor: ${
            a.predecessor.kind === "action"
              ? a.predecessor.id
              : a.predecessor.kind === "unknown"
              ? "Earlier custody not supplied"
              : "Declared start"
          }`,
        ],
        a.citationIds
      );
  }
  for (const p of m.preparations)
    add(
      p.label,
      [
        p.operation,
        `Inputs: ${p.inputs.map(specimen).join(", ")}`,
        `Outputs: ${p.outputs.map(specimen).join(", ")}`,
        p.method,
        `When: ${p.occurredAt.value}`,
      ],
      p.citationIds
    );
  for (const a of m.analyses)
    add(
      a.label,
      [
        `Inputs: ${a.inputs.map(specimen).join(", ")}`,
        a.method,
        `When: ${a.occurredAt.value}`,
      ],
      a.citationIds
    );
  for (const x of m.results) {
    const v = x.value,
      body = [
        `Specimen: ${specimen(x.materialId)}`,
        ...(x.analyte ? [`Analyte: ${x.analyte.value}`] : []),
      ];
    const threshold = (l: Limit) =>
      `${l.kind} limit: ${l.magnitude} ${l.unit}; ${l.basis}`;
    if (v.kind === "quantitative") {
      body.push(`${v.quantity}: ${v.magnitude} ${v.unit}`);
      const u = v.uncertainty;
      body.push(
        u.kind === "unknown"
          ? `Uncertainty: unknown (${u.reason})`
          : `Uncertainty: ${u.kind}, ${u.magnitude} ${u.unit}${
              u.kind === "expanded"
                ? `; coverage factor ${u.coverageFactor}${
                    u.coverageProbability !== undefined
                      ? `; coverage probability ${u.coverageProbability}`
                      : ""
                  }`
                : ""
            }`
      );
      body.push(
        v.limit.state === "reported"
          ? threshold(v.limit.value)
          : `Limit: ${v.limit.state}`
      );
    } else if (v.kind === "below_limit")
      body.push(`Below ${threshold(v.limit)}`);
    else body.push(v.text);
    add(x.label, body, x.citationIds);
  }
  add(
    m.review.title,
    [
      m.review.summary,
      `${m.review.reviewerLabel} · ${m.review.outcome} · ${m.review.revision}`,
      m.review.method,
      `Reviewed results: ${m.review.resultIds
        .map((id) => m.results.find((x) => x.id === id)!.label)
        .join(", ")}`,
    ],
    m.review.citationIds
  );
  lines.push(...m.limitations.map(escape));
  search.push(...m.limitations);
  return formatPublicCaseOutputs(r.data, lines, search);
}
