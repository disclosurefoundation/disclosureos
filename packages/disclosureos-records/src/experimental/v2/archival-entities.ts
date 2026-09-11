import {
  ArchivalEntitiesSchema,
  ARCHIVAL_ENTITIES_SCHEMA_ID,
} from "./archival-entities-schema";
import { parseEntityDocument } from "./entity-document-validation";
import { checkArchivalEntityLinks } from "./archival-entity-links";
export { archivalArtifactReferences } from "./archival-entity-links";
export function parseArchivalEntities(input: unknown) {
  const result = parseEntityDocument(input, ArchivalEntitiesSchema, {
    schemaId: ARCHIVAL_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.2.0",
  } as const);
  if (!result.success) return result;
  const data = result.data;
  const { issues, uncheckedRefs } = checkArchivalEntityLinks(
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
