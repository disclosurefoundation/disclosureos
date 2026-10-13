import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));

/** Optional semantic profile over retained products, not a declaration of sensor capability. */
const base = z.strictObject({
  kind: z.literal("radar_profile"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  contextId: id,
  sourceSelectionId: id,
  acquisitionRef: ref("acquisition"),
  acquisitionProductRef: ref("product"),
  channelId: id,
  frameRef: ref("frame"),
  origin: z.strictObject({ eastM: z.number(), northM: z.number() }),
  timeOrigin: z.iso.datetime({ offset: true }),
  mode: z.literal("rotating_scan"),
  dataOrigin: z.enum(["synthetic", "instrument"]),
  bearingConvention: z.literal("clockwise_from_north"),
  rangeConvention: z.literal("horizontal_range"),
  beamReference: z.literal("north").optional(),
  platform: z.never().optional(),
  projection: z.never().optional(),
  beamWidthConvention: z.literal("full_width_half_maximum_power"),
  processingAvailability: z.literal("scan_end"),
  detectionPosition: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("cell_center") }),
    z.strictObject({
      kind: z.literal("power_weighted_neighborhood"),
      azimuthRadius: z.number().int().min(1).max(32),
      rangeRadius: z.number().int().min(1).max(32),
      backgroundPower: z.number().min(0),
    }),
  ]),
  products: z.strictObject({
    scanSchedule: ref("product"),
    returns: ref("product"),
    thresholds: ref("product"),
    detections: ref("product"),
    tracks: ref("product"),
    associations: ref("product"),
    truth: ref("product").optional(),
    platformPose: z.never().optional(),
  }),
  uncertainty: z.strictObject({
    kind: z.literal("gaussian_position_covariance"),
    axes: z.tuple([z.literal("east"), z.literal("north")]),
    unit: z.literal("m2"),
    confidenceProbability: z.number().gt(0).lt(1),
    conditioning: z.never().optional(),
  }),
});

const moving = base.extend({
  platform: z.strictObject({
    kind: z.literal("moving"),
    environment: z.enum(["airborne", "shipborne"]),
    poseSampling: z.literal("dwell_midpoint"),
    attitudeModel: z.literal("level_yaw_only"),
  }),
  beamReference: z.enum(["north", "platform_heading"]),
  products: base.shape.products.extend({ platformPose: ref("product") }),
  uncertainty: base.shape.uncertainty.extend({
    conditioning: z.literal("declared_pose_and_projection"),
  }),
});

// Explicit branches retain parity between the runtime and portable JSON Schema.
// Fixed observations remain valid without platform-specific declarations.
export const RadarProfileSchema = z.union([
  base,
  moving,
  moving.extend({
    rangeConvention: z.literal("slant_range"),
    projection: z.strictObject({
      kind: z.literal("declared_horizontal_plane"),
      upM: z.number(),
      assumption: z.literal("all_returns_on_plane"),
    }),
  }),
]);

export const RADAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:radar-profile:0.1.0";
export const RADAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:rotating-radar",
  version: "0.1.0",
  scope: "retained_rotating_scan_products_and_declared_processing",
} as const);
export type RadarProfile = z.infer<typeof RadarProfileSchema>;

export function radarProfileJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(RadarProfileSchema, {
    target: "draft-2020-12",
  });
  // Zod emits prefixItems without the fixed tuple extent. Match the runtime
  // two-axis contract in independent JSON Schema implementations as well.
  for (const branch of schema.anyOf ?? []) {
    if (typeof branch !== "object") continue;
    const uncertainty = branch.properties?.uncertainty;
    const axes =
      typeof uncertainty === "object"
        ? uncertainty.properties?.axes
        : undefined;
    if (typeof axes === "object") {
      axes.minItems = 2;
      axes.maxItems = 2;
    }
  }
  return { ...schema, $id: RADAR_PROFILE_SCHEMA_ID };
}
