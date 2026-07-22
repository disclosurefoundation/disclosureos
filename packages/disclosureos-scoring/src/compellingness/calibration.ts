import type { Observation } from '@disclosureos/records';
import { parseEvidenceRef, parseSensorRef } from '@disclosureos/records/shared';
import type { CalibrationStatus, SensorManifest } from '@disclosureos/instruments';
import type { EvaluatorWeightInput } from './index';

/**
 * Trust multiplier per calibration maturity level, plus the `unresolved`
 * baseline for claims whose sensor evidence does not resolve to a manifest
 * entry (no `sensorRef`, unknown org, unknown sensor, or no calibration block).
 */
export type CalibrationTrustWeights = Record<CalibrationStatus | 'unresolved', number>;

/**
 * Conservative default gradient: instruments with real calibration provenance
 * earn *credit* over unresolved sensors — nothing is ever penalized below the
 * baseline, so adopting the hook can only reward organizations that publish
 * manifests, never punish records that predate them.
 *
 * @experimental The shape is stable; these specific values are a reference
 * policy that may be re-tuned in a minor release. Pin your own `weights` via
 * {@link CalibrationTrustOptions} if you need stable numbers.
 */
export const CALIBRATION_TRUST_WEIGHTS: CalibrationTrustWeights = {
  unresolved: 1,
  none: 1,
  candidate_identified: 1.05,
  in_practice: 1.15,
  documented: 1.25,
};

export interface CalibrationTrustOptions {
  /** Override the trust gradient (defaults to {@link CALIBRATION_TRUST_WEIGHTS}). */
  weights?: CalibrationTrustWeights;
  /**
   * A base trust policy composed (multiplied) with the calibration credit —
   * e.g. an evaluator-identity policy. Defaults to uniform 1.0.
   */
  evaluatorWeight?: (claim: EvaluatorWeightInput) => number;
}

/**
 * Build an `evaluatorWeight` hook (see `ScoreOptions.evaluatorWeight`) that
 * credits claims backed by instruments with published calibration provenance.
 *
 * Resolution chain, per claim: `evidenceRefs` (`"sensor:<id>"`) → the
 * observation's `sensorEvidence.sensors[]` reading → its `sensorRef`
 * (`"<org-slug>:<sensor-id>"`) → the matching manifest entry's
 * `calibration.status`. When a claim cites several sensor readings, the
 * strongest instrument backing wins. Claims with no resolvable sensor
 * evidence get the `unresolved` baseline.
 *
 * Like every `evaluatorWeight` policy, this shifts only the consensus point
 * estimate — `range` and `contested` still report the honest spread of what
 * evaluators actually asserted.
 *
 * ```ts
 * const result = score(observation, {
 *   evaluatorWeight: calibrationTrust(observation, [navyManifest]),
 * });
 * ```
 */
export function calibrationTrust(
  observation: Observation,
  manifests: readonly SensorManifest[],
  options?: CalibrationTrustOptions,
): (claim: EvaluatorWeightInput) => number {
  const weights = options?.weights ?? CALIBRATION_TRUST_WEIGHTS;
  const base = options?.evaluatorWeight ?? ((): number => 1);

  // Pre-resolve each in-record sensor reading to its manifest calibration status.
  const statusBySensorId = new Map<string, CalibrationStatus>();
  for (const reading of observation.sensorEvidence?.sensors ?? []) {
    if (!reading.sensorRef) continue;
    const ref = parseSensorRef(reading.sensorRef);
    if (!ref) continue;
    const entry = manifests
      .find((manifest) => manifest.orgSlug === ref.orgSlug)
      ?.sensors.find((sensor) => sensor.id === ref.sensorId);
    const status = entry?.calibration?.status;
    if (status) statusBySensorId.set(reading.id, status);
  }

  return (claim) => {
    let credit = weights.unresolved;
    for (const evidence of claim.evidenceRefs ?? []) {
      const parsed = parseEvidenceRef(evidence);
      if (!parsed || parsed.kind !== 'sensor') continue;
      const status = statusBySensorId.get(parsed.id);
      const weight = status === undefined ? weights.unresolved : weights[status];
      if (weight > credit) credit = weight;
    }
    return base(claim) * credit;
  };
}
