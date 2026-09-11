import {
  evaluateEntityHistory,
  type ResearchReviewOptions,
  type ResearchReviewResult,
} from "./entity-history-review";
export type ArchivalReviewOptions = ResearchReviewOptions;
export type ArchivalReviewResult = ResearchReviewResult;
/** Checks 0.4 histories and exact 0.2 entity snapshots; never fetches source files or authenticates them. */
export async function evaluateArchivalClaimHistory(
  input: unknown,
  options: ArchivalReviewOptions,
): Promise<ArchivalReviewResult> {
  return evaluateEntityHistory(input, options, true);
}
