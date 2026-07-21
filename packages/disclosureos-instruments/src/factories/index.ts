import type { Modality, SensorEntry, SensorManifest } from '../manifest/types';
import { INSTRUMENTS_SCHEMA_VERSION } from '../schema';

/**
 * Build a sensor entry from the three required fields, with everything else
 * supplied via `options`.
 */
export function createSensorEntry(
  id: string,
  name: string,
  modality: Modality,
  options?: Partial<Omit<SensorEntry, 'id' | 'name' | 'modality'>>,
): SensorEntry {
  return { id, name, modality, ...options };
}

/**
 * Build a sensor manifest. `schemaVersion` defaults to the version of the
 * schema this package emits.
 */
export function createSensorManifest(
  org: string,
  orgSlug: string,
  sensors: SensorEntry[],
  options?: Partial<Omit<SensorManifest, 'org' | 'orgSlug' | 'sensors'>>,
): SensorManifest {
  return {
    schemaVersion: INSTRUMENTS_SCHEMA_VERSION,
    org,
    orgSlug,
    sensors,
    ...options,
  };
}
