import { z } from 'zod';

/**
 * The sensor manifest is the instrument layer of the standard: DisclosureOS
 * records describe *what was observed*; a sensor manifest describes *the
 * hardware that produced the data* — per sensor, in enough structured detail
 * that a field mission or data drop from one organization is comparable,
 * replicable, and verifiable by everyone else.
 *
 * Design lineage: proposed by ELDÆON (disclosurefoundation/disclosureos#5) and
 * promoted into the framework as a foundation package. The manifest is the
 * standard's first standalone document type besides `Observation`: it is not a
 * per-observation extension slot — observations point at manifest entries via
 * `SensorReading.sensorRef` (`"<org-slug>:<sensor-id>"`).
 */

const KEBAB_CASE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const ModalitySchema = z
  .enum(['audio', 'electro_optical', 'radio_frequency', 'quantum', 'environmental', 'biometric'])
  .describe('Top-level sensing modality the sensor belongs to.');

export type Modality = z.infer<typeof ModalitySchema>;

export const TimeSourceSchema = z
  .enum(['atomic_clock', 'gps_disciplined', 'ntp', 'system', 'unknown'])
  .describe('Clock source that timestamps the sensor\u2019s data.');

export type TimeSource = z.infer<typeof TimeSourceSchema>;

export const SensorTimingSchema = z
  .object({
    timeSource: TimeSourceSchema,
    timeUncertaintyNs: z
      .number()
      .nullable()
      .optional()
      .describe('Timestamp uncertainty in nanoseconds. Null = not yet characterized.'),
  })
  .meta({ id: 'SensorTiming' })
  .describe(
    'Timing provenance. Timestamp error of even a few seconds confounds multi-station correlation, so the clock source must be declared, not assumed.',
  );

export type SensorTiming = z.infer<typeof SensorTimingSchema>;

export const RecordsMappingSchema = z
  .object({
    sensorType: z
      .string()
      .optional()
      .describe('The `@disclosureos/records` SensorType this sensor maps to.'),
    detectionMethod: z
      .string()
      .optional()
      .describe('The `@disclosureos/records` DetectionMethod this sensor maps to.'),
    proposedSensorType: z
      .boolean()
      .optional()
      .describe('True = sensorType is not in the records enum yet and is proposed by the publisher.'),
    proposedDetectionMethod: z
      .boolean()
      .optional()
      .describe('True = detectionMethod is not in the records enum yet and is proposed by the publisher.'),
  })
  .meta({ id: 'RecordsMapping' })
  .describe(
    'How this sensor maps to the `SensorReading` vocabulary in `@disclosureos/records`. Values outside the records enums must carry the matching proposed* flag.',
  );

export type RecordsMapping = z.infer<typeof RecordsMappingSchema>;

export const RawDataSpecSchema = z
  .object({
    format: z
      .string()
      .optional()
      .describe('Raw-data file format, e.g. "NDJSON.gz", "WAV", "MJPEG", "FITS", "CSV".'),
    locatorPattern: z
      .string()
      .nullable()
      .optional()
      .describe('Storage key pattern or path convention for locating the raw files.'),
    sampleRateHz: z.number().nullable().optional().describe('Sample rate in Hz, where applicable.'),
    bitDepth: z.number().nullable().optional().describe('Sample bit depth, where applicable.'),
  })
  .meta({ id: 'RawDataSpec' })
  .describe(
    'Raw-data format and locator. Supports a metadata-first architecture: circulate manifests widely, pull raw data on demand.',
  );

export type RawDataSpec = z.infer<typeof RawDataSpecSchema>;

export const UncertaintyTypeSchema = z
  .enum(['A', 'B'])
  .describe('GUM uncertainty evaluation type: A (statistical) or B (other means).');

export type UncertaintyType = z.infer<typeof UncertaintyTypeSchema>;

export const MeasurementUncertaintySchema = z
  .object({
    u_c: z.number().nullable().optional().describe('Combined standard uncertainty.'),
    U: z.number().nullable().optional().describe('Expanded uncertainty (= k \u00d7 u_c).'),
    k: z.number().nullable().optional().describe('Coverage factor (2 \u2248 95% confidence level).'),
    type: UncertaintyTypeSchema.nullable().optional(),
  })
  .meta({ id: 'MeasurementUncertainty' })
  .describe(
    'GUM-style measurement uncertainty. Fields are nullable until an uncertainty budget exists — declaring "unknown" honestly is itself information.',
  );

export type MeasurementUncertainty = z.infer<typeof MeasurementUncertaintySchema>;

export const MeasurementSchema = z
  .object({
    name: z.string().min(1).describe('Measured quantity, e.g. "differential_pressure".'),
    unit: z.string().min(1).describe('UCUM-style unit string, e.g. "Pa", "dB", "uT", "ppm", "/min".'),
    uncertainty: MeasurementUncertaintySchema.optional(),
  })
  .meta({ id: 'Measurement' })
  .describe('One measured quantity with its unit and uncertainty.');

export type Measurement = z.infer<typeof MeasurementSchema>;

export const CalibrationStatusSchema = z
  .enum(['none', 'candidate_identified', 'in_practice', 'documented'])
  .describe(
    'Calibration maturity gradient: none = no calibration; candidate_identified = a reference is named but not used; in_practice = a real method is performed but not fully budgeted; documented = method + uncertainty budget published.',
  );

export type CalibrationStatus = z.infer<typeof CalibrationStatusSchema>;

export const SensorCalibrationSchema = z
  .object({
    status: CalibrationStatusSchema,
    calibrated: z
      .boolean()
      .nullable()
      .optional()
      .describe('Coarse calibrated flag, mirroring `SensorReading.calibrated`. Null = undetermined.'),
    currentMethod: z
      .string()
      .nullable()
      .optional()
      .describe('What the operator actually does today. Null = no calibration currently performed.'),
    traceableReference: z
      .string()
      .nullable()
      .optional()
      .describe('Traceable reference, in use or identified as a candidate (e.g. "GPS/UTC", "USGS/INTERMAGNET").'),
    referenceInUse: z
      .boolean()
      .nullable()
      .optional()
      .describe('True = the traceable reference is part of current practice. False = identified candidate only. Null = undetermined.'),
    cadence: z.string().nullable().optional().describe('How often calibration is performed.'),
    uncertaintyBudget: z.string().nullable().optional().describe('Published uncertainty budget, if any.'),
    notes: z.string().nullable().optional().describe('Open questions or method caveats.'),
  })
  .meta({ id: 'SensorCalibration' })
  .describe(
    'Calibration provenance. Deliberately separates what an operator actually does today from the reference it has identified; honest nulls are first-class, so calibration gaps stay visible and comparable across operators.',
  );

export type SensorCalibration = z.infer<typeof SensorCalibrationSchema>;

export const SensorEntrySchema = z
  .object({
    id: z
      .string()
      .regex(KEBAB_CASE_PATTERN)
      .describe(
        'Stable kebab-case id, unique within the manifest; addressable from a record via `SensorReading.sensorRef` ("<org-slug>:<sensor-id>").',
      ),
    name: z.string().min(1).describe('Human-readable sensor name.'),
    modality: ModalitySchema,
    manufacturerModel: z
      .string()
      .optional()
      .describe(
        'Hardware class descriptor. Publishers MAY withhold specific make/model identities and publish spec-level class descriptors instead (e.g. "dual GM-tube counter" rather than a product name).',
      ),
    inHouse: z.boolean().optional().describe('True if operator-built rather than off-the-shelf.'),
    compute: z
      .string()
      .optional()
      .describe('The compute unit this sensor is attached to, for platforms with several compute nodes.'),
    recordsMapping: RecordsMappingSchema.optional(),
    timing: SensorTimingSchema.optional(),
    rawData: RawDataSpecSchema.optional(),
    measurements: z.array(MeasurementSchema).optional(),
    calibration: SensorCalibrationSchema.optional(),
    specs: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Free-form hardware specifications from the operator\u2019s spec sheet (resolution, range, sensitivity, interface, \u2026). Keys vary by modality.',
      ),
    specSource: z.string().optional().describe('Provenance of the spec values.'),
  })
  .meta({ id: 'SensorEntry' })
  .describe('One sensor: its class, spec, timing, raw-data locator, measurements, and calibration provenance.');

export type SensorEntry = z.infer<typeof SensorEntrySchema>;

export const UpgradeStatusSchema = z
  .enum(['planned', 'evaluating', 'ordered', 'acquired'])
  .describe('Acquisition status of a declared future hardware upgrade.');

export type UpgradeStatus = z.infer<typeof UpgradeStatusSchema>;

export const FutureUpgradeSchema = z
  .object({
    name: z.string().min(1),
    modality: ModalitySchema,
    status: UpgradeStatusSchema.optional(),
    specs: z.record(z.string(), z.unknown()).optional(),
    link: z.string().nullable().optional().describe('Public product or reference page, where the publisher chooses to share one.'),
    notes: z.string().nullable().optional(),
  })
  .meta({ id: 'FutureUpgrade' })
  .describe(
    'Planned hardware declared ahead of deployment so data consumers can anticipate new streams. Not part of the live sensor array.',
  );

export type FutureUpgrade = z.infer<typeof FutureUpgradeSchema>;

export const SensorManifestSchema = z
  .object({
    schemaVersion: z.string().min(1).describe('Version of the sensor-manifest schema this instance targets (SemVer).'),
    org: z.string().min(1).describe('Publishing organization, display form (e.g. "ELD\u00c6ON").'),
    orgSlug: z
      .string()
      .regex(KEBAB_CASE_PATTERN)
      .describe('Stable lowercase slug for the publisher (e.g. "eldaeon"); the org half of a `sensorRef`.'),
    orgUrl: z.string().optional().describe('URL for the publishing organization.'),
    generatedAt: z.string().optional().describe('ISO date the manifest was generated.'),
    sensors: z.array(SensorEntrySchema).min(1),
    futureUpgrades: z.array(FutureUpgradeSchema).optional(),
  })
  .meta({ id: 'SensorManifest' })
  .describe(
    'A published catalog of one organization\u2019s detection hardware. Any operator — vendor, research group, or institution — publishes its own manifest against this schema so datasets from different sensor arrays can be compared directly.',
  );

export type SensorManifest = z.infer<typeof SensorManifestSchema>;
