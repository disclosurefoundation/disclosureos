import {
  LaboratoryClaimHistorySchema,
  LABORATORY_CLAIM_HISTORY_SCHEMA_ID,
} from "./laboratory-claim-history-schema";
import { parseEntityClaimHistory } from "./entity-claim-history-validation";
import { checkArchivalClaimLinks } from "./archival-claim-links";
export function parseLaboratoryClaimHistory(input: unknown) {
  const result = parseEntityClaimHistory(input, LaboratoryClaimHistorySchema, {
    kind: "claim_history",
    schemaId: LABORATORY_CLAIM_HISTORY_SCHEMA_ID,
    rulesetVersion: "0.5.0",
  } as const);
  if (!result.success) return result;
  const data = result.data,
    issues = checkArchivalClaimLinks(data);
  for (const [i, c] of data.claims.entries()) {
    const review =
      c.kind === "source_assertion"
        ? c.reportedMaterialReview
        : c.status === "assessed"
          ? c.materialReview
          : undefined;
    if (!review) continue;
    if (
      c.subject.kind !== "entity" ||
      ![
        "material",
        "material_trace",
        "material_preparation",
        "material_custody_action",
        "laboratory_analysis",
        "laboratory_result",
      ].includes(c.subject.reference.target.kind)
    )
      issues.push({
        code: "MATERIAL.REVIEW_SUBJECT",
        stage: "semantic",
        pointer: `/claims/${i}`,
        message:
          "Material review requires an exact material or laboratory entity subject.",
      });
    if (
      c.kind === "assessment" &&
      c.inputRefs.length +
        (c.entityInputRefs?.length ?? 0) +
        (c.contextInputRefs?.length ?? 0) +
        (c.editionInputRefs?.length ?? 0) ===
        0
    )
      issues.push({
        code: "REF.LOCAL_RESOLUTION",
        stage: "semantic",
        pointer: `/claims/${i}`,
        message:
          "Material review requires explicit inputs; source labels alone do not establish quality.",
      });
  }
  const validation = {
    contract: result.contract,
    issues,
    uncheckedRefs: result.uncheckedRefs,
    checks: {
      ...result.checks,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
    },
  };
  return issues.length
    ? { ...validation, success: false as const }
    : {
        ...validation,
        success: true as const,
        data,
        currentClaimRefs: result.currentClaimRefs,
      };
}
