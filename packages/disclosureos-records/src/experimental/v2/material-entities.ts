import {
  MaterialEntitiesSchema,
  MATERIAL_ENTITIES_SCHEMA_ID,
  type MaterialEntity,
} from "./material-entities-schema";
import {
  ArchivalEntitySchema,
  type ArchivalEntity,
} from "./archival-entities-schema";
import {
  parseEntityDocument,
  researchEntityAssertions,
} from "./entity-document-validation";
import { checkArchivalEntityLinks } from "./archival-entity-links";
import {
  checkTime,
  comparePoints,
  type EventTimeValue,
  type PrimitiveIssue,
} from "./primitives";
import type { ContextIssue } from "./context";
const archivalKinds = new Set<string>(
  ArchivalEntitySchema.options.map((s) => s.shape.kind.value),
);
export function parseMaterialEntities(input: unknown) {
  const result = parseEntityDocument(input, MaterialEntitiesSchema, {
    schemaId: MATERIAL_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.3.0",
  } as const);
  if (!result.success) return result;
  const data = result.data;
  // Reuse local link rules without rewriting the new document into an older contract.
  const inherited = checkArchivalEntityLinks(
    data.entities.flatMap((e, i) =>
      archivalKinds.has(e.kind) ? [[i, e as ArchivalEntity] as const] : [],
    ),
    result.uncheckedRefs,
  );
  const issues: ContextIssue[] = [...inherited.issues];
  const unchecked = new Set(inherited.uncheckedRefs);
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  const index = new Map(data.entities.map((e) => [`${e.kind}:${e.id}`, e]));
  const lineage = new Map<string, string[]>(),
    custody = new Map<string, string[]>();
  function known(e: MaterialEntity, field: string): unknown {
    const assertions = researchEntityAssertions(e).filter(
      (a) => a.field === field,
    );
    return assertions.length === 1 &&
      assertions[0]!.assertion.content.state === "known"
      ? assertions[0]!.assertion.content.value
      : undefined;
  }
  for (const [i, e] of data.entities.entries()) {
    if (archivalKinds.has(e.kind)) continue;
    const p = `/entities/${i}`;
    const link = (kind: string, id: string, field: string) => {
      const found = index.get(`${kind}:${id}`);
      if (!found)
        problem(
          "REF.ENTITY",
          `${p}/${field}`,
          "Typed local material entity does not exist.",
        );
      return found;
    };
    for (const { field, assertion } of researchEntityAssertions(e)) {
      if (
        !["collectionTime", "occurredAt"].includes(field) ||
        !("value" in assertion.content)
      )
        continue;
      const found: PrimitiveIssue[] = [];
      checkTime(
        assertion.content.value as EventTimeValue,
        `${p}/fields/${field}`,
        found,
      );
      found.forEach((x) => problem(x.code, x.pointer, x.message));
    }
    if (e.kind === "material") {
      lineage.set(e.id, []);
      if (e.selectionRef) {
        unchecked.add(e.selectionRef.document.sha256);
        if (e.selectionRef.sampleId !== e.id)
          problem(
            "MATERIAL.SELECTION_ID",
            `${p}/selectionRef/sampleId`,
            "Reuse the selected specimen identity rather than creating a second identity.",
          );
      }
      if (e.lineage.kind === "collected" && e.lineage.traceId)
        link("material_trace", e.lineage.traceId, "lineage/traceId");
      if (e.lineage.kind === "derived") {
        const preparation = link(
          "material_preparation",
          e.lineage.preparationId,
          "lineage/preparationId",
        );
        if (preparation?.kind === "material_preparation") {
          lineage.set(e.id, preparation.inputMaterialIds);
          if (!preparation.outputMaterialIds.includes(e.id))
            problem(
              "MATERIAL.PREPARATION_OUTPUT",
              `${p}/lineage/preparationId`,
              "The named preparation must declare this specimen as an output.",
            );
        }
      }
    }
    if (e.kind === "material_preparation") {
      for (const field of ["inputMaterialIds", "outputMaterialIds"] as const) {
        if (new Set(e[field]).size !== e[field].length)
          problem(
            "REF.UNIQUE_ID",
            `${p}/${field}`,
            "A preparation repeats a material identity.",
          );
        for (const id of e[field]) {
          const material = link("material", id, field);
          if (
            field === "outputMaterialIds" &&
            material?.kind === "material" &&
            (material.lineage.kind !== "derived" ||
              material.lineage.preparationId !== e.id)
          )
            problem(
              "MATERIAL.PREPARATION_OUTPUT",
              `${p}/${field}`,
              "Each output must identify this preparation in its derived lineage.",
            );
        }
      }
      if (e.inputMaterialIds.some((id) => e.outputMaterialIds.includes(id)))
        problem(
          "MATERIAL.SELF_DERIVATION",
          p,
          "An output must have its own material identity, distinct from every input.",
        );
      if (
        (e.operation === "split" &&
          (e.inputMaterialIds.length !== 1 ||
            e.outputMaterialIds.length < 2)) ||
        (e.operation === "mixture" &&
          (e.inputMaterialIds.length < 2 || e.outputMaterialIds.length !== 1))
      )
        problem(
          "MATERIAL.PREPARATION_ARITY",
          p,
          "A split declares one input and at least two outputs; a mixture declares at least two inputs and one output.",
        );
    }
    if (e.kind === "material_custody_action") {
      const material = link("material", e.materialId, "materialId");
      if (e.transferRef) {
        unchecked.add(e.transferRef.document.sha256);
        if (
          e.transferRef.transferId !== e.id ||
          e.transferRef.sampleId !== e.materialId
        )
          problem(
            "MATERIAL.TRANSFER_ID",
            `${p}/transferRef`,
            "Reuse the selected transfer and specimen identities.",
          );
        const selected =
          material?.kind === "material" ? material.selectionRef : undefined;
        if (
          !selected ||
          selected.document.documentId !== e.transferRef.document.documentId ||
          selected.document.sha256 !== e.transferRef.document.sha256
        )
          problem(
            "MATERIAL.SELECTION_SCOPE",
            `${p}/transferRef/document`,
            "The transfer must describe the specimen's same explicitly selected snapshot.",
          );
      }
      custody.set(e.id, []);
      if (e.predecessor.kind !== "action") continue;
      custody.set(e.id, [e.predecessor.id]);
      const previous = link(
        "material_custody_action",
        e.predecessor.id,
        "predecessor/id",
      );
      if (previous?.kind !== "material_custody_action") continue;
      if (previous.materialId !== e.materialId)
        problem(
          "MATERIAL.CUSTODY_SCOPE",
          `${p}/predecessor`,
          "A predecessor must concern the same physical specimen. Parent custody is not inherited by a derived sample.",
        );
      const sender = known(e, "from"),
        recipient = known(previous, "to");
      if (
        typeof sender === "string" &&
        typeof recipient === "string" &&
        sender !== recipient
      )
        problem(
          "MATERIAL.CUSTODY_HANDOFF",
          `${p}/fields/from`,
          "Unambiguous predecessor recipient and next sender declarations differ.",
        );
      const now = known(e, "occurredAt") as EventTimeValue | undefined,
        before = known(previous, "occurredAt") as EventTimeValue | undefined;
      if (
        now &&
        before &&
        now.kind !== "interval" &&
        before.kind === now.kind &&
        comparePoints(before, now) > 0
      )
        problem(
          "MATERIAL.CUSTODY_ORDER",
          `${p}/fields/occurredAt`,
          "The declared action precedes its explicit predecessor.",
        );
    }
  }
  function acyclic(graph: Map<string, string[]>, code: string) {
    const degree = new Map([...graph.keys()].map((id) => [id, 0]));
    for (const edges of graph.values())
      for (const id of edges)
        if (degree.has(id)) degree.set(id, degree.get(id)! + 1);
    const queue = [...degree].filter(([, n]) => n === 0).map(([id]) => id);
    for (let i = 0; i < queue.length; i++)
      for (const id of graph.get(queue[i]!) ?? [])
        if (degree.has(id)) {
          const next = degree.get(id)! - 1;
          degree.set(id, next);
          if (next === 0) queue.push(id);
        }
    if (queue.length !== graph.size)
      problem(
        code,
        "/entities",
        "Declared physical lineage and custody dependencies must be acyclic.",
      );
  }
  acyclic(lineage, "MATERIAL.LINEAGE_CYCLE");
  acyclic(custody, "MATERIAL.CUSTODY_CYCLE");
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
