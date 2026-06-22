// === Primary Type + Schema ===
export { ObservationSchema, PublicationStatusSchema } from './observation';
export type {
  Observation,
  ObservationInput,
  PublicationStatus,
  ObservationExtensions,
} from './observation';
export {
  ObjectCharacteristicsSchema,
  ObjectShapeSchema,
  MovementSchema,
  ManeuverTypeSchema,
  WitnessesSchema,
  InvestigationSchema,
  ResponseImpactSchema,
  EnvironmentSchema,
  RelationsSchema,
  RelationKindSchema,
  RelationEdgeSchema,
  AviationSchema,
  SourceDataSchema,
  SensorEvidenceDataSchema,
  SensorReadingSchema,
  DetectionMethodSchema,
  SensorTypeSchema,
} from './observation';
export type {
  ObjectCharacteristics,
  ObjectShape,
  Movement,
  ManeuverType,
  Witnesses,
  Investigation,
  ConfidenceLevel,
  ResponseImpact,
  Environment,
  Relations,
  RelationKind,
  RelationEdge,
  Aviation,
  SourceData,
  SensorEvidenceData,
  SensorReading,
  DetectionMethod,
  SensorType,
} from './observation';

// === Temporal ===
export {
  TemporalCertaintySchema,
  TimeOfDaySchema,
  TemporalDataSchema,
  DateGranularitySchema,
  DateRangeTypeSchema,
  FuzzyDateSchema,
  DateRangeSchema,
  RelativeDateSchema,
} from './temporal';
export type {
  TemporalCertainty,
  TimeOfDay,
  TemporalData,
  DateGranularity,
  FuzzyDate,
  DateRange,
  DateRangeType,
  RelativeDate,
} from './temporal';

// === Geo ===
export {
  CoordinatePrecisionSchema,
  GeoBoundsSchema,
  GeoPolygonSchema,
  SiteTypeSchema,
  TerrainTypeSchema,
  AirspaceClassSchema,
  LocationSensitivitySchema,
  ProximitySiteSchema,
  LocationDataSchema,
} from './geo';
export type {
  CoordinatePrecision,
  GeoBounds,
  GeoPolygon,
  SiteType,
  TerrainType,
  AirspaceClass,
  LocationSensitivity,
  ProximitySite,
  LocationData,
} from './geo';

// === Media ===
export { MediaTypeSchema, MediaAttachmentSchema } from './media';
export type { MediaType, MediaAttachment } from './media';

// === Source ===
export { SourceTypeSchema, SourceCredibilitySchema, SourceReferenceSchema } from './source';
export type { SourceType, SourceCredibility, SourceReference } from './source';

// === Extensions ===
// Optional forensic/clerical surfaces attach to `Observation` via the slots above
// (`provenance`, `identifiers`, `testimony`, `physicalEvidence`, `documents`).
// Their schemas are intentionally NOT re-exported here — import them from the
// dedicated subpaths to keep the root surface to the core lexicon:
//   @disclosureos/records/extensions/{provenance,identifiers,testimony,physical,document}

// === Validators ===
export {
  validateObservation,
  isValidLatitude,
  isValidLongitude,
  isValidISODate,
} from './validators';

// === Labels ===
export {
  SOURCE_TYPE_LABELS,
  SOURCE_CREDIBILITY_LABELS,
  TEMPORAL_CERTAINTY_LABELS,
  DATE_GRANULARITY_LABELS,
  DATE_RANGE_TYPE_LABELS,
  RELATIVE_RELATION_LABELS,
  TIME_OF_DAY_LABELS,
  MEDIA_TYPE_LABELS,
  COORDINATE_PRECISION_LABELS,
  LOCATION_SENSITIVITY_LABELS,
  OBJECT_SHAPE_LABELS,
  RELATION_KIND_LABELS,
  CONFIDENCE_LEVEL_LABELS,
  PUBLICATION_STATUS_LABELS,
  CHAIN_OF_CUSTODY_LABELS,
  VERIFICATION_RESULT_LABELS,
  EVIDENCE_QUALITY_LABELS,
} from './labels';

// === Constants (schema-derived value arrays) ===
export {
  SOURCE_TYPES,
  SOURCE_CREDIBILITIES,
  TEMPORAL_CERTAINTIES,
  DATE_GRANULARITIES,
  DATE_RANGE_TYPES,
  TIMES_OF_DAY,
  MEDIA_TYPES,
  SITE_TYPES,
  TERRAIN_TYPES,
  AIRSPACE_CLASSES,
  LOCATION_SENSITIVITIES,
  COORDINATE_PRECISIONS,
  OBJECT_SHAPES,
  MANEUVER_TYPES,
  RELATION_KINDS,
  CONFIDENCE_LEVELS,
  WITNESS_CATEGORIES,
  DETECTION_METHODS,
  SENSOR_TYPES,
  EVIDENCE_TYPES,
  EVIDENCE_QUALITIES,
  CHAIN_OF_CUSTODY_STATUSES,
  VERIFICATION_METHODS,
  VERIFICATION_RESULTS,
  HASH_ALGORITHMS,
  PUBLICATION_STATUSES,
} from './constants';

// === Guards ===
export {
  isSourceType,
  isSourceCredibility,
  isTemporalCertainty,
  isDateGranularity,
  isDateRangeType,
  isFuzzyDate,
  isDateRange,
  isRelativeDate,
  isTimeOfDay,
  isMediaType,
  isLocationSensitivity,
  isSiteType,
  isTerrainType,
  isAirspaceClass,
  isCoordinatePrecision,
  isObjectShape,
  isManeuverType,
  isRelationKind,
  isWitnessCategory,
  isDetectionMethod,
  isSensorType,
  isEvidenceType,
  isEvidenceQuality,
  isChainOfCustody,
  isVerificationMethod,
  isVerificationResult,
  isHashAlgorithm,
  isPublicationStatus,
} from './guards';

// === Factories ===
export {
  createTemporalData,
  createMediaAttachment,
  createSensorReading,
  createObservation,
} from './factories';
export type { CreateObservationOptions } from './factories';

// === Formatters ===
export {
  formatTemporalData,
  formatFuzzyDate,
  formatDateRange,
  formatRelativeDate,
  formatSourceType,
  formatTimeOfDay,
  formatCoordinatePrecision,
} from './formatters';

// === Shared substrate (cross-package primitives) ===
// Also available at the lighter `@disclosureos/records/shared` subpath.
export {
  ConfidenceSchema,
  isConfidence,
  assertConfidence,
  asConfidence,
  ConfidenceLevelSchema,
  isConfidenceLevel,
  AttributionSchema,
  ClaimSchema,
  EVIDENCE_REF_KINDS,
  evidenceRef,
  isEvidenceRef,
  parseEvidenceRef,
  issuesFrom,
  createEnumGuard,
  makeGuard,
  asObservationId,
} from './shared';
export type {
  Confidence,
  Attribution,
  Claim,
  EvidenceRefKind,
  ValidationIssue,
  Brand,
  ObservationId,
} from './shared';

// === JSON Schema artifact ===
export { recordsJsonSchema, RECORDS_SCHEMA_VERSION, RECORDS_SCHEMA_ID } from './schema';
