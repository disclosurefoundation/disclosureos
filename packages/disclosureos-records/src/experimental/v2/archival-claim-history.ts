import {
  ArchivalClaimHistorySchema,
  ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID,
} from "./archival-claim-history-schema";
import { parseEntityClaimHistory } from "./entity-claim-history-validation";
import { checkArchivalClaimLinks } from "./archival-claim-links";
export function parseArchivalClaimHistory(input: unknown) {
  const result = parseEntityClaimHistory(input, ArchivalClaimHistorySchema, {
    kind: "claim_history",
    schemaId: ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID,
    rulesetVersion: "0.4.0",
  } as const);
  if (!result.success) return result;
  const data = result.data;
  const issues = checkArchivalClaimLinks(data);
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
