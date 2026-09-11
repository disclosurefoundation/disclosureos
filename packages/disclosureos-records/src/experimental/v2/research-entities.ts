import {
  ResearchEntitiesSchema,
  RESEARCH_ENTITIES_SCHEMA_ID,
} from "./research-entities-schema";
import { parseEntityDocument } from "./entity-document-validation";
export {
  researchEntityAssertions,
  researchEntityContextReferences,
} from "./entity-document-validation";
export function parseResearchEntities(input: unknown) {
  return parseEntityDocument(input, ResearchEntitiesSchema, {
    schemaId: RESEARCH_ENTITIES_SCHEMA_ID,
    rulesetVersion: "0.1.0",
  } as const);
}
