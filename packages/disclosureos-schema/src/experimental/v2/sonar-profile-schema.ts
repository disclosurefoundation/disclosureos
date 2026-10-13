import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));

/** An optional interpretation of retained monostatic envelopes, not an instrument capability claim. */
export const SonarProfileSchema = z.strictObject({
  kind: z.literal("sonar_profile"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  contextId: id,
  sourceSelectionId: id,
  acquisitionRef: ref("acquisition"),
  acquisitionProductRef: ref("product"),
  receiveMaskAcquisitionProductRef: ref("product"),
  channelId: id,
  timeOrigin: z.iso.datetime({ offset: true }),
  mode: z.literal("monostatic_echo_envelope"),
  dataOrigin: z.enum(["synthetic", "instrument"]),
  amplitudeRepresentation: z.literal("normalized_envelope"),
  sampling: z.strictObject({
    pings: z.number().int().min(1).max(1000000),
    delayBins: z.number().int().min(1).max(1000000),
    delayStartSeconds: z.number().min(0),
    delayStepSeconds: z.number().positive(),
    pingStepSeconds: z.number().positive(),
  }),
  propagation: z.strictObject({
    kind: z.literal("constant_assumed_sound_speed"),
    soundSpeedMps: z.number().positive(),
    travelPath: z.literal("two_way"),
    distanceMeaning: z.literal("modeled_one_way_path_length"),
  }),
  availability: z.strictObject({
    kind: z.literal("receive_retention_mask"),
    unavailable: z.literal(0),
    available: z.literal(1),
    missingAmplitude: z.literal("zero_storage_placeholder"),
  }),
  products: z.strictObject({
    amplitudes: ref("product"),
    receiveMask: ref("product"),
  }),
});

export const SONAR_PROFILE_SCHEMA_ID =
  "urn:disclosureos:experimental:sonar-profile:0.1.0";
export const SONAR_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:monostatic-echo-envelope",
  version: "0.1.0",
  scope: "retained_echo_envelope_and_assumed_two_way_distance",
} as const);
export type SonarProfile = z.infer<typeof SonarProfileSchema>;
export function sonarProfileJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(SonarProfileSchema, { target: "draft-2020-12" }),
    $id: SONAR_PROFILE_SCHEMA_ID,
  };
}
