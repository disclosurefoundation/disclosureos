import { z } from 'zod';
import { ConfidenceLevelSchema } from '../../shared';

export const CredibilityFactorSchema = z
  .enum([
    'professional_training',
    'official_capacity',
    'sworn_statement',
    'contemporaneous_record',
    'corroborating_witnesses',
    'corroborating_evidence',
    'consistent_account',
    'no_apparent_motive',
    'reputation_risk',
    'security_clearance',
  ])
  .describe('A factor strengthening witness credibility.');

export type CredibilityFactor = z.infer<typeof CredibilityFactorSchema>;

export const CredibilityDetractorSchema = z
  .enum([
    'anonymous',
    'inconsistent_account',
    'delayed_report',
    'known_fabricator',
    'financial_motive',
    'single_witness',
    'impaired_state',
    'recovered_memory',
  ])
  .describe('A factor weakening witness credibility.');

export type CredibilityDetractor = z.infer<typeof CredibilityDetractorSchema>;

export const WitnessCredibilitySchema = z
  .object({
    // The former `CredibilityRating` was byte-identical to the qualitative
    // `ConfidenceLevel`; it is now the single shared scale (DRY #1).
    rating: ConfidenceLevelSchema.optional(),
    factors: z.array(CredibilityFactorSchema).optional(),
    detractors: z.array(CredibilityDetractorSchema).optional(),
    isProfessionalObserver: z
      .boolean()
      .optional()
      .describe('Whether the witness is a trained observer (pilot, astronomer, military).'),
    hasAviationExperience: z.boolean().optional().describe('Whether the witness has aviation experience.'),
    hasMilitaryExperience: z.boolean().optional().describe('Whether the witness has military experience.'),
    hasScientificBackground: z.boolean().optional().describe('Whether the witness has a scientific background.'),
    hasPriorUAPKnowledge: z
      .boolean()
      .optional()
      .describe('Whether the witness had prior knowledge of or interest in UAP before the observation.'),
    wasSkepticPrior: z
      .boolean()
      .optional()
      .describe('Whether the witness was a skeptic before the observation.'),
    underOathTestimony: z.boolean().optional().describe('Whether the testimony was given under oath.'),
    polygraphAdministered: z.boolean().optional().describe('Whether a polygraph was administered.'),
    polygraphPassed: z.boolean().optional().describe('Whether the witness passed the polygraph.'),
    consistentTestimony: z
      .boolean()
      .optional()
      .describe('Whether the account has remained consistent across retellings.'),
    willingToBeIdentified: z
      .boolean()
      .optional()
      .describe('Whether the witness is willing to be publicly identified.'),
    notes: z.string().optional().describe('Free-text context about the credibility assessment.'),
  })
  .meta({ id: 'WitnessCredibility' })
  .describe('Structured assessment of a witness\'s credibility (rating, factors, detractors).');

export type WitnessCredibility = z.infer<typeof WitnessCredibilitySchema>;
