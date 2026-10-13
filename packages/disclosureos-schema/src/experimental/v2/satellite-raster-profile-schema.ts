import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const finite = z.number().min(-1e9).max(1e9);
/** Optional north-up WGS84 UTM surface-reflectance source cube and quality grid. */
export const SatelliteRasterProfileSchema = z.strictObject({
  kind: z.literal("satellite_raster_profile"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  contextId: id,
  sourceSelectionId: id,
  acquisitionRef: ref("acquisition"),
  channelId: id,
  acquisitionProducts: z.strictObject({
    reflectance: ref("product"),
    quality: ref("product"),
  }),
  dataOrigin: z.enum(["synthetic", "instrument"]),
  mode: z.literal("north_up_multispectral_reflectance"),
  grid: z.strictObject({
    rows: z.number().int().positive().max(4096),
    columns: z.number().int().positive().max(4096),
    crs: z.strictObject({
      kind: z.literal("wgs84_utm"),
      epsg: z.string().regex(/^EPSG:32[67][0-6][0-9](?![\s\S])/),
      zone: z.number().int().min(1).max(60),
      hemisphere: z.enum(["north", "south"]),
      unit: z.literal("m"),
    }),
    transform: z.tuple([
      finite,
      z.number().positive().max(1e5),
      z.literal(0),
      finite,
      z.literal(0),
      z.number().negative().min(-1e5),
    ]),
    pixelInterpretation: z.literal("area"),
    registration: z.enum([
      "authored_grid_not_surveyed",
      "source_declared_not_verified",
    ]),
  }),
  bands: z
    .array(
      z.strictObject({
        id,
        label: z.string().min(1).max(100),
        centerWavelengthNm: z.number().positive().max(1e6),
        wavelengthMeaning: z.literal("nominal_center_not_response_function"),
        scale: z.number().positive().max(100),
        offset: z.number().min(-100).max(100),
        nodata: z.number().int().min(0).max(65535),
        validRange: z.tuple([
          z.number().min(-100).max(100),
          z.number().min(-100).max(100),
        ]),
      })
    )
    .min(2)
    .max(16),
  radiometry: z.strictObject({
    quantity: z.literal("surface_reflectance"),
    unit: z.literal("1"),
    formula: z.literal("dn_times_scale_plus_offset"),
    calibration: z.literal("not_verified"),
  }),
  quality: z.strictObject({
    authority: z.enum(["authored_annotations", "source_annotations"]),
    method: z.string().min(1).max(4000),
    codes: z.strictObject({
      clear: z.literal(0),
      cloud: z.literal(1),
      shadow: z.literal(2),
      nodata: z.literal(3),
    }),
    scope: z.literal("whole_pixel"),
    interpretation: z.literal("source_annotation_not_accuracy_certification"),
  }),
  vegetationIndex: z.strictObject({
    redBandId: id,
    nearInfraredBandId: id,
    method: z.literal("scaled_nir_minus_red_over_sum"),
    qualityPolicy: z.literal("clear_nonnegative_nonzero_sum_only"),
    interpretation: z.literal("spectral_index_not_land_cover_classification"),
  }),
  products: z.strictObject({
    reflectance: ref("product"),
    quality: ref("product"),
  }),
});
export const SATELLITE_RASTER_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:satellite-raster-profile:0.1.0";
export const SATELLITE_RASTER_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:satellite-raster",
  version: "0.1.0",
  scope: "north_up_utm_multispectral_reflectance_and_pixel_quality",
} as const);
export type SatelliteRasterProfile = z.infer<
  typeof SatelliteRasterProfileSchema
>;
export function satelliteRasterProfileJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SatelliteRasterProfileSchema, {
    target: "draft-2020-12",
  });
  const constrain = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    if (Array.isArray(value.prefixItems)) {
      value.minItems = value.prefixItems.length;
      value.maxItems = value.prefixItems.length;
    }
    for (const child of Object.values(value)) constrain(child);
  };
  constrain(schema);
  return { ...schema, $id: SATELLITE_RASTER_PROFILE_SCHEMA_ID };
}
