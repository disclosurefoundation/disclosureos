import {
  parseCaseClaimHistory,
  parseCaseRecord,
  parseExperimentalObservation,
  caseSnapshotKey,
  type CaseRecord,
  type CaseEntityTarget,
  type DocumentSnapshotRef,
  type ExperimentalObservation,
  type ContextIssue,
} from "@disclosureos/records/experimental/v2";
import { evaluateCaseRecord, type CaseReviewOptions } from "./case-review";

export interface CaseHistoryReviewResult {
  success: boolean;
  issues: ContextIssue[];
  snapshots: Array<
    DocumentSnapshotRef & { status: "passed" | "failed" | "unavailable" }
  >;
  checks: {
    structural: "passed" | "failed";
    semantic: "passed" | "failed" | "not_checked";
    external: "passed" | "failed" | "not_checked";
    profile: "not_checked";
  };
  currentClaimRefs: string[];
  integrityScope: "supplied_case_and_observation_snapshot_bytes";
  sourceArtifactIntegrity: "not_checked";
  scientificInterpretation: "not_checked";
  temporalNormalization: "not_checked";
  lifecycleChanges: "not_performed";
}
/** Validates declared assessments and their inputs, not the scientific truth of their outcomes. */
export async function evaluateCaseClaimHistory(
  input: unknown,
  options: CaseReviewOptions,
): Promise<CaseHistoryReviewResult> {
  const history = parseCaseClaimHistory(input);
  const result: CaseHistoryReviewResult = {
    success: false,
    issues: [...history.issues],
    snapshots: [],
    checks: { ...history.checks },
    currentClaimRefs: [],
    integrityScope: "supplied_case_and_observation_snapshot_bytes",
    sourceArtifactIntegrity: "not_checked",
    scientificInterpretation: "not_checked",
    temporalNormalization: "not_checked",
    lifecycleChanges: "not_performed",
  };
  if (!history.success) return result;
  const data = history.data,
    copies = new Map<string, Uint8Array>();
  const copy = (hash: string) => {
    if (!copies.has(hash)) {
      const value = options.documents.get(hash);
      if (value) copies.set(hash, Uint8Array.from(value));
    }
  };
  // Discover only the declared cases' observation dependencies before the first await.
  // The peek grants no trust: each case is hashed and fully validated below.
  for (const ref of data.caseRefs) copy(ref.sha256);
  for (const ref of data.caseRefs) {
    try {
      const bytes = copies.get(ref.sha256);
      if (!bytes) continue;
      const peek = parseCaseRecord(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      );
      if (peek.success)
        peek.data.observationRefs.forEach((r) => copy(r.sha256));
    } catch {
      /* Invalid case bytes are reported by the verified loader. */
    }
  }
  const problem = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, stage: "external", pointer, message });
  const snapshots = new Map<
    string,
    CaseHistoryReviewResult["snapshots"][number]
  >();
  async function load(ref: DocumentSnapshotRef, p: string): Promise<unknown> {
    const item = {
      ...ref,
      status: "failed" as "passed" | "failed" | "unavailable",
    };
    snapshots.set(caseSnapshotKey(ref), item);
    const bytes = copies.get(ref.sha256);
    if (!bytes) {
      item.status = "unavailable";
      problem(
        "SNAPSHOT.UNAVAILABLE",
        p,
        "Required snapshot bytes were not supplied.",
      );
      return;
    }
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== ref.sha256) {
      problem(
        "SNAPSHOT.DIGEST",
        p,
        "Supplied bytes differ from the declared digest.",
      );
      return;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      problem("SNAPSHOT.JSON", p, "Snapshot is not valid UTF-8 JSON.");
    }
  }
  const cases = new Map<string, CaseRecord>(),
    observations = new Map<string, ExperimentalObservation>();
  for (const [i, ref] of data.caseRefs.entries()) {
    const p = `/caseRefs/${i}`,
      raw = await load(ref, p);
    if (raw === undefined) continue;
    const parsed = parseCaseRecord(raw);
    if (!parsed.success) {
      problem(
        "SNAPSHOT.CONTRACT",
        p,
        "Case snapshot does not satisfy its declared contract and local semantics.",
      );
      continue;
    }
    if (parsed.data.id !== ref.documentId) {
      problem("SNAPSHOT.IDENTITY", p, "Case ID differs from its reference.");
      continue;
    }
    snapshots.get(caseSnapshotKey(ref))!.status = "passed";
    cases.set(caseSnapshotKey(ref), parsed.data);
    const checked = await evaluateCaseRecord(parsed.data, {
      documents: copies,
    });
    result.issues.push(
      ...checked.issues.map((issue) => ({
        ...issue,
        pointer: p + issue.pointer,
      })),
    );
    for (const snapshot of checked.snapshots)
      snapshots.set(caseSnapshotKey(snapshot), snapshot);
    for (const snapshot of checked.snapshots)
      if (
        snapshot.status === "passed" &&
        !observations.has(caseSnapshotKey(snapshot))
      ) {
        const observation = parseExperimentalObservation(
          JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(
              copies.get(snapshot.sha256)!,
            ),
          ),
        );
        if (observation.success)
          observations.set(caseSnapshotKey(snapshot), observation.data);
      }
  }
  function observation(
    r: { case: DocumentSnapshotRef; observationId: string },
    p: string,
  ) {
    const owner = cases.get(caseSnapshotKey(r.case));
    if (!owner) return;
    const ref = owner.observationRefs.find(
      (s) => s.documentId === r.observationId,
    );
    if (!ref) {
      problem(
        "CASE.OBSERVATION_SCOPE",
        p,
        "Observation is absent from the referenced case revision.",
      );
      return;
    }
    const value = observations.get(caseSnapshotKey(ref));
    return value ? { value, ref } : undefined;
  }
  function entity(
    document: DocumentSnapshotRef,
    target: CaseEntityTarget,
    p: string,
  ) {
    const owner = cases.get(caseSnapshotKey(document));
    if (!owner) return;
    const e = owner.entities.find(
      (e) => e.kind === target.kind && e.id === target.id,
    );
    if (!e) {
      problem(
        "CASE.ENTITY_RESOLUTION",
        p,
        "Case entity identity or kind does not resolve.",
      );
      return;
    }
    if (
      "field" in target &&
      target.field &&
      (!("fields" in e) ||
        !Object.prototype.hasOwnProperty.call(e.fields, target.field))
    )
      problem(
        "CASE.FIELD_RESOLUTION",
        p,
        "Referenced field was not supplied on this entity.",
      );
    return e;
  }
  for (const [i, c] of data.claims.entries()) {
    const p = `/claims/${i}`;
    if (c.subject.kind === "case_entity")
      entity(
        c.subject.reference.document,
        c.subject.reference.target,
        `${p}/subject`,
      );
    if (c.subject.kind === "case_relation") {
      const from = observation(c.subject.from, `${p}/subject/from`),
        to = observation(c.subject.to, `${p}/subject/to`);
      if (from && to && caseSnapshotKey(from.ref) === caseSnapshotKey(to.ref))
        problem(
          "CASE.SELF_RELATION",
          `${p}/subject`,
          "Both relationship endpoints resolve to the same observation snapshot.",
        );
    }
    if (c.kind === "source_assertion") {
      const owner = observation(c.provenance, `${p}/provenance`);
      if (!owner) continue;
      const [kind, id] = c.provenance.sourceRef.split(":");
      const artifact = (
        kind === "source" ? owner.value.sources : owner.value.products
      ).find((a) => a.id === id);
      if (!artifact)
        problem(
          "CASE.SOURCE_SCOPE",
          `${p}/provenance`,
          "Source does not resolve in its declared observation snapshot.",
        );
      else if (
        artifact.digest &&
        c.provenance.sourceDigest &&
        artifact.digest.value !== c.provenance.sourceDigest.value
      )
        problem(
          "SOURCE.DIGEST_MISMATCH",
          `${p}/provenance`,
          "Source digest declarations disagree; source bytes are not checked.",
        );
    } else {
      for (const [j, r] of (c.caseInputRefs ?? []).entries()) {
        const q = `${p}/caseInputRefs/${j}`,
          e = entity(r.document, r.target, q);
        if (!e) continue;
        if (r.kind === "case_assertion") {
          const fields =
            "fields" in e
              ? (e.fields as Record<string, Array<{ id: string }> | undefined>)
              : undefined;
          if (!fields?.[r.target.field]?.some((a) => a.id === r.assertionId))
            problem(
              "CASE.ASSERTION_RESOLUTION",
              q,
              "Assertion must belong to the selected entity field in the pinned case.",
            );
        }
      }
      for (const [j, r] of (c.observationInputRefs ?? []).entries()) {
        const q = `${p}/observationInputRefs/${j}`,
          o = observation(r, q)?.value;
        if (!o) continue;
        const [kind, id] = r.ref.split(":");
        const rows =
          kind === "source"
            ? o.sources
            : kind === "product"
              ? o.products
              : kind === "assertion"
                ? o.assertions
                : o.measurements;
        if (!rows.some((e) => e.id === id))
          problem(
            "CASE.INPUT_RESOLUTION",
            q,
            "Input is absent from its scoped observation snapshot.",
          );
      }
      if (c.status === "assessed") {
        const o = observation(c.methodRef, `${p}/methodRef`)?.value;
        if (!o) continue;
        const method = o.methods.find((m) => m.id === c.methodRef.methodId);
        if (!method)
          problem(
            "CASE.METHOD_RESOLUTION",
            `${p}/methodRef`,
            "Assessment method is absent from its scoped observation.",
          );
        else if (method.version !== c.methodVersion)
          problem(
            "METHOD.VERSION_MISMATCH",
            `${p}/methodVersion`,
            "Method version differs from the pinned observation declaration.",
          );
      }
    }
  }
  result.success = result.issues.length === 0;
  result.checks.external = result.success ? "passed" : "failed";
  result.currentClaimRefs = result.success ? history.currentClaimRefs : [];
  result.snapshots = [...snapshots.values()];
  return result;
}
