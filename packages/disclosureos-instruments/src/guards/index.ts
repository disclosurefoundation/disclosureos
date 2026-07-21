import { createEnumGuard } from '@disclosureos/records/shared';
import {
  ModalitySchema,
  TimeSourceSchema,
  CalibrationStatusSchema,
  UpgradeStatusSchema,
} from '../manifest/types';

// Enum guards are built from each schema's `.options` (a plain string tuple)
// rather than the Zod schema itself: passing a Zod type across the package
// boundary collides with Zod's internal version brand, whereas the literal
// tuple is brand-free and still schema-derived.
export const isModality = createEnumGuard(ModalitySchema.options);
export const isTimeSource = createEnumGuard(TimeSourceSchema.options);
export const isCalibrationStatus = createEnumGuard(CalibrationStatusSchema.options);
export const isUpgradeStatus = createEnumGuard(UpgradeStatusSchema.options);
