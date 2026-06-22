import { TemporalDataSchema } from '../temporal/temporal-data';
import type { TemporalData } from '../temporal/temporal-data';
import { MediaAttachmentSchema } from '../media/attachment';
import type { MediaAttachment } from '../media/attachment';
import { SensorReadingSchema } from '../source/sensor/types';
import type { SensorReading } from '../source/sensor/types';
import { ObservationSchema } from '../observation/types';
import type { Observation, ObservationInput, PublicationStatus } from '../observation/types';

export function createTemporalData(
  date: string,
  dateCertainty: TemporalData['dateCertainty'],
  options?: Partial<Omit<TemporalData, 'date' | 'dateCertainty'>>,
): TemporalData {
  return TemporalDataSchema.parse({ date, dateCertainty, ...options });
}

/**
 * Build a {@link MediaAttachment}, auto-generating a stable `id` (so it can be
 * targeted by a claim's `evidenceRef`) when one is not supplied.
 */
export function createMediaAttachment(
  type: MediaAttachment['type'],
  url: string,
  options?: Partial<Omit<MediaAttachment, 'type' | 'url'>>,
): MediaAttachment {
  return MediaAttachmentSchema.parse({
    type,
    url,
    ...options,
    id: options?.id ?? crypto.randomUUID(),
  });
}

/**
 * Build a {@link SensorReading}, auto-generating a stable `id` (so it can be
 * targeted by a claim's `evidenceRef`) when one is not supplied.
 */
export function createSensorReading(
  sensorType: SensorReading['sensorType'],
  detectionMethod: SensorReading['detectionMethod'],
  options?: Partial<Omit<SensorReading, 'sensorType' | 'detectionMethod'>>,
): SensorReading {
  return SensorReadingSchema.parse({
    sensorType,
    detectionMethod,
    ...options,
    id: options?.id ?? crypto.randomUUID(),
  });
}

export interface CreateObservationOptions {
  id?: string;
  status?: PublicationStatus;
}

/**
 * Build a **core** observation record from partial input, filling in id/status/
 * timestamps and parsing against {@link ObservationSchema} (throws on invalid
 * input). Cross-package slots (`observableAssessments`, `origin`) are not part
 * of the core schema; attach them via the satellite packages' factories.
 */
export function createObservation(
  input: ObservationInput,
  options?: CreateObservationOptions,
): Observation {
  const now = new Date().toISOString();
  const id = options?.id ?? crypto.randomUUID();
  const status = options?.status ?? 'draft';

  const { temporal, location: locationInput, ...rest } = input;

  const location = {
    ...locationInput,
    id: locationInput.id ?? crypto.randomUUID(),
  };

  return ObservationSchema.parse({
    ...rest,
    id,
    status,
    createdAt: now,
    updatedAt: now,
    temporal,
    location,
  });
}
