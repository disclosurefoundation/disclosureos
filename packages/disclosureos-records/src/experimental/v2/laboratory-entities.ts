import {
  LaboratoryEntitiesSchema,
  LABORATORY_ENTITIES_SCHEMA_ID,
} from "./laboratory-entities-schema";
import { parseEntityDocument } from "./entity-document-validation";
import { checkMaterialEntityLinks } from "./material-entity-links";
export function parseLaboratoryEntities(input: unknown) {
  const result = parseEntityDocument(input, LaboratoryEntitiesSchema, {
    schemaId: LABORATORY_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.4.0",
  } as const);
  if (!result.success) return result;
  const data = result.data;
  const inherited = checkMaterialEntityLinks(
    data.entities.flatMap((e, i) =>
      e.kind === "laboratory_analysis" || e.kind === "laboratory_result"
        ? []
        : [[i, e] as const],
    ),
    result.uncheckedRefs,
  );
  const issues = [...inherited.issues],
    unchecked = new Set(inherited.uncheckedRefs);
  const problem = (code: string, pointer: string, message: string) =>
    issues.push({ code, pointer, message, stage: "semantic" });
  const index = new Map(data.entities.map((e) => [`${e.kind}:${e.id}`, e]));
  for (const [i, e] of data.entities.entries()) {
    if (e.kind !== "laboratory_analysis" && e.kind !== "laboratory_result")
      continue;
    const p = `/entities/${i}`;
    const link = (kind: string, id: string, field: string) => {
      const value = index.get(`${kind}:${id}`);
      if (!value)
        problem(
          "REF.ENTITY",
          `${p}/${field}`,
          "Typed local laboratory dependency does not exist.",
        );
      return value;
    };
    for (const a of e.fields.reportArtifacts ?? [])
      if ("value" in a.content) {
        if (
          new Set(a.content.value.map((r) => JSON.stringify(r))).size !==
          a.content.value.length
        )
          problem(
            "REF.UNIQUE_ID",
            `${p}/fields/reportArtifacts`,
            "Report artifacts repeat within an assertion.",
          );
        for (const ref of a.content.value) unchecked.add(ref.sourceRef);
      }
    if (e.kind === "laboratory_analysis") {
      for (const field of [
        "inputMaterialIds",
        "preparationIds",
        "resultIds",
      ] as const) {
        const ids = e[field] ?? [];
        if (new Set(ids).size !== ids.length)
          problem(
            "REF.UNIQUE_ID",
            `${p}/${field}`,
            "Analysis dependencies repeat.",
          );
        for (const id of ids) {
          const target = link(
            field === "inputMaterialIds"
              ? "material"
              : field === "preparationIds"
                ? "material_preparation"
                : "laboratory_result",
            id,
            field,
          );
          if (
            target?.kind === "laboratory_result" &&
            target.analysisId !== e.id
          )
            problem(
              "LAB.RESULT_SCOPE",
              `${p}/${field}`,
              "Each declared result must name this same analysis.",
            );
          if (
            target?.kind === "material_preparation" &&
            !target.outputMaterialIds.some((id) =>
              e.inputMaterialIds.includes(id),
            )
          )
            problem(
              "LAB.PREPARATION_SCOPE",
              `${p}/${field}`,
              "A selected preparation must produce an input specimen of this analysis.",
            );
        }
      }
      for (const a of e.fields.method ?? [])
        if ("value" in a.content) unchecked.add(a.content.value.methodRef);
    } else {
      link("material", e.materialId, "materialId");
      const analysis = link("laboratory_analysis", e.analysisId, "analysisId");
      if (
        analysis?.kind === "laboratory_analysis" &&
        (!analysis.resultIds.includes(e.id) ||
          !analysis.inputMaterialIds.includes(e.materialId))
      )
        problem(
          "LAB.RESULT_SCOPE",
          p,
          "A result must belong to its analysis and one exact input specimen; parent and sibling results are not interchangeable.",
        );
      for (const a of e.fields.result ?? [])
        if ("value" in a.content && a.content.value.kind === "quantitative")
          unchecked.add(`measurement:${a.content.value.measurementId}`);
    }
  }
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
