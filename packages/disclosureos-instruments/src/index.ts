// === Manifest document types ===
export {
  ModalitySchema,
  TimeSourceSchema,
  SensorTimingSchema,
  RecordsMappingSchema,
  RawDataSpecSchema,
  UncertaintyTypeSchema,
  MeasurementUncertaintySchema,
  MeasurementSchema,
  CalibrationStatusSchema,
  SensorCalibrationSchema,
  SensorEntrySchema,
  UpgradeStatusSchema,
  FutureUpgradeSchema,
  SensorManifestSchema,
} from './manifest';
export type {
  Modality,
  TimeSource,
  SensorTiming,
  RecordsMapping,
  RawDataSpec,
  UncertaintyType,
  MeasurementUncertainty,
  Measurement,
  CalibrationStatus,
  SensorCalibration,
  SensorEntry,
  UpgradeStatus,
  FutureUpgrade,
  SensorManifest,
} from './manifest';

// === Constants ===
export {
  MODALITIES,
  TIME_SOURCES,
  CALIBRATION_STATUSES,
  UPGRADE_STATUSES,
  UNCERTAINTY_TYPES,
} from './constants';

// === Labels ===
export {
  MODALITY_LABELS,
  TIME_SOURCE_LABELS,
  CALIBRATION_STATUS_LABELS,
  CALIBRATION_STATUS_DESCRIPTIONS,
  UPGRADE_STATUS_LABELS,
} from './labels';

// === Guards ===
export { isModality, isTimeSource, isCalibrationStatus, isUpgradeStatus } from './guards';

// === Factories ===
export { createSensorEntry, createSensorManifest } from './factories';

// === Formatters ===
export {
  formatModality,
  formatCalibrationStatus,
  formatSensorEntry,
  formatSensorManifest,
} from './formatters';

// === Validation ===
export { validateSensorManifest } from './validators';

// === JSON Schema artifact ===
export { instrumentsJsonSchema, INSTRUMENTS_SCHEMA_VERSION, INSTRUMENTS_SCHEMA_ID } from './schema';
