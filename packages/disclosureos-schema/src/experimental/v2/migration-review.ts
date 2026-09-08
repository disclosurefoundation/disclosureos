import { z } from "zod";
const text = z.string().min(1).regex(/\S/);
const common = {
  sourceId: text,
  sourcePointers: z
    .array(z.string().regex(/^\/(?:[^~]|~[01])*(?![\s\S])/))
    .min(1),
  rationale: text,
  value: z.json(),
};
export const MIGRATION_REVIEW_SCHEMA_ID =
  "urn:disclosureos:experimental:migration-review:0.1.0";
/** Plan structure only. Target values and references require the v2 semantic parser. */
export const MigrationReviewSchema = z.strictObject({
  kind: z.literal("legacy_migration_review"),
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
      z.discriminatedUnion("field", [
        z.strictObject({ ...common, field: z.literal("eventTime") }),
        z.strictObject({
          ...common,
          field: z.literal("position"),
          frames: z.array(z.json()),
        }),
      ])
    )
    .min(1)
    .max(20000),
});
export type MigrationReview = z.infer<typeof MigrationReviewSchema>;
export function migrationReviewJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MigrationReviewSchema, { target: "draft-2020-12" }),
    $id: MIGRATION_REVIEW_SCHEMA_ID,
  };
}
