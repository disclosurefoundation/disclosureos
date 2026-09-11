import {
  MaterialEntitiesSchema,
  MATERIAL_ENTITIES_SCHEMA_ID,
} from "./material-entities-schema";
import { parseEntityDocument } from "./entity-document-validation";
import { checkMaterialEntityLinks } from "./material-entity-links";
export function parseMaterialEntities(input: unknown) {
  const result = parseEntityDocument(input, MaterialEntitiesSchema, {
    schemaId: MATERIAL_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.3.0",
  } as const);
  if (!result.success) return result;
  const data = result.data;
  const { issues, uncheckedRefs } = checkMaterialEntityLinks(
    [...data.entities.entries()],
    result.uncheckedRefs,
  );
  const validation = {
    contract: result.contract,
    issues,
    uncheckedRefs,
    checks: {
      ...result.checks,
      semantic: issues.length ? ("failed" as const) : ("passed" as const),
    },
  };
  return issues.length
    ? { ...validation, success: false as const }
    : { ...validation, success: true as const, data };
}
