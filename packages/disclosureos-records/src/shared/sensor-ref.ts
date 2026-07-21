/**
 * Sensor references link a `SensorReading` to a published sensor-manifest entry
 * (`@disclosureos/instruments`): `"<org-slug>:<sensor-id>"`, e.g.
 * `"eldaeon:dionysus-passive-radar"`. Refs stay plain strings in the schema so
 * they remain portable to JSON Schema; the convention is enforced by
 * {@link isSensorRef} and produced by {@link sensorRef} — the same pattern as
 * `Claim.evidenceRefs`.
 *
 * Unlike an `evidenceRef` (which points *inward* at evidence carried by the
 * observation), a sensor ref points *outward* at an instrument catalog another
 * organization publishes.
 */

const SENSOR_REF_PATTERN = /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;

/** Build a sensor reference string, e.g. `sensorRef('eldaeon', 'dionysus-passive-radar')`. */
export function sensorRef(orgSlug: string, sensorId: string): string {
  return `${orgSlug}:${sensorId}`;
}

/** True if `value` matches the `<org-slug>:<sensor-id>` sensor-ref convention. */
export function isSensorRef(value: unknown): value is string {
  return typeof value === 'string' && SENSOR_REF_PATTERN.test(value);
}

/** Split a sensor ref into its `{ orgSlug, sensorId }` parts, or `null` if malformed. */
export function parseSensorRef(value: string): { orgSlug: string; sensorId: string } | null {
  if (!isSensorRef(value)) return null;
  const idx = value.indexOf(':');
  return { orgSlug: value.slice(0, idx), sensorId: value.slice(idx + 1) };
}
