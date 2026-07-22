import { describe, it, expect } from 'vitest';
import type { Observation } from '@disclosureos/records';
import type { SensorManifest } from '@disclosureos/instruments';
import { score, calibrationTrust, CALIBRATION_TRUST_WEIGHTS } from '../compellingness';

function manifest(status: 'none' | 'candidate_identified' | 'in_practice' | 'documented'): SensorManifest {
  return {
    schemaVersion: '1.0.0',
    org: 'US Navy',
    orgSlug: 'us-navy',
    sensors: [
      {
        id: 'princeton-spy1',
        name: 'AN/SPY-1B',
        modality: 'radio_frequency',
        calibration: { status },
      },
    ],
  };
}

function obs(extra: Record<string, unknown>): Observation & Record<string, unknown> {
  return {
    id: 'x',
    temporal: { date: '2004-11-14', dateCertainty: 'exact' },
    location: { id: 'l', name: 'Pacific', country: 'US', longitude: -117, latitude: 32, siteType: 'ocean' },
    status: 'published',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    sensorEvidence: {
      sensors: [
        {
          id: 'radar-1',
          sensorType: 'shipborne_radar',
          detectionMethod: 'radar_phased_array',
          sensorRef: 'us-navy:princeton-spy1',
        },
      ],
    },
    ...extra,
  } as unknown as Observation & Record<string, unknown>;
}

// Two competing claims on the same observable: a sensor-backed anomaly
// assertion and an unbacked null assertion. Calibration credit should pull
// the consensus point toward the instrument-backed claim.
const contestedCase = obs({
  observableAssessments: {
    technology: {
      antigravity_lift: [
        { level: 'measured', confidence: 0.8, evidenceRefs: ['sensor:radar-1'] },
        { level: 'not_indicated', confidence: 0.8 },
      ],
    },
    biologics: {},
  },
});

describe('calibrationTrust', () => {
  it('credits sensor-backed claims when the instrument has documented calibration', () => {
    const hook = calibrationTrust(contestedCase, [manifest('documented')]);
    expect(hook({ evidenceRefs: ['sensor:radar-1'] })).toBe(CALIBRATION_TRUST_WEIGHTS.documented);
    expect(hook({ evidenceRefs: [] })).toBe(CALIBRATION_TRUST_WEIGHTS.unresolved);
    expect(hook({})).toBe(CALIBRATION_TRUST_WEIGHTS.unresolved);
  });

  it('never penalizes below the unresolved baseline', () => {
    const hook = calibrationTrust(contestedCase, [manifest('none')]);
    expect(hook({ evidenceRefs: ['sensor:radar-1'] })).toBe(CALIBRATION_TRUST_WEIGHTS.unresolved);
  });

  it('treats missing manifests, unknown orgs, and unknown sensors as unresolved', () => {
    const noManifests = calibrationTrust(contestedCase, []);
    expect(noManifests({ evidenceRefs: ['sensor:radar-1'] })).toBe(CALIBRATION_TRUST_WEIGHTS.unresolved);

    const wrongOrg = calibrationTrust(contestedCase, [{ ...manifest('documented'), orgSlug: 'other-org' }]);
    expect(wrongOrg({ evidenceRefs: ['sensor:radar-1'] })).toBe(CALIBRATION_TRUST_WEIGHTS.unresolved);
  });

  it('takes the strongest instrument backing across a claim’s sensor refs', () => {
    const twoSensors = obs({});
    (twoSensors.sensorEvidence as { sensors: unknown[] }).sensors.push({
      id: 'radar-2',
      sensorType: 'shipborne_radar',
      detectionMethod: 'radar_phased_array',
      sensorRef: 'us-navy:princeton-spy2',
    });
    const twoEntryManifest: SensorManifest = {
      ...manifest('none'),
      sensors: [
        ...manifest('none').sensors,
        { id: 'princeton-spy2', name: 'SPY-2', modality: 'radio_frequency', calibration: { status: 'in_practice' } },
      ],
    };
    const hook = calibrationTrust(twoSensors, [twoEntryManifest]);
    expect(hook({ evidenceRefs: ['sensor:radar-1', 'sensor:radar-2'] })).toBe(
      CALIBRATION_TRUST_WEIGHTS.in_practice,
    );
  });

  it('composes with a base evaluatorWeight policy multiplicatively', () => {
    const hook = calibrationTrust(contestedCase, [manifest('documented')], {
      evaluatorWeight: () => 0.5,
    });
    expect(hook({ evidenceRefs: ['sensor:radar-1'] })).toBe(0.5 * CALIBRATION_TRUST_WEIGHTS.documented);
  });

  it('shifts the consensus point toward instrument-backed claims but leaves the range honest', () => {
    const baseline = score(contestedCase);
    const credited = score(contestedCase, {
      evaluatorWeight: calibrationTrust(contestedCase, [manifest('documented')]),
    });
    expect(credited.score).toBeGreaterThan(baseline.score);
    expect(credited.range).toEqual(baseline.range);
    expect(credited.contested).toBe(true);
  });

  it('honors overridden trust weights', () => {
    const hook = calibrationTrust(contestedCase, [manifest('documented')], {
      weights: { ...CALIBRATION_TRUST_WEIGHTS, documented: 2 },
    });
    expect(hook({ evidenceRefs: ['sensor:radar-1'] })).toBe(2);
  });
});
