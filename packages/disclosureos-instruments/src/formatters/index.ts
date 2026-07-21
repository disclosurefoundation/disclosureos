import type { CalibrationStatus, Modality, SensorEntry, SensorManifest } from '../manifest/types';
import { MODALITY_LABELS, CALIBRATION_STATUS_LABELS } from '../labels';

export function formatModality(modality: Modality): string {
  return MODALITY_LABELS[modality];
}

export function formatCalibrationStatus(status: CalibrationStatus): string {
  return CALIBRATION_STATUS_LABELS[status];
}

/** One-line sensor summary, e.g. `"Passive Bistatic Radar (Radio Frequency) — calibration: In Practice"`. */
export function formatSensorEntry(sensor: SensorEntry): string {
  const calibration = sensor.calibration
    ? ` — calibration: ${formatCalibrationStatus(sensor.calibration.status)}`
    : '';
  return `${sensor.name} (${formatModality(sensor.modality)})${calibration}`;
}

/** One-line manifest summary, e.g. `"ELDÆON — 28 sensors across 6 modalities, 3 future upgrades"`. */
export function formatSensorManifest(manifest: SensorManifest): string {
  const modalityCount = new Set(manifest.sensors.map((sensor) => sensor.modality)).size;
  const sensorCount = manifest.sensors.length;
  const upgrades = manifest.futureUpgrades?.length ?? 0;
  const upgradeSuffix = upgrades > 0 ? `, ${upgrades} future upgrade${upgrades === 1 ? '' : 's'}` : '';
  return `${manifest.org} — ${sensorCount} sensor${sensorCount === 1 ? '' : 's'} across ${modalityCount} modalit${modalityCount === 1 ? 'y' : 'ies'}${upgradeSuffix}`;
}
