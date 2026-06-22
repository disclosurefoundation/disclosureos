import { z } from 'zod';
import { ChainOfCustodySchema } from '../provenance/custody';

export const EvidenceTypeSchema = z
  .enum([
    'material_sample',
    'ground_trace',
    'radiation_reading',
    'electromagnetic_recording',
    'photographic',
    'video',
    'audio_recording',
    'biological_sample',
    'implant',
    'debris',
    'soil_sample',
    'water_sample',
    'vegetation_sample',
    'impression',
    'burn_mark',
    'other',
  ])
  .describe('Kind of physical evidence collected.');

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceQualitySchema = z
  .enum(['laboratory_grade', 'field_collected', 'uncontrolled', 'degraded', 'contaminated', 'unknown'])
  .describe('Collection/handling quality of a physical evidence item.');

export type EvidenceQuality = z.infer<typeof EvidenceQualitySchema>;

export const PhysicalEvidenceItemSchema = z
  .object({
    id: z.string().describe('Stable id, addressable by a claim `evidenceRef` ("physical:<id>").'),
    type: EvidenceTypeSchema,
    quality: EvidenceQualitySchema,
    description: z.string().optional().describe('What the evidence item is and what makes it notable.'),
    collectionDate: z.string().optional().describe('When the evidence was collected (ISO date).'),
    collectionMethod: z
      .string()
      .optional()
      .describe('How the evidence was collected (e.g. "sterile swab", "soil core sample").'),
    collectorName: z.string().optional().describe('Person who collected the evidence.'),
    collectorOrganization: z.string().optional().describe('Organization the collector represents.'),
    storageLocation: z.string().optional().describe('Where the evidence is currently stored.'),
    chainOfCustody: ChainOfCustodySchema.optional(),
    analysisPerformed: z
      .array(z.string())
      .optional()
      .describe('Analyses run on the evidence (e.g. "isotopic analysis", "spectroscopy").'),
    analysisResults: z.string().optional().describe('Summary of what the analyses found.'),
    photographed: z.boolean().optional().describe('Whether the evidence was photographed in situ or in the lab.'),
    labReport: z.boolean().optional().describe('Whether a formal laboratory report exists.'),
    notes: z.string().optional().describe('Free-text context about the evidence item.'),
  })
  .meta({ id: 'PhysicalEvidenceItem' })
  .describe('A physical artifact associated with an observation and its handling record.');

export type PhysicalEvidenceItem = z.infer<typeof PhysicalEvidenceItemSchema>;
