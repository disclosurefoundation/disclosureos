import { validateWith } from '@disclosureos/records/shared';
import type { ValidationIssue } from '@disclosureos/records/shared';
import { SENSOR_TYPES, DETECTION_METHODS } from '@disclosureos/records/constants';
import { SensorManifestSchema } from '../manifest/types';
import type { SensorManifest } from '../manifest/types';

const KNOWN_SENSOR_TYPES = new Set<string>(SENSOR_TYPES);
const KNOWN_DETECTION_METHODS = new Set<string>(DETECTION_METHODS);

/**
 * Validate a sensor manifest. Schema validation plus the structural invariants
 * Zod cannot express portably:
 *
 * 1. sensor ids are unique within the manifest;
 * 2. every `recordsMapping` value either exists in the `@disclosureos/records`
 *    enums or carries the matching `proposed*` flag — so a manifest can never
 *    silently claim a mapping the records vocabulary does not have.
 *
 * Returns a flat issue list (empty when valid) — the ecosystem's single
 * validation contract.
 */
export function validateSensorManifest(value: unknown): ValidationIssue[] {
  const issues = validateWith(SensorManifestSchema, value);
  if (issues.length > 0) return issues;

  const manifest = value as SensorManifest;
  const seenIds = new Set<string>();

  manifest.sensors.forEach((sensor, index) => {
    const path = `sensors.${index}`;

    if (seenIds.has(sensor.id)) {
      issues.push({ path: `${path}.id`, message: `Duplicate sensor id "${sensor.id}".` });
    }
    seenIds.add(sensor.id);

    const mapping = sensor.recordsMapping;
    if (!mapping) return;

    if (
      mapping.sensorType !== undefined
      && !KNOWN_SENSOR_TYPES.has(mapping.sensorType)
      && mapping.proposedSensorType !== true
    ) {
      issues.push({
        path: `${path}.recordsMapping.sensorType`,
        message:
          `"${mapping.sensorType}" is not a records SensorType; flag it with proposedSensorType: true or use a value from the enum.`,
      });
    }

    if (
      mapping.detectionMethod !== undefined
      && !KNOWN_DETECTION_METHODS.has(mapping.detectionMethod)
      && mapping.proposedDetectionMethod !== true
    ) {
      issues.push({
        path: `${path}.recordsMapping.detectionMethod`,
        message:
          `"${mapping.detectionMethod}" is not a records DetectionMethod; flag it with proposedDetectionMethod: true or use a value from the enum.`,
      });
    }
  });

  return issues;
}
