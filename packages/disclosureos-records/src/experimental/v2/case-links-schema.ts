import { z } from "zod";
import {
  DocumentSnapshotRefSchema,
  ContextReferenceSchema,
} from "./context-schema";
import { ResearchEntityReferenceSchema } from "./research-entities-schema";
import { ArchivalEntityReferenceSchema } from "./archival-entities-schema";
import { MaterialEntityReferenceSchema } from "./material-entities-schema";
import { LaboratoryEntityReferenceSchema } from "./laboratory-entities-schema";
import { CaseSnapshotRefSchema } from "./case-claim-history-schema";
import { CaseProvenanceSchema } from "./case-schema";
import { instantString } from "./primitives";
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  text = z.string().min(1).regex(/\S/);
const common = {
  id,
  observationId: id,
  basis: z.strictObject({ text, provenance: CaseProvenanceSchema }),
};
const entityReference = z.union([
  ResearchEntityReferenceSchema.extend({
    target: ResearchEntityReferenceSchema.shape.target.optional(),
  }),
  ArchivalEntityReferenceSchema.extend({
    target: ArchivalEntityReferenceSchema.shape.target.optional(),
  }),
  MaterialEntityReferenceSchema.extend({
    target: MaterialEntityReferenceSchema.shape.target.optional(),
  }),
  LaboratoryEntityReferenceSchema.extend({
    target: LaboratoryEntityReferenceSchema.shape.target.optional(),
  }),
]);
export const CaseSupplementLinkSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("context"),
    reference: ContextReferenceSchema.extend({
      target: ContextReferenceSchema.shape.target.optional(),
    }),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("entities"),
    reference: entityReference,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("intake"),
    document: DocumentSnapshotRefSchema.extend({
      schemaId: z.literal("urn:disclosureos:experimental:source-intake:0.1.0"),
    }),
    artifactLinks: z
      .array(
        z.strictObject({
          artifactId: id,
          observationRef: z
            .string()
            .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
        }),
      )
      .min(1)
      .optional()
      .describe(
        "Optional inventory associations. Matching declared SHA-256 digests is not verification of original bytes or a derivation relationship.",
      ),
  }),
]);
export const CASE_LINKS_SCHEMA_ID =
  "urn:disclosureos:experimental:case-links:0.1.0";
export const CaseLinksSchema = z
  .strictObject({
    kind: z.literal("case_links"),
    schemaVersion: z.literal("0.1.0"),
    id,
    recordedAt: instantString,
    recordedBy: text,
    caseRef: CaseSnapshotRefSchema,
    links: z.array(CaseSupplementLinkSchema).min(1),
  })
  .describe(
    "Attributable associations to one immutable case revision. The case and its assessment history do not depend on this document.",
  );
export type CaseLinks = z.infer<typeof CaseLinksSchema>;
export type CaseSupplementLink = z.infer<typeof CaseSupplementLinkSchema>;
export function caseLinksJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(CaseLinksSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: CASE_LINKS_SCHEMA_ID,
  };
}
