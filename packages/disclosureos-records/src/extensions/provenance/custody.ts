import { z } from 'zod';

export const ChainOfCustodySchema = z
  .enum([
    'verified',
    'partial',
    'unverified',
    'government_held',
    'private_held',
    'lost',
    'destroyed',
    'classified',
    'unknown',
  ])
  .describe('Custody status of an evidence item.');

export type ChainOfCustody = z.infer<typeof ChainOfCustodySchema>;

export const CustodyActionSchema = z
  .enum([
    'creation',
    'collection',
    'transfer',
    'storage',
    'analysis',
    'release',
    'classification',
    'destruction',
    'loss',
    'recovery',
    'other',
  ])
  .describe('An action recorded in a chain-of-custody entry.');

export type CustodyAction = z.infer<typeof CustodyActionSchema>;

export const CustodyEntrySchema = z
  .object({
    entryId: z.string().describe('Stable unique identifier for this custody entry.'),
    date: z.string().describe('When the custody event occurred (ISO date).'),
    action: CustodyActionSchema,
    from: z.string().optional().describe('Party that held the evidence before this event.'),
    to: z.string().optional().describe('Party that held the evidence after this event.'),
    location: z.string().optional().describe('Where the custody event took place.'),
    reference: z
      .string()
      .optional()
      .describe('Document or record substantiating the event (e.g. transfer receipt, log entry).'),
    notes: z.string().optional().describe('Free-text context about the event.'),
  })
  .meta({ id: 'CustodyEntry' })
  .describe('A single custody event for an evidence item.');

export type CustodyEntry = z.infer<typeof CustodyEntrySchema>;

export const ChainOfCustodyRecordSchema = z
  .object({
    evidenceId: z.string().describe('Identifier of the evidence item this custody history belongs to.'),
    status: ChainOfCustodySchema,
    entries: z.array(CustodyEntrySchema),
  })
  .meta({ id: 'ChainOfCustodyRecord' })
  .describe('The full custody history for a piece of evidence.');

export type ChainOfCustodyRecord = z.infer<typeof ChainOfCustodyRecordSchema>;
