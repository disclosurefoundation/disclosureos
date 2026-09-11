import {
  ResearchClaimHistorySchema,
  RESEARCH_CLAIM_HISTORY_SCHEMA_ID,
  RESEARCH_CLAIM_HISTORY_RULESET_VERSION,
} from "./research-claim-history-schema";
import type {
  ResearchClaimHistory,
} from "./research-claim-history-schema";
import type { ObservationChecks, ObservationIssueCode } from "./observation";

export type ResearchClaimHistoryIssueCode =
  | ObservationIssueCode
  | "CLAIM.SUPERSESSION_SCOPE"
  | "CLAIM.REVISION_ORDER"
  | "CLAIM.DEPENDENCY_CYCLE"
  | "CLAIM.EVALUATION_ORDER"
  | "CLAIM.REVISION_ATTRIBUTION";
export interface ResearchClaimHistoryIssue {
  code: ResearchClaimHistoryIssueCode;
  stage: "structural" | "semantic";
  severity: "error";
  pointer: string;
  message: string;
}
export interface ResearchClaimHistoryValidation {
  checks: ObservationChecks;
  issues: ResearchClaimHistoryIssue[];
  uncheckedRefs: string[];
  contract: {
    kind: "claim_history";
    schemaId: typeof RESEARCH_CLAIM_HISTORY_SCHEMA_ID;
    rulesetVersion: typeof RESEARCH_CLAIM_HISTORY_RULESET_VERSION;
  };
}
export type ResearchClaimHistoryParseResult = ResearchClaimHistoryValidation &
  (
    | { success: true; data: ResearchClaimHistory; currentClaimRefs: string[] }
    | { success: false }
  );
import { parseEntityClaimHistory } from "./entity-claim-history-validation";
export function parseResearchClaimHistory(
  input: unknown,
): ResearchClaimHistoryParseResult {
  return parseEntityClaimHistory(input, ResearchClaimHistorySchema, {
    kind: "claim_history",
    schemaId: RESEARCH_CLAIM_HISTORY_SCHEMA_ID,
    rulesetVersion: RESEARCH_CLAIM_HISTORY_RULESET_VERSION,
  } as const);
}
