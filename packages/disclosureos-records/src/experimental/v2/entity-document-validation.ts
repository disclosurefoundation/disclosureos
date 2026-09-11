import type { z } from "zod";
import { type ContextIssue, type ContextAssertion } from "./context";
import {
  checkTime,
  type EventTimeValue,
  type PrimitiveIssue,
} from "./primitives";
import type { ContextReference, DocumentSnapshotRef } from "./context-schema";
type Entity = { kind: string; id: string; fields: object };
type EntityDocument = {
  contextRefs: DocumentSnapshotRef[];
  observationRef: DocumentSnapshotRef;
  recordedAt: string;
  entities: Entity[];
};
export function researchEntityAssertions(
  entity: Entity,
): { field: string; assertion: ContextAssertion }[] {
  return Object.entries(entity.fields).flatMap(([field, list]) =>
    ((list ?? []) as ContextAssertion[]).map((assertion) => ({
      field,
      assertion,
    })),
  );
}
/** Typed links found only in schema-defined fields, never by scanning arbitrary text. */
export function researchEntityContextReferences(
  entity: Entity,
): ContextReference[] {
  return researchEntityAssertions(entity).flatMap(({ field, assertion }) => {
    const value = assertion.content.value as
      | { relevantTime?: { kind: string; reference?: ContextReference } }
      | undefined;
    if (field === "eventContext" && value)
      return [value as unknown as ContextReference];
    return value?.relevantTime?.kind === "context"
      ? [value.relevantTime.reference!]
      : [];
  });
}
export function parseEntityDocument<
  T extends EntityDocument,
  C extends { schemaId: string; rulesetVersion: string },
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
      uncheckedRefs: [] as string[],
      issues: parsed.error.issues.map((i) => ({
        code: "STRUCT.VALUE",
        stage: "structural" as const,
        pointer: "/" + i.path.join("/"),
        message: i.message,
      })),
    };
  const data = parsed.data,
    issues: ContextIssue[] = [];
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const snapshots = new Set(data.contextRefs.map((r) => JSON.stringify(r)));
  if (snapshots.size !== data.contextRefs.length)
    problem(
      "REF.UNIQUE_ID",
      "/contextRefs",
      "Context snapshot references repeat.",
    );
  const unchecked = new Set([
    data.observationRef.sha256,
    ...data.contextRefs.map((r) => r.sha256),
  ]);
  const identities = new Set<string>();
  for (const [i, e] of data.entities.entries()) {
    const key = `${e.kind}:${e.id}`;
    if (identities.has(key))
      problem(
        "REF.UNIQUE_ID",
        `/entities/${i}/id`,
        "Entity identity repeats within its kind.",
      );
    identities.add(key);
  }
  function time(v: EventTimeValue, p: string) {
    const found: PrimitiveIssue[] = [];
    checkTime(v, p, found);
    found.forEach((i) => problem(i.code, i.pointer, i.message));
  }
  time(
    { kind: "instant", value: data.recordedAt, timeScale: "UTC" },
    "/recordedAt",
  );
  for (const [i, e] of data.entities.entries()) {
    const ep = `/entities/${i}`,
      ids = new Set<string>();
    for (const { field, assertion: a } of researchEntityAssertions(e)) {
      const p = `${ep}/fields/${field}`;
      if (ids.has(a.id))
        problem("REF.UNIQUE_ID", p, "Assertion IDs repeat within this entity.");
      ids.add(a.id);
      const prov = a.content.provenance;
      if (prov) {
        unchecked.add(prov.sourceRef);
        if (
          prov.locator?.kind === "time_range" &&
          prov.locator.endSeconds! < prov.locator.startSeconds!
        )
          problem("TIME.INTERVAL", p, "Source locator end precedes its start.");
      }
      const value = a.content.value;
      if (value === undefined) continue;
      if (field === "recordedTime" || field === "performedAt")
        time(value as EventTimeValue, p);
      const relevant = (
        value as { relevantTime?: { kind: string; value?: EventTimeValue } }
      ).relevantTime;
      if (relevant?.kind === "calendar") time(relevant.value!, p);
      const targetKind =
        field === "speakerWitnessIds" ||
        field === "witnessIds" ||
        field === "witnessId"
          ? "witness"
          : field === "accountId"
            ? "account"
            : undefined;
      if (targetKind) {
        const refs = Array.isArray(value) ? value : [value];
        if (new Set(refs).size !== refs.length)
          problem("REF.UNIQUE_ID", p, "Typed local links repeat.");
        for (const id of refs)
          if (!identities.has(`${targetKind}:${id}`))
            problem("REF.ENTITY", p, "Typed local entity does not exist.");
      }
      if (field === "sourceDocument") unchecked.add(value as string);
      if (field === "supportRefs") {
        const refs = value as string[];
        if (new Set(refs).size !== refs.length)
          problem("REF.UNIQUE_ID", p, "Support references repeat.");
        refs.forEach((r) => unchecked.add(r));
      }
    }
    for (const ref of researchEntityContextReferences(e))
      if (!snapshots.has(JSON.stringify(ref.document)))
        problem(
          "REF.LOCAL_RESOLUTION",
          ep,
          "Context reference must select a declared snapshot.",
        );
  }
  const validation = {
    contract,
    issues,
    uncheckedRefs: [...unchecked],
    checks: {
      structural: "passed",
      semantic: issues.length ? "failed" : "passed",
      profile: "not_checked",
      external: "not_checked",
    } as const,
  };
  return issues.length
    ? { ...validation, success: false as const }
    : { ...validation, success: true as const, data };
}
