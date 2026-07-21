import type { Modality, TimeSource, CalibrationStatus, UpgradeStatus } from '../manifest/types';

export const MODALITY_LABELS: Record<Modality, string> = {
  audio: 'Audio',
  electro_optical: 'Electro-Optical',
  radio_frequency: 'Radio Frequency',
  quantum: 'Quantum',
  environmental: 'Environmental',
  biometric: 'Biometric',
};

export const TIME_SOURCE_LABELS: Record<TimeSource, string> = {
  atomic_clock: 'Atomic Clock',
  gps_disciplined: 'GPS-Disciplined',
  ntp: 'NTP',
  system: 'System Clock',
  unknown: 'Unknown',
};

export const CALIBRATION_STATUS_LABELS: Record<CalibrationStatus, string> = {
  none: 'None',
  candidate_identified: 'Candidate Identified',
  in_practice: 'In Practice',
  documented: 'Documented',
};

/** What each rung of the calibration maturity gradient means for a data consumer. */
export const CALIBRATION_STATUS_DESCRIPTIONS: Record<CalibrationStatus, string> = {
  none: 'No calibration is performed. Declared honestly, this is itself useful information.',
  candidate_identified: 'A traceable reference has been named but is not yet part of practice.',
  in_practice: 'A real calibration method is performed today, but no full uncertainty budget exists.',
  documented: 'The calibration method and its uncertainty budget are published.',
};

export const UPGRADE_STATUS_LABELS: Record<UpgradeStatus, string> = {
  planned: 'Planned',
  evaluating: 'Evaluating',
  ordered: 'Ordered',
  acquired: 'Acquired',
};
