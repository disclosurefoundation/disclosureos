import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
/** Optional single-channel pressure capture with reproducible spectral-density windows. */
export const PassiveSonarProfileSchema = z.strictObject({
  kind: z.literal("passive_sonar_profile"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  contextId: id,
  sourceSelectionId: id,
  acquisitionRef: ref("acquisition"),
  acquisitionProductRef: ref("product"),
  sampleMaskAcquisitionProductRef: ref("product"),
  channelId: id,
  processingRef: ref("process"),
  timeOrigin: z.iso.datetime({ offset: true }),
  mode: z.literal("single_hydrophone_pressure"),
  dataOrigin: z.enum(["synthetic", "instrument"]),
  sampling: z.strictObject({
    samples: z.number().int().min(1).max(16777216),
    sampleRateHz: z.number().int().positive().max(1000000000),
  }),
  transform: z.strictObject({
    kind: z.literal("one_sided_power_spectral_density"),
    windowSamples: z.number().int().min(4).max(65536),
    hopSamples: z.number().int().positive().max(65536),
    window: z.literal("periodic_hann"),
    detrend: z.literal("remove_arithmetic_mean_before_window"),
    padding: z.literal("none_full_windows_only"),
    scaling: z.literal("sum_squared_window_times_sample_rate"),
    oneSided: z.literal("double_interior_bins_only"),
    missingWindow: z.literal("unavailable_if_any_input_missing"),
  }),
  display: z.strictObject({
    densityReferencePa2PerHz: z.literal(1e-12),
    logarithm: z.literal("10_log10_density_over_reference"),
    zeroDensity: z.literal("negative_infinity_no_floor"),
  }),
  availability: z.strictObject({
    unavailable: z.literal(0),
    available: z.literal(1),
    missingValue: z.literal("zero_storage_placeholder"),
  }),
  products: z.strictObject({
    pressure: ref("product"),
    sampleMask: ref("product"),
    powerSpectralDensity: ref("product"),
    frameMask: ref("product"),
  }),
});
export const PASSIVE_SONAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:passive-sonar-profile:0.1.0";
export const PASSIVE_SONAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:passive-hydrophone-pressure",
  version: "0.1.0",
  scope: "single_channel_pressure_and_reproducible_spectral_density",
} as const);
export type PassiveSonarProfile = z.infer<typeof PassiveSonarProfileSchema>;
export function passiveSonarProfileJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(PassiveSonarProfileSchema, { target: "draft-2020-12" }),
    $id: PASSIVE_SONAR_PROFILE_SCHEMA_ID,
  };
}
