import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const text = z.string().min(1).regex(/\S/);
const common = {
  identity: z.string().regex(/^legacy-[a-f0-9]{64}(?![\s\S])/),
  rationale: text,
};
export const MIGRATION_RESOLUTION_SCHEMA_ID =
  "urn:disclosureos:experimental:migration-resolution:0.1.0";
/** Structure only: membership, exact pins and duplicate decisions require the resolver. */
export const MigrationResolutionSchema = z.strictObject({
  kind: z.literal("legacy_migration_resolution"),
  schemaVersion: z.literal("0.1.0"),
  ledger: z.strictObject({
    sha256: hash,
    byteLength: z
      .number()
      .int()
      .min(1)
      .max(256 * 1024 * 1024),
  }),
  decidedBy: text,
  decidedAt: z.iso.datetime({ offset: true, precision: 0 }).regex(/^(?!0000)/),
  decisions: z
    .array(
      z.discriminatedUnion("action", [
        z.strictObject({
          ...common,
          action: z.literal("select"),
          revision: hash,
        }),
        z.strictObject({ ...common, action: z.literal("defer") }),
      ])
    )
    .max(20000),
});
export type MigrationResolution = z.infer<typeof MigrationResolutionSchema>;
export function migrationResolutionJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MigrationResolutionSchema, { target: "draft-2020-12" }),
    $id: MIGRATION_RESOLUTION_SCHEMA_ID,
  };
}
