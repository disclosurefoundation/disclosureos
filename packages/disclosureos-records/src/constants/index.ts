/**
 * Enum value arrays, derived from the Zod schemas (C3). Each `X_VALUES` is
 * `XSchema.options` — there is no hand-maintained parallel array to drift.
 */
import { SourceTypeSchema } from '../source/types';
import { SourceCredibilitySchema } from '../source/credibility';
import { TemporalCertaintySchema } from '../temporal/certainty';
import { TimeOfDaySchema } from '../temporal/time-of-day';
import { DateGranularitySchema, DateRangeTypeSchema } from '../temporal/date-range';
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
import { ConfidenceLevelSchema } from '../shared';

export const SOURCE_TYPES = SourceTypeSchema.options;
export const SOURCE_CREDIBILITIES = SourceCredibilitySchema.options;
export const TEMPORAL_CERTAINTIES = TemporalCertaintySchema.options;
export const DATE_GRANULARITIES = DateGranularitySchema.options;
export const DATE_RANGE_TYPES = DateRangeTypeSchema.options;
export const TIMES_OF_DAY = TimeOfDaySchema.options;
export const MEDIA_TYPES = MediaTypeSchema.options;
export const SITE_TYPES = SiteTypeSchema.options;
export const TERRAIN_TYPES = TerrainTypeSchema.options;
export const AIRSPACE_CLASSES = AirspaceClassSchema.options;
export const LOCATION_SENSITIVITIES = LocationSensitivitySchema.options;
export const COORDINATE_PRECISIONS = CoordinatePrecisionSchema.options;
export const OBJECT_SHAPES = ObjectShapeSchema.options;
export const MANEUVER_TYPES = ManeuverTypeSchema.options;
export const RELATION_KINDS = RelationKindSchema.options;
export const CONFIDENCE_LEVELS = ConfidenceLevelSchema.options;
export const WITNESS_CATEGORIES = WitnessCategorySchema.options;
export const DETECTION_METHODS = DetectionMethodSchema.options;
export const SENSOR_TYPES = SensorTypeSchema.options;
export const EVIDENCE_TYPES = EvidenceTypeSchema.options;
export const EVIDENCE_QUALITIES = EvidenceQualitySchema.options;
export const CHAIN_OF_CUSTODY_STATUSES = ChainOfCustodySchema.options;
export const VERIFICATION_METHODS = VerificationMethodSchema.options;
export const VERIFICATION_RESULTS = VerificationResultSchema.options;
export const HASH_ALGORITHMS = HashAlgorithmSchema.options;
export const PUBLICATION_STATUSES = PublicationStatusSchema.options;
