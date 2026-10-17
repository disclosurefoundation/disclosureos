import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const coordinate = z.number().min(-1e7).max(1e7);
const vector = z.tuple([coordinate, coordinate, coordinate]);
/** Optional retained discrete-return table and complete static raster pulse ledger. */
export const LidarProfileSchema = z.strictObject({
  kind: z.literal("lidar_point_cloud_profile"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  contextId: id,
  sourceSelectionId: id,
  acquisitionRef: ref("acquisition"),
  channelId: id,
  acquisitionProducts: z.strictObject({
    pulses: ref("product"),
    points: ref("product"),
  }),
  dataOrigin: z.enum(["synthetic", "instrument"]),
  mode: z.literal("static_discrete_return_raster"),
  coordinateFrame: z.strictObject({
    kind: z.literal("local_cartesian"),
    axes: z.tuple([z.literal("east"), z.literal("north"), z.literal("up")]),
    unit: z.literal("m"),
    handedness: z.literal("right_handed"),
    originDescription: z.string().min(1).max(2000),
    sensorOrigin: vector,
    georeferencing: z.literal("not_provided"),
  }),
  scan: z.strictObject({
    rows: z.number().int().positive().max(4096),
    columns: z.number().int().positive().max(4096),
    pulses: z.number().int().positive().max(65536),
    points: z.number().int().min(0).max(983040),
    order: z.literal("row_major_index_not_time"),
    aim: z.literal("direction_reference_not_surface_hit"),
  }),
  geometry: z.strictObject({
    nearRangeM: z.number().positive().max(1e7),
    farRangeM: z.number().positive().max(1e7),
    rayToleranceM: z.number().positive().max(0.1),
    toleranceMeaning: z.literal(
      "encoding_consistency_not_measurement_uncertainty"
    ),
    bounds: z.strictObject({ min: vector, max: vector }),
  }),
  intensity: z.strictObject({
    kind: z.literal("normalized_return_amplitude"),
    min: z.literal(0),
    max: z.literal(1),
    calibration: z.literal("not_calibrated_to_reflectance"),
  }),
  classifications: z.strictObject({
    authority: z.enum(["authored_annotations", "source_annotations"]),
    method: z.string().min(1).max(4000),
    classes: z
      .array(
        z.strictObject({
          code: z.number().int().min(0).max(255),
          label: z.string().min(1).max(100),
        })
      )
      .min(1)
      .max(256),
  }),
  availability: z.strictObject({
    retained: z.literal("complete_return_group"),
    noReturn: z.literal("zero_detected_returns_not_clear_space"),
    unavailable: z.literal("unknown_return_count_empty_cell"),
    noTiming: z.literal("no_per_pulse_timestamps"),
  }),
  products: z.strictObject({ pulses: ref("product"), points: ref("product") }),
});
export const LIDAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:lidar-point-cloud-profile:0.1.0";
export const LIDAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:lidar-point-cloud",
  version: "0.1.0",
  scope: "static_discrete_returns_and_complete_pulse_ledger",
} as const);
export type LidarProfile = z.infer<typeof LidarProfileSchema>;
export function lidarProfileJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(LidarProfileSchema, {
    target: "draft-2020-12",
  });
  // Match runtime fixed tuple extents; Zod emits prefixItems without lengths.
  const constrainTuples = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    if (Array.isArray(value.prefixItems)) {
      value.minItems = value.prefixItems.length;
      value.maxItems = value.prefixItems.length;
    }
    for (const child of Object.values(value)) constrainTuples(child);
  };
  constrainTuples(schema);
  return { ...schema, $id: LIDAR_PROFILE_SCHEMA_ID };
}
