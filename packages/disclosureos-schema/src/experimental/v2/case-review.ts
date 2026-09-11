import {
  parseCaseRecord,
  caseProvenances,
  parseExperimentalObservation,
  type DocumentSnapshotRef,
  type ContextIssue,
  type ExperimentalObservation,
} from "@disclosureos/records/experimental/v2";

export interface CaseReviewOptions {
  /** Exact UTF-8 document bytes keyed by SHA-256. Only explicitly scoped snapshots are read. */
  documents: ReadonlyMap<string, Uint8Array>;
}
export interface CaseReviewResult {
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
  declaredChronology: "acyclic" | "failed" | "incomplete" | "not_checked";
  integrityScope: "supplied_observation_snapshot_bytes";
  sourceArtifactIntegrity: "not_checked";
  scientificInterpretation: "not_checked";
  temporalNormalization: "not_checked";
}
/** Resolves the case's closed observation scope. Does not fetch URLs, authenticate sources or assess relationships. */
export async function evaluateCaseRecord(
  input: unknown,
  options: CaseReviewOptions,
): Promise<CaseReviewResult> {
  const parsed = parseCaseRecord(input);
  const result: CaseReviewResult = {
    success: false,
    issues: [...parsed.issues],
    snapshots: [],
    checks: { ...parsed.checks },
    declaredChronology: parsed.issues.some(
      (i) => i.code === "CASE.CHRONOLOGY_CYCLE",
    )
      ? "failed"
      : "not_checked",
    integrityScope: "supplied_observation_snapshot_bytes",
    sourceArtifactIntegrity: "not_checked",
    scientificInterpretation: "not_checked",
    temporalNormalization: "not_checked",
  };
  if (!parsed.success) return result;
  const data = parsed.data;
  // Copy all used buffers before the first await; callers cannot change a later snapshot mid-evaluation.
  const supplied = new Map(
    data.observationRefs.map((r) => {
      const bytes = options.documents.get(r.sha256);
      return [r.sha256, bytes ? Uint8Array.from(bytes) : undefined] as const;
    }),
  );
  const observations = new Map<string, ExperimentalObservation>();
  const problem = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, stage: "external", pointer, message });
  for (const [i, ref] of data.observationRefs.entries()) {
    const p = `/observationRefs/${i}`,
      bytes = supplied.get(ref.sha256);
    const snapshot = {
      ...ref,
      status: "failed" as "passed" | "failed" | "unavailable",
    };
    result.snapshots.push(snapshot);
    if (!bytes) {
      snapshot.status = "unavailable";
      problem(
        "SNAPSHOT.UNAVAILABLE",
        p,
        "Required observation snapshot bytes were not supplied.",
      );
      continue;
    }
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== ref.sha256) {
      problem(
        "SNAPSHOT.DIGEST",
        p,
        "Supplied bytes do not match the declared digest.",
      );
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      problem("SNAPSHOT.JSON", p, "Snapshot is not valid UTF-8 JSON.");
      continue;
    }
    const observation = parseExperimentalObservation(raw);
    if (!observation.success) {
      problem(
        "SNAPSHOT.CONTRACT",
        p,
        "Snapshot does not satisfy the declared observation contract and semantics.",
      );
      continue;
    }
    if (observation.data.id !== ref.documentId) {
      problem(
        "SNAPSHOT.IDENTITY",
        p,
        "Snapshot observation ID differs from the case reference.",
      );
      continue;
    }
    observations.set(ref.documentId, observation.data);
    snapshot.status = "passed";
  }
  for (const { pointer, provenance: p } of caseProvenances(data)) {
    const observation = observations.get(p.observationId);
    if (!observation) continue;
    const [kind, id] = p.sourceRef.split(":");
    const artifact = (
      kind === "source" ? observation.sources : observation.products
    ).find((s) => s.id === id);
    if (!artifact)
      problem(
        "CASE.SOURCE_SCOPE",
        pointer,
        "Citation does not resolve in its declared observation snapshot.",
      );
    else if (
      p.sourceDigest &&
      artifact.digest &&
      p.sourceDigest.value !== artifact.digest.value
    )
      problem(
        "SOURCE.DIGEST_MISMATCH",
        pointer,
        "Source digest declarations disagree. Source bytes have not been checked.",
      );
  }
  for (const [i, e] of data.entities.entries())
    if (e.kind === "investigation")
      for (const [j, a] of (e.fields.methodReferences ?? []).entries())
        if ("value" in a.content)
          for (const [k, m] of a.content.value.entries()) {
            const observation = observations.get(m.observationId);
            if (!observation) continue;
            if (!observation.methods.some((method) => method.id === m.methodId))
              problem(
                "CASE.METHOD_RESOLUTION",
                `/entities/${i}/fields/methodReferences/${j}/content/value/${k}`,
                "Method is absent from its pinned observation snapshot.",
              );
          }
  result.success = result.issues.length === 0;
  result.checks.external = result.success ? "passed" : "failed";
  result.declaredChronology = result.success ? "acyclic" : "incomplete";
  return result;
}
