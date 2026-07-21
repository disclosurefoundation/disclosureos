import { describe, it, expect } from 'vitest';
import { validateSensorManifest } from '../validators';
import { createSensorEntry, createSensorManifest } from '../factories';
import { formatSensorEntry, formatSensorManifest } from '../formatters';
import { isModality, isCalibrationStatus } from '../guards';
import type { SensorEntry } from '../manifest/types';

function passiveRadar(overrides?: Partial<SensorEntry>): SensorEntry {
  return createSensorEntry('dionysus-passive-radar', 'Passive Bistatic Radar', 'radio_frequency', {
    recordsMapping: { sensorType: 'passive_radar', detectionMethod: 'radio_frequency' },
    timing: { timeSource: 'gps_disciplined', timeUncertaintyNs: null },
    measurements: [
      { name: 'bistatic_range', unit: 'm', uncertainty: { u_c: null, U: null, k: 2, type: 'B' } },
    ],
    calibration: {
      status: 'in_practice',
      currentMethod: 'continuous ADS-B truth association with match residuals recorded',
      traceableReference: 'ADS-B Exchange',
      referenceInUse: true,
    },
    ...overrides,
  });
}

describe('validateSensorManifest', () => {
  it('accepts a valid manifest', () => {
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [passiveRadar()]);
    expect(validateSensorManifest(manifest)).toEqual([]);
  });

  it('accepts a proposed sensor type when flagged', () => {
    const sensor = passiveRadar({
      recordsMapping: {
        sensorType: 'brand_new_type',
        detectionMethod: 'radio_frequency',
        proposedSensorType: true,
      },
    });
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [sensor]);
    expect(validateSensorManifest(manifest)).toEqual([]);
  });

  it('rejects an unflagged sensor type outside the records enum', () => {
    const sensor = passiveRadar({
      recordsMapping: { sensorType: 'brand_new_type', detectionMethod: 'radio_frequency' },
    });
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [sensor]);
    const issues = validateSensorManifest(manifest);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('sensors.0.recordsMapping.sensorType');
  });

  it('rejects an unflagged detection method outside the records enum', () => {
    const sensor = passiveRadar({
      recordsMapping: { sensorType: 'passive_radar', detectionMethod: 'divination' },
    });
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [sensor]);
    const issues = validateSensorManifest(manifest);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('sensors.0.recordsMapping.detectionMethod');
  });

  it('rejects duplicate sensor ids', () => {
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [passiveRadar(), passiveRadar()]);
    const issues = validateSensorManifest(manifest);
    expect(issues.some((issue) => issue.message.includes('Duplicate sensor id'))).toBe(true);
  });

  it('rejects an empty sensors array', () => {
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', []);
    expect(validateSensorManifest(manifest).length).toBeGreaterThan(0);
  });

  it('rejects a non-kebab-case org slug', () => {
    const manifest = createSensorManifest('ELDÆON', 'ELDÆON', [passiveRadar()]);
    expect(validateSensorManifest(manifest).length).toBeGreaterThan(0);
  });

  it('rejects an invalid calibration status', () => {
    const sensor = passiveRadar({
      calibration: { status: 'vibes' as never },
    });
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [sensor]);
    expect(validateSensorManifest(manifest).length).toBeGreaterThan(0);
  });

  it('accepts honest nulls throughout the calibration block', () => {
    const sensor = passiveRadar({
      calibration: {
        status: 'none',
        calibrated: null,
        currentMethod: null,
        traceableReference: null,
        referenceInUse: null,
        cadence: null,
        uncertaintyBudget: null,
        notes: null,
      },
    });
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [sensor]);
    expect(validateSensorManifest(manifest)).toEqual([]);
  });
});

describe('quintet surfaces', () => {
  it('formats a sensor entry with calibration', () => {
    expect(formatSensorEntry(passiveRadar())).toBe(
      'Passive Bistatic Radar (Radio Frequency) — calibration: In Practice',
    );
  });

  it('formats a manifest summary', () => {
    const manifest = createSensorManifest('ELDÆON', 'eldaeon', [passiveRadar()], {
      futureUpgrades: [{ name: 'Microbarometer', modality: 'audio', status: 'planned' }],
    });
    expect(formatSensorManifest(manifest)).toBe(
      'ELDÆON — 1 sensor across 1 modality, 1 future upgrade',
    );
  });

  it('guards narrow enum values', () => {
    expect(isModality('quantum')).toBe(true);
    expect(isModality('astral')).toBe(false);
    expect(isCalibrationStatus('candidate_identified')).toBe(true);
    expect(isCalibrationStatus('candidate-identified')).toBe(false);
  });
});
