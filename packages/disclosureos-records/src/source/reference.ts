import { z } from 'zod';
import { SourceTypeSchema } from './types';
import { SourceCredibilitySchema } from './credibility';

export const SourceReferenceSchema = z
  .object({
    sourceId: z.string().describe('Stable unique identifier for this source.'),
    type: SourceTypeSchema,
    title: z.string().describe('Title of the source document, article, or material.'),
    author: z.string().optional().describe('Author of the source material.'),
    organization: z.string().optional().describe('Organization that produced or published the source.'),
    date: z.string().optional().describe('Publication or creation date of the source (ISO date).'),
    url: z.string().optional().describe('Link to the source material.'),
    archiveUrl: z.string().optional().describe('Archived copy of the source (e.g. Wayback Machine), in case the original disappears.'),
    reference: z
      .string()
      .optional()
      .describe('Citation locator within the source (e.g. page number, document section).'),
    credibility: SourceCredibilitySchema,
    isPrimarySource: z
      .boolean()
      .optional()
      .describe('Whether this is a primary source (original document/recording) rather than secondary reporting.'),
    classificationLevel: z
      .string()
      .optional()
      .describe('Government classification of the source, if it was ever classified.'),
    notes: z.string().optional().describe('Free-text context about the source.'),
  })
  .meta({ id: 'SourceReference' })
  .describe('A citation/source backing an observation, with its credibility tier.');

export type SourceReference = z.infer<typeof SourceReferenceSchema>;
