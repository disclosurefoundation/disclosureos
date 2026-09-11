import {
  CaseClaimHistorySchema,
  CASE_CLAIM_HISTORY_SCHEMA_ID,
  type CaseHistoricalClaim,
} from "./case-claim-history-schema";
import type { DocumentSnapshotRef } from "./context-schema";
import type { ContextIssue } from "./context";
import { checkTime, type PrimitiveIssue } from "./primitives";
import { compareUtcInstants } from "./utc";

export const caseSnapshotKey = (r: DocumentSnapshotRef) =>
  `${r.schemaId}|${r.documentId}|${r.sha256}`;
/** Every case dependency in a claim, including provenance, methods and inputs. */
export function caseClaimDocuments(
  c: CaseHistoricalClaim,
): DocumentSnapshotRef[] {
  const refs =
    c.subject.kind === "case"
      ? [c.subject.document]
      : c.subject.kind === "case_entity"
        ? [c.subject.reference.document]
        : [c.subject.from.case, c.subject.to.case];
  if (c.kind === "source_assertion") refs.push(c.provenance.case);
  else {
    refs.push(
      ...(c.caseInputRefs ?? []).map((r) => r.document),
      ...(c.observationInputRefs ?? []).map((r) => r.case),
    );
    if (c.status === "assessed") refs.push(c.methodRef.case);
  }
  return refs;
}
export function parseCaseClaimHistory(input: unknown) {
  const parsed = CaseClaimHistorySchema.safeParse(input);
  const contract = {
    schemaId: CASE_CLAIM_HISTORY_SCHEMA_ID,
    rulesetVersion: "0.1.0",
  } as const;
  if (!parsed.success)
    return {
      success: false as const,
      contract,
      checks: {
        structural: "failed",
        semantic: "not_checked",
        external: "not_checked",
        profile: "not_checked",
      } as const,
      issues: parsed.error.issues.map((i) => ({
        code: "STRUCT.VALUE",
        stage: "structural" as const,
        pointer: "/" + i.path.join("/"),
        message: i.message,
      })),
      uncheckedRefs: [] as string[],
    };
  const data = parsed.data,
    issues: ContextIssue[] = [];
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const cases = new Set(data.caseRefs.map(caseSnapshotKey));
  if (cases.size !== data.caseRefs.length)
    problem("REF.UNIQUE_ID", "/caseRefs", "Case snapshot references repeat.");
  const claims = new Map<string, CaseHistoricalClaim>(),
    graph = new Map<string, Set<string>>(),
    superseded = new Set<string>();
  data.claims.forEach((c, i) => {
    const ref = `claim:${c.id}`;
    if (claims.has(ref))
      problem("REF.UNIQUE_ID", `/claims/${i}/id`, "Duplicate claim identity.");
    claims.set(ref, c);
    graph.set(ref, new Set());
  });
  const instant = (value: string, p: string) => {
    const found: PrimitiveIssue[] = [];
    checkTime({ kind: "instant", value, timeScale: "UTC" }, p, found);
    found.forEach((i) => problem(i.code, i.pointer, i.message));
  };
  const unique = (values: unknown[], p: string) => {
    if (new Set(values.map((v) => JSON.stringify(v))).size !== values.length)
      problem("REF.UNIQUE_ID", p, "Input references repeat.");
  };
  for (const [i, c] of data.claims.entries()) {
    const p = `/claims/${i}`,
      owner = `claim:${c.id}`;
    instant(c.recordedAt, `${p}/recordedAt`);
    for (const ref of caseClaimDocuments(c))
      if (!cases.has(caseSnapshotKey(ref)))
        problem(
          "CASE.UNDECLARED_SNAPSHOT",
          p,
          "Claim reference must select an exact declared case snapshot.",
        );
    if (
      c.subject.kind === "case_relation" &&
      JSON.stringify(c.subject.from) === JSON.stringify(c.subject.to)
    )
      problem(
        "CASE.SELF_RELATION",
        `${p}/subject`,
        "A relationship assessment must concern distinct observation snapshots.",
      );
    const refs = [
      ...(c.supersedes ?? []),
      ...(c.kind === "assessment" ? c.inputRefs : []),
    ];
    unique(c.supersedes ?? [], `${p}/supersedes`);
    for (const ref of refs) {
      if (!claims.has(ref))
        problem(
          "REF.LOCAL_RESOLUTION",
          p,
          "Referenced claim is absent from this history.",
        );
      else graph.get(owner)!.add(ref);
    }
    for (const ref of c.supersedes ?? []) {
      const previous = claims.get(ref);
      if (!previous) continue;
      superseded.add(ref);
      if (
        previous.kind !== c.kind ||
        previous.topic !== c.topic ||
        JSON.stringify(previous.subject) !== JSON.stringify(c.subject)
      )
        problem(
          "CLAIM.SUPERSESSION_SCOPE",
          `${p}/supersedes`,
          "A revision must retain kind, topic and exact subject snapshots. New snapshot assessments are separate claims.",
        );
      if (
        previous.kind === "assessment" &&
        previous.status === "assessed" &&
        c.kind === "assessment" &&
        (c.status !== "assessed" || previous.evaluatedBy !== c.evaluatedBy)
      )
        problem(
          "CLAIM.REVISION_ATTRIBUTION",
          `${p}/supersedes`,
          "Other evaluators record independent assessments; an assessed revision retains its evaluator.",
        );
      if (
        previous.kind === "source_assertion" &&
        c.kind === "source_assertion" &&
        previous.provenance.attributedTo !== c.provenance.attributedTo
      )
        problem(
          "CLAIM.REVISION_ATTRIBUTION",
          `${p}/supersedes`,
          "A different source author records an independent statement.",
        );
      if (compareUtcInstants(previous.recordedAt, c.recordedAt) === 1)
        problem(
          "CLAIM.REVISION_ORDER",
          `${p}/recordedAt`,
          "Revision is recorded before its predecessor.",
        );
    }
    if (c.kind === "source_assertion") {
      const locator = c.provenance.locator;
      if (
        locator?.kind === "time_range" &&
        locator.endSeconds < locator.startSeconds
      )
        problem(
          "TIME.INTERVAL",
          `${p}/provenance/locator`,
          "Source locator end precedes its start.",
        );
    } else {
      unique(c.inputRefs, `${p}/inputRefs`);
      unique(c.caseInputRefs ?? [], `${p}/caseInputRefs`);
      unique(c.observationInputRefs ?? [], `${p}/observationInputRefs`);
      if (c.status === "assessed") {
        instant(c.evaluatedAt, `${p}/evaluatedAt`);
        if (compareUtcInstants(c.evaluatedAt, c.recordedAt) === 1)
          problem(
            "CLAIM.EVALUATION_ORDER",
            `${p}/evaluatedAt`,
            "Evaluation occurs after recording.",
          );
        if (
          c.inputRefs.length +
            (c.caseInputRefs?.length ?? 0) +
            (c.observationInputRefs?.length ?? 0) ===
          0
        )
          problem(
            "CLAIM.INPUT_REQUIRED",
            p,
            "An assessed claim needs explicit inputs. Use unassessed when review inputs are not supplied.",
          );
      }
    }
  }
  const degree = new Map([...graph.keys()].map((k) => [k, 0]));
  for (const refs of graph.values())
    for (const ref of refs) degree.set(ref, degree.get(ref)! + 1);
  const queue = [...degree].filter(([, d]) => d === 0).map(([k]) => k);
  for (let i = 0; i < queue.length; i++)
    for (const ref of graph.get(queue[i]!) ?? []) {
      const d = degree.get(ref)! - 1;
      degree.set(ref, d);
      if (d === 0) queue.push(ref);
    }
  if (queue.length !== graph.size)
    problem(
      "CLAIM.DEPENDENCY_CYCLE",
      "/claims",
      "Inputs and supersession must form one acyclic dependency graph.",
    );
  const result = {
    contract,
    issues,
    uncheckedRefs: data.caseRefs.map((r) => r.sha256),
    checks: {
      structural: "passed" as const,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
      external: "not_checked" as const,
      profile: "not_checked" as const,
    },
  };
  return issues.length
    ? { ...result, success: false as const }
    : {
        ...result,
        success: true as const,
        data,
        currentClaimRefs: [...claims.keys()].filter((k) => !superseded.has(k)),
      };
}
