import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
import type {
  AssessedClaim,
  UnassessedClaim,
  SourceStatement,
  HistoricalClaim,
  ClaimSubject,
  ClaimHistoryValidation,
  ExperimentalClaimHistory,
} from "@disclosureos/records/experimental/v2";

export const ASSESSMENT_SUMMARY_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:assessment-summary",
  version: "0.1.0",
  scope: "current_declared_assessments",
} as const);
type Declaration<T extends HistoricalClaim> = Omit<
  T,
  "id" | "recordedAt" | "supersedes"
>;
export interface DeclarationGroup<T extends HistoricalClaim> {
  /** All current copies; the first sorted ref is the deterministic representative. */
  claimRefs: string[];
  declaration: Declaration<T>;
}
export interface AssessmentSummaryGroup {
  topic: string;
  subject: ClaimSubject;
  sourceAssertions: DeclarationGroup<SourceStatement>[];
  unassessed: DeclarationGroup<UnassessedClaim>[];
  assessments: (DeclarationGroup<AssessedClaim> & { lineageRefs: string[] })[];
  declaredOutcomes: AssessedClaim["outcome"][];
  disagreement:
    | "not_assessed"
    | "single_declared_outcome"
    | "multiple_declared_outcomes";
}
export interface AssessmentSummaryResult {
  success: boolean;
  policy: typeof ASSESSMENT_SUMMARY_POLICY;
  contract: ClaimHistoryValidation["contract"];
  checks: ClaimHistoryValidation["checks"];
  issues: ClaimHistoryValidation["issues"];
  uncheckedRefs: string[];
  historyId?: string;
  observationId?: string;
  currentClaimRefs: string[];
  supersededClaimRefs: string[];
  groups: AssessmentSummaryGroup[];
  sharedInputs: { ref: string; assessmentRefs: string[] }[];
  /** Equal declared hashes are a dependence signal, not a completed byte check. */
  sharedDeclaredArtifacts: {
    sha256: string;
    artifactRefs: string[];
    assessmentRefs: string[];
  }[];
  scientificEligibility: "not_checked";
  artifactIntegrity: "not_checked";
  vocabularyMembership: "not_checked";
  statisticalIndependence: "not_checked";
  reproducibility: "not_checked";
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(record[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value) ?? "null";
}
function collapse<T extends HistoricalClaim>(
  claims: T[]
): DeclarationGroup<T>[] {
  const groups = new Map<string, DeclarationGroup<T>>();
  for (const claim of claims) {
    const {
      id,
      recordedAt: _recordedAt,
      supersedes: _supersedes,
      ...body
    } = claim;
    const declaration =
      claim.kind === "assessment"
        ? { ...body, inputRefs: [...claim.inputRefs].sort() }
        : body;
    const key = canonical(declaration);
    const group = groups.get(key);
    if (group) group.claimRefs.push(`claim:${id}`);
    else groups.set(key, { claimRefs: [`claim:${id}`], declaration });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, group]) => ({ ...group, claimRefs: group.claimRefs.sort() }));
}
function supportGraph(
  history: ExperimentalClaimHistory
): Map<string, readonly string[]> {
  const graph = new Map<string, readonly string[]>();
  for (const c of history.claims)
    graph.set(
      `claim:${c.id}`,
      c.kind === "source_assertion" ? [c.provenance.sourceRef] : c.inputRefs
    );
  for (const m of history.observation.measurements)
    graph.set(`measurement:${m.id}`, m.sourceRefs);
  for (const a of history.observation.assertions)
    graph.set(`assertion:${a.id}`, [a.provenance.sourceRef]);
  for (const p of history.observation.products)
    graph.set(
      `product:${p.id}`,
      p.kind === "raw" ? p.sourceRefs : [p.generatedBy]
    );
  for (const p of history.observation.processing)
    graph.set(`process:${p.id}`, p.inputRefs);
  return graph;
}
function closure(
  graph: Map<string, readonly string[]>,
  refs: readonly string[]
): string[] {
  const seen = new Set<string>(),
    queue = [...refs];
  for (let i = 0; i < queue.length; i++) {
    const ref = queue[i]!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    queue.push(...(graph.get(ref) ?? []));
  }
  return [...seen].sort();
}
/** Summarize attributed declarations. No outcome is upgraded by a parser pass. */
export function summarizeClaimHistory(input: unknown): AssessmentSummaryResult {
  const parsed = parseExperimentalClaimHistory(input);
  const result: AssessmentSummaryResult = {
    success: parsed.success,
    policy: ASSESSMENT_SUMMARY_POLICY,
    contract: parsed.contract,
    checks: parsed.checks,
    issues: parsed.issues,
    uncheckedRefs: [...parsed.uncheckedRefs].sort(),
    currentClaimRefs: [],
    supersededClaimRefs: [],
    groups: [],
    sharedInputs: [],
    sharedDeclaredArtifacts: [],
    scientificEligibility: "not_checked",
    artifactIntegrity: "not_checked",
    vocabularyMembership: "not_checked",
    statisticalIndependence: "not_checked",
    reproducibility: "not_checked",
  };
  if (!parsed.success) return result;
  const history = parsed.data,
    current = new Set(parsed.currentClaimRefs),
    graph = supportGraph(history);
  result.historyId = history.id;
  result.observationId = history.observation.id;
  result.currentClaimRefs = [...current].sort();
  result.supersededClaimRefs = history.claims
    .map((c) => `claim:${c.id}`)
    .filter((r) => !current.has(r))
    .sort();
  const topics = new Map<string, HistoricalClaim[]>();
  for (const c of history.claims) {
    if (!current.has(`claim:${c.id}`)) continue;
    const key = canonical({ topic: c.topic, subject: c.subject });
    const group = topics.get(key);
    if (group) group.push(c);
    else topics.set(key, [c]);
  }
  const shared = new Map<string, Set<string>>();
  const digestIndex = new Map<
    string,
    { artifactRefs: Set<string>; assessmentRefs: Set<string> }
  >();
  const digests = new Map<string, string>();
  for (const s of history.observation.sources)
    if (s.digest) digests.set(`source:${s.id}`, s.digest.value);
  for (const p of history.observation.products)
    if (p.digest) digests.set(`product:${p.id}`, p.digest.value);
  for (const [, claims] of [...topics.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    const first = claims[0]!;
    const assessments = collapse(
      claims.filter(
        (c): c is AssessedClaim =>
          c.kind === "assessment" && c.status === "assessed"
      )
    ).map((g) => ({
      ...g,
      lineageRefs: closure(graph, g.declaration.inputRefs),
    }));
    const outcomes = [
      ...new Set(assessments.map((a) => a.declaration.outcome)),
    ].sort();
    result.groups.push({
      topic: first.topic,
      subject: first.subject,
      sourceAssertions: collapse(
        claims.filter(
          (c): c is SourceStatement => c.kind === "source_assertion"
        )
      ),
      unassessed: collapse(
        claims.filter(
          (c): c is UnassessedClaim =>
            c.kind === "assessment" && c.status === "unassessed"
        )
      ),
      assessments,
      declaredOutcomes: outcomes,
      disagreement:
        outcomes.length === 0
          ? "not_assessed"
          : outcomes.length === 1
          ? "single_declared_outcome"
          : "multiple_declared_outcomes",
    });
    for (const a of assessments)
      for (const ref of a.lineageRefs) {
        const representative = a.claimRefs[0]!;
        if (!shared.has(ref)) shared.set(ref, new Set());
        shared.get(ref)!.add(representative);
        const digest = digests.get(ref);
        if (digest) {
          if (!digestIndex.has(digest))
            digestIndex.set(digest, {
              artifactRefs: new Set(),
              assessmentRefs: new Set(),
            });
          const entry = digestIndex.get(digest)!;
          entry.artifactRefs.add(ref);
          entry.assessmentRefs.add(representative);
        }
      }
  }
  result.sharedInputs = [...shared.entries()]
    .filter(([, refs]) => refs.size > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ref, refs]) => ({ ref, assessmentRefs: [...refs].sort() }));
  result.sharedDeclaredArtifacts = [...digestIndex.entries()]
    .filter(([, entry]) => entry.assessmentRefs.size > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([sha256, entry]) => ({
      sha256,
      artifactRefs: [...entry.artifactRefs].sort(),
      assessmentRefs: [...entry.assessmentRefs].sort(),
    }));
  return result;
}
