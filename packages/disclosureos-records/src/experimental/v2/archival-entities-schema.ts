import { z } from "zod";
import { values, entity, target } from "./entity-fields";
import {
  ResearchEntitiesSchema,
  ResearchEntitySchema,
  ResearchEntityTargetSchema,
} from "./research-entities-schema";
import { DocumentSnapshotRefSchema } from "./context-schema";
import { EventTimeValueSchema } from "./primitives";
import { DocumentTypeSchema } from "../../extensions/document/types";
import {
  CustodyActionSchema,
  ChainOfCustodySchema,
} from "../../extensions/provenance/custody";
import { IdentifierSystemSchema } from "../../extensions/identifiers/external";
import { SourceTypeSchema } from "../../source/types";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const refs = z.array(id).min(1);
const url = z.url();
export const ArtifactSnapshotRefSchema = z
  .strictObject({
    sourceRef: z
      .string()
      .regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
    digest: z.strictObject({
      algorithm: z.literal("sha256"),
      value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
    }),
  })
  .describe(
    "One exact artifact in the scoped observation inventory. A URL, title or legacy hash cannot substitute for this identity.",
  );
export const SourceEditionFields = {
  title: values(text),
  type: values(SourceTypeSchema),
  author: values(text),
  organization: values(text),
  issuedAt: values(EventTimeValueSchema),
  archiveLocation: values(text),
  primaryDisplay: values(z.boolean()),
  originalUrl: values(url),
  archiveUrl: values(url),
  reference: values(text),
  isPrimarySource: values(
    z.strictObject({ value: z.boolean(), context: text }),
  ),
  documentType: values(DocumentTypeSchema),
  originatingAgency: values(text),
  controlNumbers: values(z.array(text).min(1)),
  foiaRequestNumber: values(text),
  originalClassification: values(text),
  classificationLevel: values(text),
  pageCount: values(z.number().int().min(1)),
  redactionLevel: values(z.enum(["none", "partial", "heavy", "unknown"])),
  redactionDescription: values(text),
  redactionPercent: values(z.number().min(0).max(100)),
  notes: values(text),
};
export const DocumentEventFields = {
  eventType: values(
    z.enum(["creation", "release", "classification", "declassification"]),
  ),
  occurredAt: values(EventTimeValueSchema),
  authority: values(text),
  reference: values(text),
  marking: values(text),
  notes: values(text),
};
const declaredHash = z.discriminatedUnion("algorithm", [
  z.strictObject({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-fA-F0-9]{64}(?![\s\S])/),
  }),
  z.strictObject({
    algorithm: z.literal("sha512"),
    value: z.string().regex(/^[a-fA-F0-9]{128}(?![\s\S])/),
  }),
  z.strictObject({
    algorithm: z.literal("sha1"),
    value: z.string().regex(/^[a-fA-F0-9]{40}(?![\s\S])/),
  }),
  z.strictObject({
    algorithm: z.literal("md5"),
    value: z.string().regex(/^[a-fA-F0-9]{32}(?![\s\S])/),
  }),
]);
export const DigitalArtifactFields = {
  declaredHashes: values(
    z
      .array(
        z.strictObject({
          hash: declaredHash,
          appliesTo: z.union([
            z.strictObject({
              kind: z.literal("artifact"),
              reference: ArtifactSnapshotRefSchema,
            }),
            z.strictObject({
              kind: z.literal("unavailable_original"),
              description: text,
            }),
          ]),
        }),
      )
      .min(1),
  ),
  device: values(text),
  manufacturer: values(text),
  model: values(text),
  software: values(text),
  originalFilename: values(text),
  originalCreationDate: values(EventTimeValueSchema),
  gpsCoordinates: values(
    z.strictObject({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitude: z
        .strictObject({
          value: z.number(),
          unit: z.union([text, z.null()]),
          datum: text.optional(),
        })
        .optional(),
    }),
  ),
  metadataPreserved: values(z.boolean()),
  metadataStripped: values(z.boolean()),
  strippedReason: values(text),
  custodyStatus: values(ChainOfCustodySchema),
  provenanceChainDescription: values(z.array(text).min(1)),
  derivedFromArtifactIds: values(refs),
  lastUpdated: values(EventTimeValueSchema),
  notes: values(text),
};
export const DigitalCustodyFields = {
  action: values(CustodyActionSchema),
  occurredAt: values(EventTimeValueSchema),
  from: values(text),
  to: values(text),
  location: values(text),
  reference: values(text),
  notes: values(text),
};
export const ExternalIdentifierFields = {
  value: values(
    z.strictObject({
      system: IdentifierSystemSchema,
      systemName: text.optional(),
      value: text,
      url: url.optional(),
      notes: text.optional(),
    }),
  ),
  primaryDisplay: values(z.boolean()),
  notes: values(text),
};
export const IdentifierCheckFields = {
  checkedAt: values(EventTimeValueSchema),
  agent: values(text),
  method: values(text),
  methodVersion: values(text),
  outcome: values(
    z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("access"),
        result: z.enum(["accessible", "inaccessible", "unknown"]),
      }),
      z.strictObject({
        kind: z.literal("identity"),
        result: z.enum(["matches", "does_not_match", "unknown"]),
      }),
    ]),
  ),
  notes: values(text),
};
for (const fields of [
  SourceEditionFields,
  DocumentEventFields,
  DigitalArtifactFields,
  DigitalCustodyFields,
  ExternalIdentifierFields,
  IdentifierCheckFields,
])
  for (const [key, schema] of Object.entries(fields))
    (fields as Record<string, z.ZodType>)[key] = schema.describe(
      `Sourced ${key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} assertions. Alternatives and missingness are retained; declarations are not independent verification.`,
    );
const edition = entity("source_edition", SourceEditionFields).extend({
  artifact: ArtifactSnapshotRefSchema,
});
const artifact = entity("digital_artifact", DigitalArtifactFields).extend({
  artifact: ArtifactSnapshotRefSchema,
});
const documentEvent = entity("document_event", DocumentEventFields).extend({
  editionId: id,
});
const custody = entity("digital_custody_action", DigitalCustodyFields).extend({
  artifactId: id,
  predecessor: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("action"), id }),
      z.strictObject({ kind: z.literal("start") }),
      z.strictObject({ kind: z.literal("unknown"), reason: text }),
    ])
    .describe(
      "Declared preceding action on the same artifact, a declared beginning, or an explicit gap. Array order carries no chronology.",
    ),
});
const identifier = entity(
  "external_identifier",
  ExternalIdentifierFields,
).extend({
  subject: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("observation") }),
      z.strictObject({ kind: z.literal("source_edition"), editionId: id }),
    ])
    .describe(
      "The scoped observation or one exact source edition. A catalog identifier is not automatically an event identifier.",
    ),
});
const check = entity("identifier_check", IdentifierCheckFields).extend({
  identifierId: id,
  identifierAssertionId: id,
});
export const ArchivalEntitySchema = z.discriminatedUnion("kind", [
  ...ResearchEntitySchema.options,
  edition,
  documentEvent,
  artifact,
  custody,
  identifier,
  check,
]);
export const ARCHIVAL_ENTITIES_SCHEMA_ID =
  "urn:disclosureos:experimental:research-entities:0.2.0";
export const ArchivalEntitiesSchema = ResearchEntitiesSchema.extend({
  schemaVersion: z.literal("0.2.0"),
  entities: z.array(ArchivalEntitySchema).min(1),
}).describe(
  "Public research declarations including exact source editions and digital artifact custody. No source authentication, public-release permission or complete custody is inferred.",
);
export const ArchivalEntityTargetSchema = z.discriminatedUnion("kind", [
  ...ResearchEntityTargetSchema.options,
  target("source_edition", SourceEditionFields),
  target("document_event", DocumentEventFields),
  target("digital_artifact", DigitalArtifactFields),
  target("digital_custody_action", DigitalCustodyFields),
  target("external_identifier", ExternalIdentifierFields),
  target("identifier_check", IdentifierCheckFields),
]);
export const ArchivalEntityReferenceSchema = z.strictObject({
  document: DocumentSnapshotRefSchema.extend({
    schemaId: z.literal(ARCHIVAL_ENTITIES_SCHEMA_ID),
  }),
  target: ArchivalEntityTargetSchema,
});
export const ArchivalEntityAssertionReferenceSchema =
  ArchivalEntityReferenceSchema.extend({ assertionId: id });
export type ArchivalEntities = z.infer<typeof ArchivalEntitiesSchema>;
export type ArchivalEntity = z.infer<typeof ArchivalEntitySchema>;
export type ArchivalEntityReference = z.infer<
  typeof ArchivalEntityReferenceSchema
>;
export type ArtifactSnapshotRef = z.infer<typeof ArtifactSnapshotRefSchema>;
export function archivalEntitiesJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ArchivalEntitiesSchema, {
      target: "draft-2020-12",
      reused: "ref",
    }),
    $id: ARCHIVAL_ENTITIES_SCHEMA_ID,
  };
}
