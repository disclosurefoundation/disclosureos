import { z } from 'zod';

export const HashAlgorithmSchema = z
  .enum(['sha256', 'sha512', 'sha1', 'md5'])
  .describe('Cryptographic hash algorithm used to fingerprint a file.');

export type HashAlgorithm = z.infer<typeof HashAlgorithmSchema>;

export const FileHashSchema = z
  .object({
    algorithm: HashAlgorithmSchema,
    value: z.string().describe('Hex-encoded hash digest of the file contents.'),
  })
  .meta({ id: 'FileHash' })
  .describe('A content hash of a file.');

export type FileHash = z.infer<typeof FileHashSchema>;

export const VerificationMethodSchema = z
  .enum([
    'metadata_analysis',
    'forensic_analysis',
    'hash_verification',
    'chain_of_custody',
    'source_confirmation',
    'expert_review',
    'ai_analysis',
    'other',
  ])
  .describe('Method used to verify media authenticity.');

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const VerificationResultSchema = z
  .enum([
    'authentic',
    'likely_authentic',
    'inconclusive',
    'likely_manipulated',
    'manipulated',
    'ai_generated',
    'deepfake',
    'composite',
    'unknown',
  ])
  .describe('Outcome of an authenticity verification.');

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const ThirdPartyVerificationSchema = z
  .object({
    verifier: z.string().describe('Name of the person who performed the verification.'),
    organization: z.string().optional().describe('Organization the verifier represents.'),
    credentials: z
      .string()
      .optional()
      .describe('Verifier\u2019s relevant qualifications (e.g. "certified forensic video analyst").'),
    date: z.string().describe('When the verification was performed (ISO date).'),
    method: VerificationMethodSchema,
    methodDescription: z.string().optional().describe('Fuller description of how the verification was performed.'),
    result: VerificationResultSchema,
    confidence: z
      .enum(['high', 'medium', 'low'])
      .optional()
      .describe('Verifier\u2019s confidence in their own result.'),
    findings: z.string().optional().describe('Summary of what the verification found.'),
    reportUrl: z.string().optional().describe('Link to the full verification report.'),
  })
  .meta({ id: 'ThirdPartyVerification' })
  .describe('An independent authenticity assessment of media or a document.');

export type ThirdPartyVerification = z.infer<typeof ThirdPartyVerificationSchema>;

export const CaptureMetadataSchema = z
  .object({
    device: z.string().optional().describe('Capture device as recorded in metadata (e.g. "iPhone 14 Pro").'),
    manufacturer: z.string().optional().describe('Device manufacturer from metadata.'),
    model: z.string().optional().describe('Device model from metadata.'),
    software: z.string().optional().describe('Software that produced or processed the file.'),
    originalFilename: z.string().optional().describe('Filename as originally captured, before any renaming.'),
    originalCreationDate: z.string().optional().describe('Creation timestamp embedded in the file metadata.'),
    gpsCoordinates: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        altitude: z.number().optional(),
      })
      .optional()
      .describe('GPS position embedded in the file metadata.'),
    metadataPreserved: z.boolean().optional().describe('Whether the original metadata survives intact.'),
    metadataStripped: z.boolean().optional().describe('Whether metadata was removed at some point.'),
    strippedReason: z
      .string()
      .optional()
      .describe('Why metadata was stripped (e.g. "platform re-encoding", "privacy redaction").'),
  })
  .meta({ id: 'CaptureMetadata' })
  .describe('Capture/EXIF-style metadata extracted from a media file.');

export type CaptureMetadata = z.infer<typeof CaptureMetadataSchema>;

export const DigitalProvenanceSchema = z
  .object({
    hash: FileHashSchema.optional(),
    additionalHashes: z.array(FileHashSchema).optional(),
    captureMetadata: CaptureMetadataSchema.optional(),
    verifications: z.array(ThirdPartyVerificationSchema).optional(),
    provenanceChain: z
      .array(z.string())
      .optional()
      .describe('Ordered hops the file took from capture to here (e.g. "witness phone → NYT → public release").'),
    manipulationDetected: z.boolean().optional().describe('Whether any analysis found evidence of manipulation.'),
    manipulationDescription: z.string().optional().describe('What manipulation was found, if any.'),
    authenticityAssessment: VerificationResultSchema.optional(),
    authenticityConfidence: z
      .enum(['high', 'medium', 'low', 'unassessed'])
      .optional()
      .describe('Overall confidence in the authenticity assessment.'),
    lastUpdated: z.string().optional().describe('When this provenance record was last updated (ISO timestamp).'),
    notes: z.string().optional().describe('Free-text context about the provenance trail.'),
  })
  .meta({ id: 'DigitalProvenance' })
  .describe('Digital authenticity trail for media: hashes, capture metadata, and verifications.');

export type DigitalProvenance = z.infer<typeof DigitalProvenanceSchema>;
