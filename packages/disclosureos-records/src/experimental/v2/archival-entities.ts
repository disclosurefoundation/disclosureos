import {
  ArchivalEntitiesSchema,
  ARCHIVAL_ENTITIES_SCHEMA_ID,
  type ArchivalEntity,
  type ArtifactSnapshotRef,
} from "./archival-entities-schema";
import {
  parseEntityDocument,
  researchEntityAssertions,
} from "./entity-document-validation";
import {
  checkTime,
  comparePoints,
  type EventTimeValue,
  type PrimitiveIssue,
} from "./primitives";
import type { ContextIssue } from "./context";
export function archivalArtifactReferences(
  entity: ArchivalEntity,
): ArtifactSnapshotRef[] {
  const direct = "artifact" in entity ? [entity.artifact] : [];
  if (entity.kind !== "digital_artifact") return direct;
  return [
    ...direct,
    ...(entity.fields.declaredHashes ?? []).flatMap((a) =>
      "value" in a.content
        ? a.content.value.flatMap((d) =>
            d.appliesTo.kind === "artifact" ? [d.appliesTo.reference] : [],
          )
        : [],
    ),
  ];
}
export function parseArchivalEntities(input: unknown) {
  const result = parseEntityDocument(input, ArchivalEntitiesSchema, {
    schemaId: ARCHIVAL_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.2.0",
  } as const);
  if (!result.success) return result;
  const data = result.data,
    issues: ContextIssue[] = [];
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const index = new Map(data.entities.map((e) => [`${e.kind}:${e.id}`, e]));
  const unchecked = new Set(result.uncheckedRefs);
  const derivation = new Map<string, string[]>(),
    custody = new Map<string, string[]>();
  const known = (entity: ArchivalEntity, field: string): unknown => {
    const a = researchEntityAssertions(entity).filter((a) => a.field === field);
    return a.length === 1 && a[0]!.assertion.content.state === "known"
      ? a[0]!.assertion.content.value
      : undefined;
  };
  for (const [i, e] of data.entities.entries()) {
    const p = `/entities/${i}`;
    const link = (kind: string, id: string, field: string) => {
      const target = index.get(`${kind}:${id}`);
      if (!target)
        problem(
          "REF.ENTITY",
          `${p}/${field}`,
          "Typed local archival entity does not exist.",
        );
      return target;
    };
    for (const ref of archivalArtifactReferences(e))
      unchecked.add(ref.sourceRef);
    if (e.kind === "document_event")
      link("source_edition", e.editionId, "editionId");
    if (e.kind === "external_identifier" && e.subject.kind === "source_edition")
      link("source_edition", e.subject.editionId, "subject/editionId");
    if (e.kind === "identifier_check") {
      const identifier = link(
        "external_identifier",
        e.identifierId,
        "identifierId",
      );
      if (
        identifier?.kind === "external_identifier" &&
        !identifier.fields.value?.some((a) => a.id === e.identifierAssertionId)
      )
        problem(
          "REF.ASSERTION",
          `${p}/identifierAssertionId`,
          "Identifier check must name an existing value assertion in the selected identifier revision.",
        );
    }
    for (const { field, assertion } of researchEntityAssertions(e)) {
      const value = assertion.content.value;
      if (value === undefined) continue;
      if (
        [
          "issuedAt",
          "occurredAt",
          "originalCreationDate",
          "lastUpdated",
          "checkedAt",
        ].includes(field)
      ) {
        const found: PrimitiveIssue[] = [];
        checkTime(value as EventTimeValue, `${p}/fields/${field}`, found);
        found.forEach((v) => problem(v.code, v.pointer, v.message));
      }
      if (e.kind === "external_identifier" && field === "value") {
        const v = value as { system: string; systemName?: string };
        if (v.system === "custom" && !v.systemName)
          problem(
            "ARCHIVE.IDENTIFIER_SYSTEM",
            `${p}/fields/value`,
            "A custom identifier system needs a declared system name.",
          );
      }
    }
    if (e.kind === "digital_artifact") {
      const parents = (e.fields.derivedFromArtifactIds ?? []).flatMap((a) =>
        "value" in a.content ? a.content.value : [],
      );
      for (const a of e.fields.derivedFromArtifactIds ?? [])
        if (
          "value" in a.content &&
          new Set(a.content.value).size !== a.content.value.length
        )
          problem(
            "REF.UNIQUE_ID",
            `${p}/fields/derivedFromArtifactIds`,
            "Parent artifact links repeat within an assertion.",
          );
      parents.forEach((id) =>
        link("digital_artifact", id, "fields/derivedFromArtifactIds"),
      );
      derivation.set(e.id, [...new Set(parents)]);
    }
    if (e.kind === "digital_custody_action") {
      link("digital_artifact", e.artifactId, "artifactId");
      custody.set(
        e.id,
        e.predecessor.kind === "action" ? [e.predecessor.id] : [],
      );
      if (e.predecessor.kind === "action") {
        const previous = link(
          "digital_custody_action",
          e.predecessor.id,
          "predecessor",
        );
        if (previous?.kind !== "digital_custody_action") continue;
        if (previous.artifactId !== e.artifactId)
          problem(
            "ARCHIVE.CUSTODY_SCOPE",
            `${p}/predecessor`,
            "A custody predecessor must concern the same exact artifact, not a different edition or derived file.",
          );
        const from = known(e, "from"),
          to = known(previous, "to");
        if (typeof from === "string" && typeof to === "string" && from !== to)
          problem(
            "ARCHIVE.CUSTODY_HANDOFF",
            `${p}/fields/from`,
            "Explicit predecessor recipient and next sender differ. Missing or conflicting parties are not repaired automatically.",
          );
        const now = known(e, "occurredAt") as EventTimeValue | undefined;
        const before = known(previous, "occurredAt") as
          | EventTimeValue
          | undefined;
        // Compare only comparable complete declarations. Calendar precision is never normalized into instants.
        if (
          now &&
          before &&
          now.kind !== "interval" &&
          before.kind === now.kind
        ) {
          if (comparePoints(before, now) > 0)
            problem(
              "ARCHIVE.CUSTODY_ORDER",
              `${p}/fields/occurredAt`,
              "Declared custody action precedes its explicit predecessor.",
            );
        }
      }
    }
  }
  function acyclic(graph: Map<string, string[]>, code: string) {
    const indegree = new Map([...graph.keys()].map((id) => [id, 0]));
    for (const edges of graph.values())
      for (const id of edges)
        if (indegree.has(id)) indegree.set(id, indegree.get(id)! + 1);
    const queue = [...indegree].filter(([, n]) => n === 0).map(([id]) => id);
    for (let i = 0; i < queue.length; i++)
      for (const id of graph.get(queue[i]!) ?? [])
        if (indegree.has(id)) {
          const count = indegree.get(id)! - 1;
          indegree.set(id, count);
          if (count === 0) queue.push(id);
        }
    if (queue.length !== graph.size)
      problem(
        code,
        "/entities",
        "Declared archival dependency links must be acyclic.",
      );
  }
  acyclic(derivation, "ARCHIVE.DERIVATION_CYCLE");
  acyclic(custody, "ARCHIVE.CUSTODY_CYCLE");
  const validation = {
    contract: result.contract,
    issues,
    uncheckedRefs: [...unchecked],
    checks: {
      ...result.checks,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
    },
  };
  return issues.length
    ? { ...validation, success: false as const }
    : { ...validation, success: true as const, data };
}
