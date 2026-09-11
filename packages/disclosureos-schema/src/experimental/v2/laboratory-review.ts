import {
  evaluateEntityHistory,
  type ResearchReviewOptions,
  type ResearchReviewResult,
} from "./entity-history-review";
export type LaboratoryReviewOptions = ResearchReviewOptions;
export type LaboratoryReviewResult = Omit<
  ResearchReviewResult,
  "integrityScope"
> & {
  integrityScope: "supplied_entities_context_observation_acquisition_and_specimen_selection_snapshot_bytes";
};
/** Explicit 0.5 history and 0.4 entities. Snapshot checks do not validate physical specimens, laboratory execution or source artifact bytes. */
export async function evaluateLaboratoryClaimHistory(
  input: unknown,
  options: LaboratoryReviewOptions,
): Promise<LaboratoryReviewResult> {
  const result = await evaluateEntityHistory(input, options, "laboratory");
  return {
    ...result,
    integrityScope:
      "supplied_entities_context_observation_acquisition_and_specimen_selection_snapshot_bytes",
  };
}
