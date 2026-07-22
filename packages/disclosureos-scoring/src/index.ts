// === Completeness (is it well-documented?) ===
export {
  getCompleteness,
  deriveFieldPaths,
  CompletenessResultSchema,
} from './completeness';
export type { CompletenessResult, CompletenessOptions, FieldPath } from './completeness';

// === Compellingness (is it anomalous / non-mundane?) ===
export {
  score,
  rankByCompellingness,
  DEFAULT_WEIGHTS,
  DEFAULT_PROSAIC_OCS_PREFIXES,
  ASSESSMENT_LEVEL_WEIGHTS,
  SCORING_VERSION,
  CompellingnessWeightsSchema,
  ScoreResultSchema,
} from './compellingness';
export type {
  CompellingnessWeights,
  ScoreResult,
  ScoreOptions,
  EvaluatorWeightInput,
  RankedObservation,
} from './compellingness';

// === Instrument trust (calibration provenance as a scoring input) ===
export { calibrationTrust, CALIBRATION_TRUST_WEIGHTS } from './compellingness';
export type { CalibrationTrustWeights, CalibrationTrustOptions } from './compellingness';

// === JSON Schema artifact ===
export { scoringJsonSchema, SCORING_SCHEMA_VERSION, SCORING_SCHEMA_ID } from './schema';
