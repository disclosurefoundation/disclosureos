import { z } from 'zod';

export const IdentifierSystemSchema = z
  .enum([
    'nuforc',
    'mufon',
    'geipan',
    'cufos',
    'nicap',
    'bluebook',
    'nara',
    'foia',
    'aaro',
    'congress',
    'doi',
    'arxiv',
    'orcid',
    'pubmed',
    'isbn',
    'issn',
    'youtube',
    'vimeo',
    'internet_archive',
    'wayback',
    'url',
    'uri',
    'custom',
  ])
  .describe('External identifier namespace (reporting centers, archives, academic registries, media hosts).');

export type IdentifierSystem = z.infer<typeof IdentifierSystemSchema>;

export const ExternalIdentifierSchema = z
  .object({
    system: IdentifierSystemSchema,
    systemName: z
      .string()
      .optional()
      .describe('Display name of the system, required when `system` is "custom".'),
    value: z.string().describe('The identifier value within the external system (e.g. a case number).'),
    url: z.string().optional().describe('Direct link to the record in the external system.'),
    verified: z.boolean().optional().describe('Whether the identifier has been confirmed to point at this observation.'),
    verifiedDate: z.string().optional().describe('When the identifier was last verified (ISO date).'),
    accessible: z.boolean().optional().describe('Whether the external record is currently reachable.'),
    accessCheckedDate: z.string().optional().describe('When accessibility was last checked (ISO date).'),
    notes: z.string().optional().describe('Free-text context about the cross-reference.'),
  })
  .meta({ id: 'ExternalIdentifier' })
  .describe('A reference to this observation in an external system or archive.');

export type ExternalIdentifier = z.infer<typeof ExternalIdentifierSchema>;

export const CrossReferencesSchema = z
  .object({
    primary: ExternalIdentifierSchema.optional(),
    identifiers: z.array(ExternalIdentifierSchema),
  })
  .meta({ id: 'CrossReferences' })
  .describe('External identifiers cross-referencing this observation, with an optional primary.');

export type CrossReferences = z.infer<typeof CrossReferencesSchema>;
