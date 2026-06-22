import { z } from 'zod';

export const SourceTypeSchema = z
  .enum([
    'foia',
    'official_report',
    'official_statement',
    'congressional_testimony',
    'congressional_report',
    'military_document',
    'intelligence_document',
    'whistleblower',
    'firsthand_witness',
    'secondhand_account',
    'news_article',
    'documentary',
    'interview',
    'book',
    'academic_paper',
    'investigation_report',
    'database_entry',
    'social_media',
    'website',
    'other',
  ])
  .describe('Kind of source backing an observation (document, testimony, media, etc.).');

export type SourceType = z.infer<typeof SourceTypeSchema>;
