import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const common = {
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
  dataOrigin: z.enum(["synthetic", "instrument"]),
  bearingConvention: z.literal("clockwise_from_north"),
};
/** Sector-beam scheduling and retained processing, not a military capability assertion. */
export const SteeredRadarProfileSchema = z.strictObject({
  ...common,
  kind: z.literal("steered_radar_profile"),
  mode: z.literal("electronically_steered_sector"),
  rangeConvention: z.literal("horizontal_range"),
  beamWidthConvention: z.literal("full_width_half_maximum_power"),
  processingAvailability: z.literal("dwell_end"),
  detectionPosition: z.strictObject({ kind: z.literal("cell_center") }),
  products: z.strictObject({
    beamSchedule: ref("product"),
    returns: ref("product"),
    thresholds: ref("product"),
    detections: ref("product"),
    tracks: ref("product"),
    associations: ref("product"),
    truth: ref("product").optional(),
  }),
  uncertainty: z.strictObject({
    kind: z.literal("gaussian_position_covariance"),
    axes: z.tuple([z.literal("east"), z.literal("north")]),
    unit: z.literal("m2"),
    confidenceProbability: z.number().gt(0).lt(1),
  }),
});
/** Decoded cooperative replies remain distinct from reflections and geometric height. */
export const SecondaryRadarProfileSchema = z.strictObject({
  ...common,
  kind: z.literal("secondary_radar_profile"),
  mode: z.literal("mode_a_mode_c"),
  rangeConvention: z.literal("slant_range"),
  positionRepresentation: z.literal("polar_only"),
  altitudeConvention: z.literal("pressure_altitude_1013_25_hpa"),
  identitySemantics: z.literal("reported_code_not_verified_identity"),
  processingAvailability: z.literal("explicit_available_time"),
  products: z.strictObject({
    interrogations: ref("product"),
    decodedReplies: ref("product"),
    reports: ref("product"),
    truth: ref("product").optional(),
  }),
});
export const STEERED_RADAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:steered-radar-profile:0.1.0";
export const SECONDARY_RADAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:secondary-radar-profile:0.1.0";
export const STEERED_RADAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:steered-radar",
  version: "0.1.0",
  scope: "retained_sector_beams_and_declared_processing",
} as const);
export const SECONDARY_RADAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:secondary-radar",
  version: "0.1.0",
  scope: "retained_cooperative_interrogations_and_decoded_replies",
} as const);
export type SteeredRadarProfile = z.infer<typeof SteeredRadarProfileSchema>;
export type SecondaryRadarProfile = z.infer<typeof SecondaryRadarProfileSchema>;
export function steeredRadarProfileJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SteeredRadarProfileSchema, {
    target: "draft-2020-12",
  });
  const uncertainty = schema.properties?.uncertainty;
  const axes =
    typeof uncertainty === "object" ? uncertainty.properties?.axes : undefined;
  if (typeof axes === "object") {
    axes.minItems = 2;
    axes.maxItems = 2;
  }
  return { ...schema, $id: STEERED_RADAR_PROFILE_SCHEMA_ID };
}
export function secondaryRadarProfileJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(SecondaryRadarProfileSchema, { target: "draft-2020-12" }),
    $id: SECONDARY_RADAR_PROFILE_SCHEMA_ID,
  };
}
