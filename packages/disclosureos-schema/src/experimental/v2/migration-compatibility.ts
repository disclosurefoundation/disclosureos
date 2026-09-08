import { z } from "zod";
const text = z.string().min(1).regex(/\S/);
const pin = {
  sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  byteLength: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 * 1024),
};
const blob = z.strictObject({ ...pin, bytes: z.string().min(1) });
export const MIGRATION_COMPATIBILITY_SCHEMA_ID =
  "urn:disclosureos:experimental:migration-compatibility:0.1.0";
export const MigrationCompatibilitySchema = z.strictObject({
  kind: z.literal("legacy_sensor_revision_review"),
  schemaVersion: z.literal("0.1.0"),
  source: z.strictObject({
    sha256: pin.sha256,
    byteLength: z
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
  }),
  namespace: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/),
  reviewedBy: text,
  reviewedAt: z.iso
    .datetime({ offset: true, precision: 0 })
    .regex(/^(?!0000)/)
    .regex(/T[0-9]{2}:[0-9]{2}:[0-9]{2}/),
  context: blob,
  decisions: z
    .array(
      z.strictObject({
        sourceId: text,
        sensorPointer: z
          .string()
          .regex(
            /^\/sensorEvidence\/sensors\/(?:0|[1-9][0-9]*)\/sensorRef(?![\s\S])/
          ),
        legacyRef: text,
        acquisitionRef: text,
        manifest: blob,
        provenance: blob,
        provenanceLocator: text,
        rationale: text,
      })
    )
    .max(10000),
});
export type MigrationCompatibility = z.infer<
  typeof MigrationCompatibilitySchema
>;
export function migrationCompatibilityJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MigrationCompatibilitySchema, {
      target: "draft-2020-12",
    }),
    $id: MIGRATION_COMPATIBILITY_SCHEMA_ID,
  };
}
