/**
 * Schema-derived type guards (C3). `makeGuard(XSchema)` narrows to the schema's
 * inferred type with no parallel value array.
 */
import { makeGuard } from '../shared';

import { SourceTypeSchema } from '../source/types';
import { SourceCredibilitySchema } from '../source/credibility';
import { TemporalCertaintySchema } from '../temporal/certainty';
import { TimeOfDaySchema } from '../temporal/time-of-day';
import {
  DateGranularitySchema,
  DateRangeTypeSchema,
  FuzzyDateSchema,
  DateRangeSchema,
  RelativeDateSchema,
} from '../temporal/date-range';
import { MediaTypeSchema } from '../media/types';
import {
  CoordinatePrecisionSchema,
  SiteTypeSchema,
  TerrainTypeSchema,
  AirspaceClassSchema,
  LocationSensitivitySchema,
} from '../geo/location';
import { ObjectShapeSchema, ManeuverTypeSchema, RelationKindSchema } from '../observation/domains';
import { WitnessCategorySchema } from '../extensions/testimony/category';
import { DetectionMethodSchema, SensorTypeSchema } from '../source/sensor/types';
import { EvidenceTypeSchema, EvidenceQualitySchema } from '../extensions/physical/types';
import { ChainOfCustodySchema } from '../extensions/provenance/custody';
import { VerificationMethodSchema, VerificationResultSchema, HashAlgorithmSchema } from '../extensions/provenance/digital';
import { PublicationStatusSchema } from '../observation/types';

export const isSourceType = makeGuard(SourceTypeSchema);
export const isSourceCredibility = makeGuard(SourceCredibilitySchema);
export const isTemporalCertainty = makeGuard(TemporalCertaintySchema);
export const isDateGranularity = makeGuard(DateGranularitySchema);
export const isDateRangeType = makeGuard(DateRangeTypeSchema);
export const isTimeOfDay = makeGuard(TimeOfDaySchema);
export const isMediaType = makeGuard(MediaTypeSchema);
export const isLocationSensitivity = makeGuard(LocationSensitivitySchema);
export const isSiteType = makeGuard(SiteTypeSchema);
export const isTerrainType = makeGuard(TerrainTypeSchema);
export const isAirspaceClass = makeGuard(AirspaceClassSchema);
export const isCoordinatePrecision = makeGuard(CoordinatePrecisionSchema);
export const isObjectShape = makeGuard(ObjectShapeSchema);
export const isManeuverType = makeGuard(ManeuverTypeSchema);
export const isRelationKind = makeGuard(RelationKindSchema);
export const isWitnessCategory = makeGuard(WitnessCategorySchema);
export const isDetectionMethod = makeGuard(DetectionMethodSchema);
export const isSensorType = makeGuard(SensorTypeSchema);
export const isEvidenceType = makeGuard(EvidenceTypeSchema);
export const isEvidenceQuality = makeGuard(EvidenceQualitySchema);
export const isChainOfCustody = makeGuard(ChainOfCustodySchema);
export const isVerificationMethod = makeGuard(VerificationMethodSchema);
export const isVerificationResult = makeGuard(VerificationResultSchema);
export const isHashAlgorithm = makeGuard(HashAlgorithmSchema);
export const isPublicationStatus = makeGuard(PublicationStatusSchema);

export const isFuzzyDate = makeGuard(FuzzyDateSchema);
export const isDateRange = makeGuard(DateRangeSchema);
export const isRelativeDate = makeGuard(RelativeDateSchema);
