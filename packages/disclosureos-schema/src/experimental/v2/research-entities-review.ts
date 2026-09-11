import {
  evaluateEntityHistory,
  type ResearchReviewOptions,
  type ResearchReviewResult,
} from "./entity-history-review";
export type {
  ResearchReviewOptions,
  ResearchReviewResult,
} from "./entity-history-review";
export async function evaluateResearchClaimHistory(
  input: unknown,
  options: ResearchReviewOptions,
): Promise<ResearchReviewResult> {
  return evaluateEntityHistory(input, options, "research");
}
