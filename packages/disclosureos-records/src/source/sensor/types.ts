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
    'other',
  ])
  .describe('Class of sensor that produced a reading.');

export type SensorType = z.infer<typeof SensorTypeSchema>;

export const SensorReadingSchema = z
  .object({
    id: z.string().min(1).describe('Stable id, addressable by a claim `evidenceRef` ("sensor:<id>").'),
    sensorType: SensorTypeSchema,
    detectionMethod: DetectionMethodSchema,
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
