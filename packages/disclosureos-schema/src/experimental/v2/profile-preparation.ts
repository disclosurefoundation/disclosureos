import { z } from "zod";
import { ProfileEvaluationSchema } from "./profile-evaluation";
const path = z
  .string()
  .regex(
    /^(?:[A-Za-z0-9][A-Za-z0-9._ -]*\/)*[A-Za-z0-9][A-Za-z0-9._ -]*(?![\s\S])/
  );
const dependency =
  ProfileEvaluationSchema.shape.dependencies.shape.implementation
    .omit({ sha256: true, byteLength: true })
    .extend({ path });
export const PROFILE_PREPARATION_SCHEMA_ID =
  "urn:disclosureos:experimental:profile-preparation:0.1.0";
export const ProfilePreparationSchema = z.strictObject({
  kind: z.literal("profile_preparation"),
  schemaVersion: z.literal("0.1.0"),
  id: ProfileEvaluationSchema.shape.id,
  workflow: ProfileEvaluationSchema.shape.workflow,
  history: path,
  selection: path,
  assets: z.array(
    ProfileEvaluationSchema.shape.assets.element
      .omit({ sha256: true, byteLength: true })
      .extend({ path })
  ),
  dependencies: z.strictObject({
    vocabularies: z.array(dependency).min(1),
    implementation: dependency,
    environment: dependency,
  }),
});
export type ProfilePreparation = z.infer<typeof ProfilePreparationSchema>;
export function profilePreparationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ProfilePreparationSchema, { target: "draft-2020-12" }),
    $id: PROFILE_PREPARATION_SCHEMA_ID,
  };
}
