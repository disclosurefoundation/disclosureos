import { z } from "zod";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { ExperimentalObservationSchema } from "./observation-schema";
import { instantString } from "./primitives";

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
// Authority-qualified identities, compared exactly. These identifiers are never fetched.
const catalogId = z
  .string()
  .regex(
    /^(?:urn:[A-Za-z0-9][A-Za-z0-9-]*:[^\s]+|https:\/\/[^\s/?#]+(?:\/[^\s]*)?)(?![\s\S])/,
  );
const revision = text.regex(
  /^(?![ \t\r\n]*[Ll][Aa][Tt][Ee][Ss][Tt][ \t\r\n]*$)[\s\S]+$/,
  "A revision must identify an immutable publication, not latest.",
);
const extensions = ExperimentalObservationSchema.shape.extensions;
export const VOCABULARY_CATALOG_SCHEMA_ID =
  "urn:disclosureos:experimental:vocabulary-catalog:0.1.0";
export const VOCABULARY_BINDINGS_SCHEMA_ID =
  "urn:disclosureos:experimental:vocabulary-bindings:0.1.0";
export const VOCABULARY_TERM_REFERENCE_SCHEMA_ID =
  "urn:disclosureos:experimental:vocabulary-term-reference:0.1.0";

export const VocabularyCatalogTermSchema = z.strictObject({
  id,
  label: text,
  description: text,
  code: text.optional(),
  category: text.optional(),
  extensions,
});
export const VocabularyCatalogSchema = z.strictObject({
  kind: z.literal("vocabulary_catalog"),
  schemaVersion: z.literal("0.1.0"),
  id,
  catalogId,
  revision,
  publishedBy: text,
  publishedAt: instantString,
  terms: z.array(VocabularyCatalogTermSchema).min(1),
  extensions,
});
export const VocabularyTermReferenceSchema = z.strictObject({
  catalogId,
  revision,
  document: DocumentSnapshotRefSchema,
  termId: id,
});
export const VocabularyBindingSchema = z.strictObject({
  id,
  recordedAt: instantString,
  assignedBy: text,
  rationale: text,
  claim: z.strictObject({ document: DocumentSnapshotRefSchema, claimId: id }),
  relation: z.enum(["about", "assessment_criterion"]),
  term: VocabularyTermReferenceSchema,
});
export const VocabularyBindingsSchema = z.strictObject({
  kind: z.literal("vocabulary_bindings"),
  schemaVersion: z.literal("0.1.0"),
  id,
  bindings: z.array(VocabularyBindingSchema).min(1),
});
export type VocabularyCatalog = z.infer<typeof VocabularyCatalogSchema>;
export type VocabularyCatalogTerm = z.infer<typeof VocabularyCatalogTermSchema>;
export type VocabularyTermReference = z.infer<
  typeof VocabularyTermReferenceSchema
>;
export type VocabularyBinding = z.infer<typeof VocabularyBindingSchema>;
export type VocabularyBindings = z.infer<typeof VocabularyBindingsSchema>;
function emit(schema: z.ZodType, schemaId: string): Record<string, unknown> {
  return {
    ...z.toJSONSchema(schema, { target: "draft-2020-12", reused: "ref" }),
    $id: schemaId,
  };
}
export const vocabularyCatalogJsonSchema = () =>
  emit(VocabularyCatalogSchema, VOCABULARY_CATALOG_SCHEMA_ID);
export const vocabularyTermReferenceJsonSchema = () =>
  emit(VocabularyTermReferenceSchema, VOCABULARY_TERM_REFERENCE_SCHEMA_ID);
export const vocabularyBindingsJsonSchema = () =>
  emit(VocabularyBindingsSchema, VOCABULARY_BINDINGS_SCHEMA_ID);
