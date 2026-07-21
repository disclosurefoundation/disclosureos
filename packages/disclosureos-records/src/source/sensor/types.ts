import { z } from 'zod';

export const DetectionMethodSchema = z
  .enum([
    'radar_primary',
    'radar_secondary',
    'radar_doppler',
    'radar_phased_array',
    'infrared_flir',
    'infrared_other',
    'electro_optical',
    'visual_camera',
    'satellite_imagery',
    'sonar_active',
    'sonar_passive',
    'electromagnetic',
    'radiation_detector',
    'magnetometer',
    'gravimeter',
    'acoustic',
    'seismic',
    'lidar',
    'spectroscopic',
    'radio_frequency',
    'particle',
    'gnss',
    'time_reference',
    'chemical',
    'inertial',
    'physiological',
    'pressure',
    'multiple',
    'other',
    'unknown',
  ])
  .describe('How a sensor detected the object.');

export type DetectionMethod = z.infer<typeof DetectionMethodSchema>;

export const SensorTypeSchema = z
  .enum([
    'military_radar',
    'civilian_radar',
    'airborne_radar',
    'shipborne_radar',
    'ground_radar',
    'flir',
    'eo_sensor',
    'satellite',
    'sonar',
    'electromagnetic_sensor',
    'radiation_sensor',
    'civilian_camera',
    'security_camera',
    'dashcam',
    'phone_camera',
    'infrasonic_sensor',
    'ultrasonic_sensor',
    'adsb_receiver',
    'rf_spectrum_analyzer',
    'passive_radar',
    'particle_detector',
    'atomic_clock',
    'gnss_receiver',
    'fluxgate_magnetometer',
    'air_quality_sensor',
    'barometer',
    'lightning_detector',
    'imu',
    'eeg',
    'gsr',
    'pulse_oximeter',
    'pupillometer',
    'hardware_rng',
    'other',
  ])
  .describe('Class of sensor that produced a reading.');

export type SensorType = z.infer<typeof SensorTypeSchema>;

export const SensorReadingSchema = z
  .object({
    id: z.string().min(1).describe('Stable id, addressable by a claim `evidenceRef` ("sensor:<id>").'),
    sensorType: SensorTypeSchema,
    detectionMethod: DetectionMethodSchema,
    sensorRef: z
      .string()
      .optional()
      .describe(
        'Reference to a published sensor-manifest entry ("<org-slug>:<sensor-id>", e.g. "eldaeon:dionysus-passive-radar") carrying the instrument\u2019s full spec, timing, and calibration provenance.',
      ),
    platform: z
      .string()
      .optional()
      .describe('Platform carrying the sensor (e.g. "USS Princeton", "F/A-18F").'),
    operator: z.string().optional().describe('Person or unit operating the sensor.'),
    timestamp: z.string().optional().describe('When the reading was recorded (ISO timestamp).'),
    duration: z.number().optional().describe('How long the sensor held contact, in seconds.'),
    rawDataAvailable: z.boolean().optional().describe('Whether the raw sensor data still exists and is obtainable.'),
    calibrated: z.boolean().optional().describe('Whether the sensor was calibrated at the time of the reading.'),
    readings: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Sensor-specific measured values, keyed by measurement name.'),
    notes: z.string().optional().describe('Free-text context about the reading.'),
  })
  .meta({ id: 'SensorReading' })
  .describe('A single sensor reading and its provenance.');

export type SensorReading = z.infer<typeof SensorReadingSchema>;

export const SensorEvidenceDataSchema = z
  .object({
    sensors: z.array(SensorReadingSchema),
    multiSensorCorrelation: z
      .boolean()
      .optional()
      .describe('Whether independent sensors corroborated the same object.'),
    dataRetentionStatus: z
      .enum(['available', 'archived', 'destroyed', 'classified', 'unknown'])
      .optional()
      .describe('Current status of the underlying sensor data.'),
    anomalies: z
      .array(z.string())
      .optional()
      .describe('Anomalies in the sensor data itself (e.g. "jamming indications", "signal dropout").'),
  })
  .meta({ id: 'SensorEvidenceData' })
  .describe('Instrument-recorded evidence for an observation (radar, FLIR, EO, etc.).');

export type SensorEvidenceData = z.infer<typeof SensorEvidenceDataSchema>;
