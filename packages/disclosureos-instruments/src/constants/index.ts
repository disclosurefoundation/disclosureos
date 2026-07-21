import {
  ModalitySchema,
  TimeSourceSchema,
  CalibrationStatusSchema,
  UpgradeStatusSchema,
  UncertaintyTypeSchema,
} from '../manifest/types';

export const MODALITIES = ModalitySchema.options;
export const TIME_SOURCES = TimeSourceSchema.options;
export const CALIBRATION_STATUSES = CalibrationStatusSchema.options;
export const UPGRADE_STATUSES = UpgradeStatusSchema.options;
export const UNCERTAINTY_TYPES = UncertaintyTypeSchema.options;
