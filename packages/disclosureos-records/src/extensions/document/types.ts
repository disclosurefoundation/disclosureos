import { z } from 'zod';

export const DocumentTypeSchema = z
  .enum([
    'foia_release',
    'official_report',
    'congressional_record',
    'military_memo',
    'intelligence_assessment',
    'inspector_general',
    'presidential_directive',
    'executive_order',
    'declassified_cable',
    'investigation_file',
    'other',
  ])
  .describe('Kind of government/official document.');

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentMetadataSchema = z
  .object({
    documentType: DocumentTypeSchema,
    classificationLevel: z
      .string()
      .optional()
      .describe('Current classification of the document (e.g. "UNCLASSIFIED", "SECRET//NOFORN").'),
    originatingAgency: z.string().optional().describe('Agency that produced the document.'),
    controlNumbers: z
      .array(z.string())
      .optional()
      .describe('Agency control or tracking numbers stamped on the document.'),
    foiaRequestNumber: z.string().optional().describe('FOIA request number that produced the document.'),
    declassificationDate: z.string().optional().describe('When the document was declassified (ISO date).'),
    originalClassification: z.string().optional().describe('Classification the document carried when created.'),
    pageCount: z.number().optional().describe('Number of pages in the document.'),
    redactionLevel: z
      .enum(['none', 'partial', 'heavy', 'unknown'])
      .optional()
      .describe('How much of the document is redacted.'),
  })
  .meta({ id: 'DocumentMetadata' })
  .describe('Provenance metadata for a source document (classification, agency, redaction).');

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
