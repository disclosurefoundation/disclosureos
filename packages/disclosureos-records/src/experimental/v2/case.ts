import {
  CaseRecordSchema,
  CASE_RECORD_SCHEMA_ID,
  type CaseRecord,
  type CaseProvenance,
} from "./case-schema";
import {
  checkTime,
  type EventTimeValue,
  type PrimitiveIssue,
} from "./primitives";
import type { ContextIssue } from "./context";

/** Every citation is scoped to one observation snapshot; source IDs alone are not case-wide identities. */
export function caseProvenances(
  data: CaseRecord,
): Array<{ pointer: string; provenance: CaseProvenance }> {
  return data.entities.flatMap((e, i) => {
    if ("basis" in e)
      return [
        {
          pointer: `/entities/${i}/basis/provenance`,
          provenance: e.basis.provenance,
        },
      ];
    return Object.entries(e.fields).flatMap(([field, assertions]) =>
      (assertions ?? []).flatMap(
        (a: { content: { provenance?: CaseProvenance } }, j: number) =>
          a.content.provenance
            ? [
                {
                  pointer: `/entities/${i}/fields/${field}/${j}/content/provenance`,
                  provenance: a.content.provenance,
                },
              ]
            : [],
      ),
    );
  });
}
/** Structural and local graph validation only. No input is mutated and no document is fetched. */
export function parseCaseRecord(input: unknown) {
  const parsed = CaseRecordSchema.safeParse(input);
  const contract = {
    schemaId: CASE_RECORD_SCHEMA_ID,
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
  const error = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const observations = new Set<string>(),
    groups = new Set<string>(),
    keys = new Set<string>();
  for (const [i, ref] of data.observationRefs.entries()) {
    if (observations.has(ref.documentId))
      error(
        "CASE.SNAPSHOT_UNIQUE",
        `/observationRefs/${i}`,
        "Only one snapshot per observation ID is allowed in a case revision.",
      );
    observations.add(ref.documentId);
  }
  for (const [i, e] of data.entities.entries()) {
    const key = `${e.kind}:${e.id}`;
    if (keys.has(key))
      error(
        "REF.UNIQUE_ID",
        `/entities/${i}/id`,
        "Duplicate entity identity within its kind.",
      );
    keys.add(key);
    if (e.kind === "event_group") groups.add(e.id);
  }
  const requireObservation = (id: string, p: string) => {
    if (!observations.has(id))
      error(
        "CASE.OBSERVATION_SCOPE",
        p,
        "Observation is not declared in this case snapshot.",
      );
  };
  const requireGroup = (id: string, p: string) => {
    if (!groups.has(id))
      error(
        "REF.LOCAL_RESOLUTION",
        p,
        "Group is not declared in this case snapshot.",
      );
  };
  const chronology = new Map<string, Set<string>>(),
    membership = new Map<string, Set<string>>();
  const edge = (graph: Map<string, Set<string>>, from: string, to: string) => {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)!.add(to);
  };
  const time = (value: EventTimeValue, p: string) => {
    const found: PrimitiveIssue[] = [];
    checkTime(value, p, found);
    found.forEach((i) => error(i.code, i.pointer, i.message));
  };
  time(
    { kind: "instant", value: data.recordedAt, timeScale: "UTC" },
    "/recordedAt",
  );
  for (const [i, e] of data.entities.entries()) {
    const p = `/entities/${i}`;
    if (e.kind === "relationship") {
      requireObservation(e.fromObservationId, `${p}/fromObservationId`);
      requireObservation(e.toObservationId, `${p}/toObservationId`);
      if (e.fromObservationId === e.toObservationId)
        error(
          "CASE.SELF_LINK",
          p,
          "A relationship must connect distinct observations.",
        );
      if (e.relation === "precedes")
        edge(chronology, e.fromObservationId, e.toObservationId);
      if (e.relation === "follows")
        edge(chronology, e.toObservationId, e.fromObservationId);
    }
    if (e.kind === "membership") {
      requireGroup(e.groupId, `${p}/groupId`);
      if (e.member.kind === "observation")
        requireObservation(e.member.id, `${p}/member`);
      else {
        requireGroup(e.member.id, `${p}/member`);
        edge(membership, e.member.id, e.groupId);
      }
    }
    if ("observationIds" in e) {
      const seen = new Set<string>();
      e.observationIds.forEach((id, j) => {
        requireObservation(id, `${p}/observationIds/${j}`);
        if (seen.has(id))
          error(
            "REF.UNIQUE_ID",
            `${p}/observationIds/${j}`,
            "Duplicate observation scope.",
          );
        seen.add(id);
      });
    }
    if ("fields" in e) {
      const seen = new Set<string>();
      for (const [field, assertions] of Object.entries(e.fields))
        for (const [j, a] of (assertions ?? []).entries()) {
          const ap = `${p}/fields/${field}/${j}`;
          if (seen.has(a.id))
            error(
              "REF.UNIQUE_ID",
              ap,
              "Assertion IDs must be unique across this entity's fields.",
            );
          seen.add(a.id);
          if (
            "value" in a.content &&
            (field === "occurredAt" || field === "investigationTime")
          )
            time(a.content.value as EventTimeValue, `${ap}/content/value`);
        }
    }
    if (e.kind === "investigation")
      for (const [j, a] of (e.fields.methodReferences ?? []).entries())
        if ("value" in a.content)
          for (const [k, m] of a.content.value.entries()) {
            requireObservation(
              m.observationId,
              `${p}/fields/methodReferences/${j}/content/value/${k}`,
            );
            if (!e.observationIds.includes(m.observationId))
              error(
                "CASE.METHOD_SCOPE",
                `${p}/fields/methodReferences/${j}`,
                "Method must belong to this investigation's observation scope.",
              );
          }
  }
  for (const { pointer, provenance: p } of caseProvenances(data)) {
    requireObservation(p.observationId, pointer);
    if (
      p.locator?.kind === "time_range" &&
      p.locator.endSeconds < p.locator.startSeconds
    )
      error("TIME.INTERVAL", pointer, "Source locator end precedes start.");
  }
  // Iterative Kahn traversal avoids stack overflow on a long supplied graph.
  for (const [graph, code] of [
    [chronology, "CASE.CHRONOLOGY_CYCLE"],
    [membership, "CASE.MEMBERSHIP_CYCLE"],
  ] as const) {
    const degree = new Map<string, number>();
    for (const [from, tos] of graph) {
      if (!degree.has(from)) degree.set(from, 0);
      for (const to of tos) degree.set(to, (degree.get(to) ?? 0) + 1);
    }
    const queue = [...degree].filter(([, d]) => d === 0).map(([id]) => id);
    let visited = 0;
    for (let i = 0; i < queue.length; i++) {
      visited++;
      for (const to of graph.get(queue[i]!) ?? []) {
        const d = degree.get(to)! - 1;
        degree.set(to, d);
        if (d === 0) queue.push(to);
      }
    }
    if (visited !== degree.size)
      error(
        code,
        "/entities",
        "Supplied declarations contain a directed cycle.",
      );
  }
  const result = {
    contract,
    issues,
    uncheckedRefs: data.observationRefs.map((r) => r.sha256),
    checks: {
      structural: "passed" as const,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
      external: "not_checked" as const,
      profile: "not_checked" as const,
    },
  };
  return issues.length
    ? { ...result, success: false as const }
    : { ...result, success: true as const, data };
}
