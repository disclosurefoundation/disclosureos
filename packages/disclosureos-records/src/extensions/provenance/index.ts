import { z } from 'zod';
import { ChainOfCustodyRecordSchema, ChainOfCustodySchema } from './custody';
import { DigitalProvenanceSchema } from './digital';

export {
  ChainOfCustodySchema,
  CustodyActionSchema,
  CustodyEntrySchema,
  ChainOfCustodyRecordSchema,
} from './custody';
export type {
  ChainOfCustody,
  CustodyAction,
  CustodyEntry,
  ChainOfCustodyRecord,
} from './custody';
export {
  HashAlgorithmSchema,
  FileHashSchema,
  ThirdPartyVerificationSchema,
  VerificationMethodSchema,
  VerificationResultSchema,
  CaptureMetadataSchema,
  DigitalProvenanceSchema,
} from './digital';
export type {
  HashAlgorithm,
  FileHash,
  ThirdPartyVerification,
  VerificationMethod,
  VerificationResult,
  CaptureMetadata,
  DigitalProvenance,
} from './digital';

/**
 * Payload of the optional `Observation.provenance` slot — the forensic/custody
 * trail for a record: high-level custody status, the full custody chain, and the
 * digital authenticity record. All optional; attach only what applies.
 */
export const ProvenanceSchema = z
  .object({
    custodyStatus: ChainOfCustodySchema.optional(),
    custody: ChainOfCustodyRecordSchema.optional(),
    digital: DigitalProvenanceSchema.optional(),
  })
  .meta({ id: 'Provenance' })
  .describe('Forensic provenance for an observation: custody status/chain and digital authenticity.');

export type Provenance = z.infer<typeof ProvenanceSchema>;
