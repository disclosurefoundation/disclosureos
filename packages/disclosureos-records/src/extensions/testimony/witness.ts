import { z } from 'zod';
import { WitnessCategorySchema } from './category';
import { WitnessCredibilitySchema } from './credibility';

export const SecurityClearanceSchema = z
  .enum(['none', 'confidential', 'secret', 'top_secret', 'sci', 'unknown'])
  .describe('Security clearance level held by a witness.');

export type SecurityClearance = z.infer<typeof SecurityClearanceSchema>;

export const WitnessSchema = z
  .object({
    witnessId: z.string().describe('Stable unique identifier for this witness.'),
    category: WitnessCategorySchema,
    anonymous: z.boolean().describe('Whether the witness\u2019s identity is withheld.'),
    publicName: z.string().optional().describe('Witness\u2019s name as publicly known, when not anonymous.'),
    pseudonym: z.string().optional().describe('Pseudonym used when the witness is anonymous.'),
    role: z.string().optional().describe('Witness\u2019s role at the time (e.g. "F/A-18F pilot", "radar operator").'),
    organization: z.string().optional().describe('Organization the witness belonged to at the time.'),
    experienceYears: z.number().optional().describe('Years of relevant professional experience.'),
    securityClearance: SecurityClearanceSchema.optional(),
    credibility: WitnessCredibilitySchema.optional(),
    statementSummary: z.string().optional().describe('Brief summary of what the witness reported.'),
    interviewAvailable: z.boolean().optional().describe('Whether a recorded interview with the witness exists.'),
    writtenReportAvailable: z.boolean().optional().describe('Whether a written report from the witness exists.'),
  })
  .meta({ id: 'Witness' })
  .describe('A person who reported or corroborated an observation.');

export type Witness = z.infer<typeof WitnessSchema>;
