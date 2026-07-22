import { z } from 'zod';
import type { Observation } from '@disclosureos/records';
import type { AssessmentLevel, ObservableClaim } from '@disclosureos/observables';
import type { OriginClaim } from '@disclosureos/origins';
// Side-effect imports register the `observableAssessments` and `origin` slots on
// `Observation` via module augmentation, so they are typed below.
import '@disclosureos/observables';
import '@disclosureos/origins';

export { calibrationTrust, CALIBRATION_TRUST_WEIGHTS } from './calibration';
export type { CalibrationTrustWeights, CalibrationTrustOptions } from './calibration';

/** Methodology version stamped on every {@link ScoreResult}. Bump on weight/formula changes. */
export const SCORING_VERSION = '2.0.0' as const;

/**
 * Ordinal anomaly strength per evidentiary tier. A `confirmed` signal counts
 * fully; `not_indicated` contributes nothing. Multiplied by the assessment's
 * confidence (default 1 when unstated). Exported so consumers can render the
 * methodology; override semantics may come in a future minor release.
 */
export const ASSESSMENT_LEVEL_WEIGHTS: Record<AssessmentLevel, number> = {
  not_indicated: 0,
  reported: 0.25,
  documented: 0.5,
  measured: 0.75,
  confirmed: 1,
};

/**
 * OCS id prefixes treated as prosaic (well-explained). A confident *prosaic*
 * classification means the case is explained, so it contributes no anomaly
 * signal. Overridable per {@link score} call. Default is the OCS "Prosaic"
 * branch (`1.1.1`).
 */
export const DEFAULT_PROSAIC_OCS_PREFIXES: readonly string[] = ['1.1.1'];

export const CompellingnessWeightsSchema = z
  .object({
    technology: z.number().min(0).describe('Weight of the technology-anomaly signal.'),
    biologics: z.number().min(0).describe('Weight of the biologics-anomaly signal.'),
    origin: z.number().min(0).describe('Weight of the (non-prosaic) origin-confidence signal.'),
  })
  .meta({ id: 'CompellingnessWeights' })
  .describe('Relative weights for the compellingness components. Need not sum to 1 — normalized internally.');

export type CompellingnessWeights = z.infer<typeof CompellingnessWeightsSchema>;

/**
 * Fixed default weights, exposed as a transparent, overridable data object (not a
 * config system). Partners can propose alternate weight sets without an API change.
 *
 * @experimental The *shape* (`CompellingnessWeights`) is stable, but these specific
 * default values are a reference methodology that may be re-tuned in a minor release.
 * Pin your own `weights` via {@link ScoreOptions} if you need stable numbers.
 */
export const DEFAULT_WEIGHTS: CompellingnessWeights = {
  technology: 0.45,
  biologics: 0.35,
  origin: 0.2,
};

export const ScoreResultSchema = z
  .object({
    score: z.number().min(0).max(1).describe('Overall compellingness (consensus point estimate), 0–1.'),
    range: z
      .object({
        low: z.number().min(0).max(1).describe('Most-skeptical reading of the strongest-anomaly signal across competing claims.'),
        high: z.number().min(0).max(1).describe('Most-anomalous reading of the strongest-anomaly signal across competing claims.'),
      })
      .describe(
        'Spread of the score across competing claims — wide range signals disagreement. Bounds are '
        + 'computed per-signal under the same strongest-anomaly (max) reduction as the point estimate, '
        + 'not a global min/max over every claim.',
      ),
    contested: z
      .boolean()
      .describe('True when claims disagree on *direction* (some assert anomaly, some assert none).'),
    components: z
      .object({
        technology: z.number().min(0).max(1),
        biologics: z.number().min(0).max(1),
        origin: z.number().min(0).max(1),
      })
      .describe('Per-signal consensus contributions before weighting.'),
    weights: CompellingnessWeightsSchema,
    scoringVersion: z.string().describe('Methodology version that produced this score.'),
  })
  .meta({ id: 'ScoreResult' })
  .describe('A reference compellingness score for an observation, with a contestedness range.');

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

/** The minimal claim shape the trust hook sees (it never needs the full body). */
export type EvaluatorWeightInput = {
  evaluatedBy?: string | undefined;
  evidenceRefs?: string[] | undefined;
};

export interface ScoreOptions {
  weights?: CompellingnessWeights;
  /** Override the prosaic OCS prefixes (defaults to {@link DEFAULT_PROSAIC_OCS_PREFIXES}). */
  prosaicPrefixes?: readonly string[];
  /**
   * Trust applied to each claim's vote in the consensus point estimate (default
   * 1.0 — uniform). This is where a future trust policy (e.g.
   * weighting verified/official evaluators higher) plugs in here without changing
   * the formula. Range/contestedness are NOT affected — they report the honest
   * spread of what evaluators actually asserted.
   *
   * @experimental The hook signature is stable, but the default trust *policy*
   * (uniform 1.0) is deliberately unopinionated and is a separate, ongoing design
   * task; a future built-in policy may change the default.
   */
  evaluatorWeight?: (claim: EvaluatorWeightInput) => number;
}

const UNIFORM_TRUST = (): number => 1;

function isProsaic(id: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => id === p || id.startsWith(`${p}.`));
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

type Weighted = { magnitude: number; weight: number };

interface ClaimStats {
  /** Trust-weighted mean magnitude (the consensus point). */
  point: number;
  /** Min asserted magnitude (most skeptical). */
  low: number;
  /** Max asserted magnitude (most anomalous). */
  high: number;
  /** Claims disagree on direction (some > 0, some === 0). */
  contested: boolean;
}

const EMPTY_STATS: ClaimStats = { point: 0, low: 0, high: 0, contested: false };

function reduceClaims(weighted: Weighted[]): ClaimStats {
  if (weighted.length === 0) return EMPTY_STATS;
  let wsum = 0;
  let msum = 0;
  let low = Infinity;
  let high = -Infinity;
  let anyAnomaly = false;
  let anyNone = false;
  for (const { magnitude, weight } of weighted) {
    wsum += weight;
    msum += magnitude * weight;
    if (magnitude < low) low = magnitude;
    if (magnitude > high) high = magnitude;
    if (magnitude > 0) anyAnomaly = true;
    else anyNone = true;
  }
  return {
    point: wsum > 0 ? msum / wsum : 0,
    low,
    high,
    contested: anyAnomaly && anyNone,
  };
}

/** Asserted anomaly magnitude of one observable claim, in [0,1]. */
function observableMagnitude(claim: ObservableClaim): number {
  return ASSESSMENT_LEVEL_WEIGHTS[claim.level] * (claim.confidence ?? 1);
}

/**
 * Strongest established anomaly within a domain — the "is there *any* anomaly?" reduction.
 * `point`/`low`/`high` are each a **max across observables** of that observable's claim-list
 * stat. So `low` is "the most-skeptical reading of the strongest-anomaly observable," not a
 * global floor across all observables — consistent with the point estimate's max reduction.
 */
function domainStats(
  group: Partial<Record<string, ObservableClaim[]>> | undefined,
  evaluatorWeight: (claim: EvaluatorWeightInput) => number,
): ClaimStats {
  if (!group) return EMPTY_STATS;
  let point = 0;
  let low = 0;
  let high = 0;
  let contested = false;
  for (const claims of Object.values(group)) {
    if (!claims || claims.length === 0) continue;
    const weighted = claims.map<Weighted>((c) => ({
      magnitude: observableMagnitude(c),
      weight: (c.confidence ?? 1) * evaluatorWeight(c),
    }));
    const stats = reduceClaims(weighted);
    if (stats.point > point) point = stats.point;
    if (stats.low > low) low = stats.low;
    if (stats.high > high) high = stats.high;
    if (stats.contested) contested = true;
  }
  return { point, low, high, contested };
}

/** Confidence in a *non-prosaic* origin, reduced across competing classifications. */
function originStats(
  origin: OriginClaim[] | undefined,
  prefixes: readonly string[],
  evaluatorWeight: (claim: EvaluatorWeightInput) => number,
): ClaimStats {
  if (!origin || origin.length === 0) return EMPTY_STATS;
  const weighted = origin.map<Weighted>((c) => ({
    magnitude: isProsaic(c.primaryHypothesis, prefixes) ? 0 : c.confidence,
    weight: c.confidence * evaluatorWeight(c),
  }));
  return reduceClaims(weighted);
}

/**
 * Reference compellingness scorer. Combines the strongest technology- and
 * biologics-anomaly signals (from `observableAssessments`) with the confidence in
 * a *non-prosaic* origin classification (from `origin`), under transparent,
 * overridable weights. Each slot is a *list* of competing claims, so the scorer
 * reports a consensus `score`, the `range` of readings across claims, and whether
 * the case is `contested` (evaluators disagree on direction). This answers "how
 * strongly does this case bear on the two public questions — anomalous
 * tech/biologics, and a non-mundane origin?" — distinct from completeness.
 */
export function score(observation: Observation, options?: ScoreOptions): ScoreResult {
  const weights = options?.weights ?? DEFAULT_WEIGHTS;
  const prosaicPrefixes = options?.prosaicPrefixes ?? DEFAULT_PROSAIC_OCS_PREFIXES;
  const evaluatorWeight = options?.evaluatorWeight ?? UNIFORM_TRUST;

  const assessments = observation.observableAssessments;
  const technology = domainStats(assessments?.technology, evaluatorWeight);
  const biologics = domainStats(assessments?.biologics, evaluatorWeight);
  const origin = originStats(observation.origin, prosaicPrefixes, evaluatorWeight);

  const totalWeight = weights.technology + weights.biologics + weights.origin;
  const combine = (t: number, b: number, o: number): number =>
    totalWeight > 0
      ? (t * weights.technology + b * weights.biologics + o * weights.origin) / totalWeight
      : 0;

  return {
    score: round(combine(technology.point, biologics.point, origin.point)),
    range: {
      low: round(combine(technology.low, biologics.low, origin.low)),
      high: round(combine(technology.high, biologics.high, origin.high)),
    },
    contested: technology.contested || biologics.contested || origin.contested,
    components: {
      technology: round(technology.point),
      biologics: round(biologics.point),
      origin: round(origin.point),
    },
    weights,
    scoringVersion: SCORING_VERSION,
  };
}

export interface RankedObservation<T extends Observation = Observation> {
  observation: T;
  result: ScoreResult;
}

/**
 * Score a set of observations and return them sorted most-compelling first — the
 * "float the strongest cases to the top" use case.
 */
export function rankByCompellingness<T extends Observation>(
  observations: readonly T[],
  options?: ScoreOptions,
): RankedObservation<T>[] {
  return observations
    .map((observation) => ({ observation, result: score(observation, options) }))
    .sort((a, b) => b.result.score - a.result.score);
}
