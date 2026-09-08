import { z } from "zod";
const text = z.string().min(1).regex(/\S/);
export const MIGRATION_LEGACY_SCORES_SCHEMA_ID =
  "urn:disclosureos:experimental:migration-legacy-scores:0.1.0";
/** Declared association and output contract only; neither identity nor methodology is authenticated. */
export const MigrationLegacyScoresSchema = z.strictObject({
  kind: z.literal("legacy_score_preservation_plan"),
  schemaVersion: z.literal("0.1.0"),
  namespace: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/),
  source: z.strictObject({
    sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
    byteLength: z
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
  }),
  reviewedBy: text,
  reviewedAt: z.iso
    .datetime({ offset: true, precision: 0 })
    .regex(/^(?!0000)/)
    .regex(/T[0-9]{2}:[0-9]{2}:[0-9]{2}/),
  decisions: z
    .array(
      z.strictObject({
        sourcePointer: z.string().regex(/^(?:|\/(?:0|[1-9][0-9]*))(?![\s\S])/),
        sourceId: text,
        resultKind: z.enum(["completeness", "compellingness"]),
        outputContractVersion: text,
        methodologyVersion: text,
        rationale: text,
      })
    )
    .max(10000),
});
export type MigrationLegacyScores = z.infer<typeof MigrationLegacyScoresSchema>;
export function migrationLegacyScoresJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MigrationLegacyScoresSchema, { target: "draft-2020-12" }),
    $id: MIGRATION_LEGACY_SCORES_SCHEMA_ID,
  };
}
