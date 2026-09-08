/**
 * Field-presence coverage of the legacy records schema. This is the existing
 * counter under a descriptive name, not an analytical-completeness profile.
 * No validation, applicability assessment or reproducibility certification runs.
 */
export {
  getCompleteness as getPopulationCoverage,
  deriveFieldPaths,
} from "../completeness";
export type {
  CompletenessResult as PopulationCoverageResult,
  CompletenessOptions as PopulationCoverageOptions,
  FieldPath,
} from "../completeness";
