import type {
  LaboratoryClaimHistory,
  LaboratoryHistoricalClaim,
} from "./laboratory-claim-history-schema";
import type { z } from "zod";
import type {
  ResearchClaimHistory,
  ResearchHistoricalClaim,
} from "./research-claim-history-schema";
import type {
  ArchivalClaimHistory,
  ArchivalHistoricalClaim,
} from "./archival-claim-history-schema";
import type {
  ResearchClaimHistoryIssue,
  ResearchClaimHistoryIssueCode,
} from "./research-claim-history";
import { parseExperimentalObservation } from "./observation";
import { checkTime, comparePoints, type PrimitiveIssue } from "./primitives";
const point = (value: string) => ({
  kind: "instant" as const,
  value,
  timeScale: "UTC" as const,
});
const pointer = (path: readonly PropertyKey[]) =>
  path
    .map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`)
    .join("");

/** Checks declared claim history only. Current means not superseded, never scientifically verified. */
export function parseEntityClaimHistory<
  T extends
    | ResearchClaimHistory
    | ArchivalClaimHistory
    | LaboratoryClaimHistory,
  C extends { kind: "claim_history"; schemaId: string; rulesetVersion: string },
>(input: unknown, schema: z.ZodType<T>, contract: C) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      contract,
      checks: {
        structural: "failed",
        semantic: "not_checked",
        profile: "not_checked",
        external: "not_checked",
      } as const,
      uncheckedRefs: [],
      issues: parsed.error.issues.map((issue) => ({
        code: "STRUCT.VALUE" as const,
        stage: "structural" as const,
        severity: "error" as const,
        pointer: pointer(issue.path),
        message: issue.message,
      })),
    };
  const data = parsed.data;
  const observationResult = parseExperimentalObservation(data.observation);
  const issues: ResearchClaimHistoryIssue[] = observationResult.issues.map(
    (issue) => ({ ...issue, pointer: `/observation${issue.pointer}` }),
  );
  const problem = (
    code: ResearchClaimHistoryIssueCode,
    path: string,
    message: string,
  ) =>
    issues.push({
      code,
      stage: "semantic",
      severity: "error",
      pointer: path,
      message,
    });
  const claims = new Map<
    string,
    | ResearchHistoricalClaim
    | ArchivalHistoricalClaim
    | LaboratoryHistoricalClaim
  >();
  const graph = new Map<string, Set<string>>();
  const superseded = new Set<string>();
  const sources = new Map(
    data.observation.sources.map((item) => [`source:${item.id}`, item]),
  );
  const products = new Map(
    data.observation.products.map((item) => [`product:${item.id}`, item]),
  );
  const methods = new Map(
    data.observation.methods.map((item) => [`method:${item.id}`, item]),
  );
  const measurements = new Set(
    data.observation.measurements.map((item) => `measurement:${item.id}`),
  );
  const available = new Set([
    ...sources.keys(),
    ...products.keys(),
    ...measurements,
    ...data.observation.assertions.map((item) => `assertion:${item.id}`),
  ]);
  for (const [i, claim] of data.claims.entries()) {
    const ref = `claim:${claim.id}`;
    if (claims.has(ref))
      problem(
        "REF.UNIQUE_ID",
        `/claims/${i}/id`,
        "Duplicate claim ID; each revision must have its own ID.",
      );
    else {
      claims.set(ref, claim);
      graph.set(ref, new Set());
      available.add(ref);
    }
  }
  function instant(value: string, path: string): void {
    const local: PrimitiveIssue[] = [];
    checkTime(point(value), path, local);
    for (const issue of local)
      problem(issue.code, issue.pointer, issue.message);
  }
  function resolve(ref: string, path: string, owner?: string): void {
    if (!available.has(ref))
      problem(
        "REF.LOCAL_RESOLUTION",
        path,
        `Undeclared local reference: ${ref}`,
      );
    else if (owner && claims.has(ref)) graph.get(owner)?.add(ref);
  }
  function refs(values: string[], path: string, owner: string): void {
    const seen = new Set<string>();
    for (const [i, ref] of values.entries()) {
      if (seen.has(ref))
        problem("REF.UNIQUE_ID", `${path}/${i}`, "Reference is repeated.");
      seen.add(ref);
      resolve(ref, `${path}/${i}`, owner);
    }
  }
  const snapshots = new Set(data.contextRefs.map((r) => JSON.stringify(r)));
  if (snapshots.size !== data.contextRefs.length)
    problem(
      "REF.UNIQUE_ID",
      "/contextRefs",
      "Context snapshot references repeat.",
    );
  for (const [i, claim] of data.claims.entries()) {
    const contextRefs = [
      ...(claim.subject.kind === "context" ? [claim.subject.reference] : []),
      ...(claim.kind === "assessment" ? (claim.contextInputRefs ?? []) : []),
    ];
    for (const ref of contextRefs)
      if (!snapshots.has(JSON.stringify(ref.document)))
        problem(
          "REF.LOCAL_RESOLUTION",
          `/claims/${i}`,
          "Context reference must select a declared snapshot.",
        );
    if (
      claim.kind === "assessment" &&
      new Set((claim.contextInputRefs ?? []).map((r) => JSON.stringify(r)))
        .size !== (claim.contextInputRefs ?? []).length
    )
      problem(
        "REF.UNIQUE_ID",
        `/claims/${i}/contextInputRefs`,
        "Context inputs repeat.",
      );
  }
  const entitySnapshots = new Set(
    data.entityRefs.map((r) => JSON.stringify(r)),
  );
  if (entitySnapshots.size !== data.entityRefs.length)
    problem("REF.UNIQUE_ID", "/entityRefs", "Entity snapshots repeat.");
  for (const [i, claim] of data.claims.entries()) {
    const refs = [
      ...(claim.subject.kind === "entity" ? [claim.subject.reference] : []),
      ...(claim.kind === "assessment" ? (claim.entityInputRefs ?? []) : []),
    ];
    for (const ref of refs)
      if (!entitySnapshots.has(JSON.stringify(ref.document)))
        problem(
          "REF.LOCAL_RESOLUTION",
          `/claims/${i}`,
          "Entity reference must select a declared snapshot.",
        );
    if (claim.kind === "assessment") {
      if (
        new Set((claim.entityInputRefs ?? []).map((r) => JSON.stringify(r)))
          .size !== (claim.entityInputRefs ?? []).length
      )
        problem(
          "REF.UNIQUE_ID",
          `/claims/${i}/entityInputRefs`,
          "Entity inputs repeat.",
        );
      if (claim.status === "assessed" && claim.witnessReview) {
        if (
          claim.subject.kind !== "entity" ||
          !["witness", "account", "witness_group", "procedure"].includes(
            claim.subject.reference.target.kind,
          )
        )
          problem(
            "CLAIM.SUPERSESSION_SCOPE",
            `/claims/${i}/witnessReview`,
            "Witness review requires a typed research-entity subject.",
          );
        if (
          claim.inputRefs.length +
            (claim.entityInputRefs?.length ?? 0) +
            (claim.contextInputRefs?.length ?? 0) +
            ("editionInputRefs" in claim
              ? (claim.editionInputRefs?.length ?? 0)
              : 0) ===
          0
        )
          problem(
            "REF.LOCAL_RESOLUTION",
            `/claims/${i}/witnessReview`,
            "Witness review requires explicit inputs.",
          );
      }
    }
  }
  for (const [i, claim] of data.claims.entries()) {
    const path = `/claims/${i}`;
    const owner = `claim:${claim.id}`;
    instant(claim.recordedAt, `${path}/recordedAt`);
    if (claim.subject.kind === "measurement")
      resolve(
        `measurement:${claim.subject.measurementId}`,
        `${path}/subject/measurementId`,
      );
    if (claim.supersedes) {
      refs(claim.supersedes, `${path}/supersedes`, owner);
      for (const [j, ref] of claim.supersedes.entries()) {
        const previous = claims.get(ref);
        if (!previous) continue;
        superseded.add(ref);
        if (
          previous.kind !== claim.kind ||
          previous.topic !== claim.topic ||
          JSON.stringify(previous.subject) !== JSON.stringify(claim.subject)
        ) {
          problem(
            "CLAIM.SUPERSESSION_SCOPE",
            `${path}/supersedes/${j}`,
            "A revision must retain the claim kind, topic, and subject. Record a different claim separately.",
          );
        }
        if (
          previous.kind === "assessment" &&
          previous.status === "assessed" &&
          claim.kind === "assessment" &&
          (claim.status !== "assessed" ||
            previous.evaluatedBy !== claim.evaluatedBy)
        ) {
          problem(
            "CLAIM.REVISION_ATTRIBUTION",
            `${path}/supersedes/${j}`,
            "An assessed revision must retain its evaluator; other evaluators record independent assessments.",
          );
        }
        if (
          comparePoints(point(previous.recordedAt), point(claim.recordedAt)) > 0
        ) {
          problem(
            "CLAIM.REVISION_ORDER",
            `${path}/recordedAt`,
            "A revision cannot be recorded before the statement it supersedes.",
          );
        }
      }
    }
    if (claim.kind === "source_assertion") {
      resolve(claim.provenance.sourceRef, `${path}/provenance/sourceRef`);
      const source =
        sources.get(claim.provenance.sourceRef) ??
        products.get(claim.provenance.sourceRef);
      if (
        source?.digest &&
        claim.provenance.sourceDigest &&
        source.digest.value !== claim.provenance.sourceDigest.value
      ) {
        problem(
          "SOURCE.DIGEST_MISMATCH",
          `${path}/provenance/sourceDigest`,
          "Digest differs from the inventory declaration; neither is verified against bytes.",
        );
      }
      const locator = claim.provenance.locator;
      if (
        locator?.kind === "time_range" &&
        locator.endSeconds < locator.startSeconds
      )
        problem(
          "TIME.INTERVAL",
          `${path}/provenance/locator/endSeconds`,
          "Locator end precedes its start.",
        );
    } else {
      refs(claim.inputRefs, `${path}/inputRefs`, owner);
      if (claim.status === "assessed") {
        instant(claim.evaluatedAt, `${path}/evaluatedAt`);
        if (
          comparePoints(point(claim.evaluatedAt), point(claim.recordedAt)) > 0
        )
          problem(
            "CLAIM.EVALUATION_ORDER",
            `${path}/evaluatedAt`,
            "Evaluation cannot occur after the assessment was recorded.",
          );
        const method = methods.get(claim.methodRef);
        if (!method)
          problem(
            "REF.LOCAL_RESOLUTION",
            `${path}/methodRef`,
            "Assessment method is not declared in the Observation inventory.",
          );
        else if (method.version !== claim.methodVersion)
          problem(
            "METHOD.VERSION_MISMATCH",
            `${path}/methodVersion`,
            "Assessment method version differs from its inventory declaration.",
          );
      }
    }
  }
  // Supersession and claim inputs form one dependency graph. Array order is irrelevant.
  const indegrees = new Map([...graph.keys()].map((ref) => [ref, 0]));
  for (const edges of graph.values())
    for (const ref of edges) indegrees.set(ref, indegrees.get(ref)! + 1);
  const queue = [...indegrees]
    .filter(([, degree]) => degree === 0)
    .map(([ref]) => ref);
  for (let i = 0; i < queue.length; i++)
    for (const ref of graph.get(queue[i]!) ?? []) {
      const degree = indegrees.get(ref)! - 1;
      indegrees.set(ref, degree);
      if (degree === 0) queue.push(ref);
    }
  if (queue.length !== graph.size)
    problem(
      "CLAIM.DEPENDENCY_CYCLE",
      "/claims",
      "Claim inputs and supersession must form an acyclic history.",
    );
  const validation = {
    contract,
    issues,
    uncheckedRefs: [
      ...data.contextRefs.map((r) => r.sha256),
      ...data.entityRefs.map((r) => r.sha256),
      ...observationResult.uncheckedRefs,
      ...data.claims.flatMap((c) => [
        ...(c.subject.kind === "context"
          ? [c.subject.reference.document.sha256]
          : []),
        ...(c.kind === "assessment"
          ? (c.contextInputRefs ?? []).map((r) => r.document.sha256)
          : []),
      ]),
    ],
    checks: {
      structural: "passed",
      semantic: issues.length ? "failed" : "passed",
      profile: "not_checked",
      external: "not_checked",
    } as const,
  };
  return issues.length
    ? { ...validation, success: false as const }
    : {
        ...validation,
        success: true as const,
        data,
        currentClaimRefs: [...claims.keys()].filter(
          (ref) => !superseded.has(ref),
        ),
      };
}
