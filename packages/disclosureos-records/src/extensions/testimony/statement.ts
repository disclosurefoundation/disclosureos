import { z } from 'zod';
import { TemporalCertaintySchema } from '../../temporal/certainty';
import { ChainOfCustodySchema } from '../provenance/custody';
import { SourceReferenceSchema } from '../../source/reference';
import { WitnessSchema } from './witness';

export const TestimonyContextSchema = z
  .enum([
    'sworn_affidavit',
    'congressional_testimony',
    'deposition',
    'official_interview',
    'written_statement',
    'recorded_interview',
    'informal_account',
    'anonymous_tip',
    'whistleblower_disclosure',
  ])
  .describe('The setting in which testimony was given.');

export type TestimonyContext = z.infer<typeof TestimonyContextSchema>;

export const TestimonyDateSchema = z
  .object({
    date: z.string().describe('When the testimony was given (ISO date).'),
    certainty: TemporalCertaintySchema,
  })
  .meta({ id: 'TestimonyDate' })
  .describe('When testimony was given, with its certainty.');

export type TestimonyDate = z.infer<typeof TestimonyDateSchema>;

export const TestimonyStatementSchema = z
  .object({
    statementId: z
      .string()
      .describe('Stable id, addressable by a claim `evidenceRef` ("testimony:<statementId>").'),
    witness: WitnessSchema,
    context: TestimonyContextSchema,
    date: TestimonyDateSchema,
    content: z.string().optional().describe('Full text of the statement, when available.'),
    summary: z.string().optional().describe('Brief summary of what the statement asserts.'),
    sourceDocument: SourceReferenceSchema.optional(),
    chainOfCustody: ChainOfCustodySchema.optional(),
    additionalEvidenceIds: z
      .array(z.string())
      .optional()
      .describe('Ids of other evidence items the statement references or supports.'),
  })
  .meta({ id: 'TestimonyStatement' })
  .describe('A single witness statement, its context, and supporting documentation.');

export type TestimonyStatement = z.infer<typeof TestimonyStatementSchema>;
