import { z } from 'zod';
import { TemporalDataSchema } from '../temporal/temporal-data';
import { LocationDataSchema } from '../geo/location';
import { MediaAttachmentSchema } from '../media/attachment';
import { SensorEvidenceDataSchema } from '../source/sensor/types';
import { ProvenanceSchema } from '../extensions/provenance';
import { CrossReferencesSchema } from '../extensions/identifiers';
import { TestimonyStatementSchema } from '../extensions/testimony';
import { PhysicalEvidenceItemSchema } from '../extensions/physical';
import { DocumentMetadataSchema } from '../extensions/document';
import type { LocationData } from '../geo/location';
import type { TemporalData } from '../temporal/temporal-data';
import {
  ObjectCharacteristicsSchema,
  MovementSchema,
  WitnessesSchema,
  InvestigationSchema,
  ResponseImpactSchema,
  EnvironmentSchema,
  RelationsSchema,
  AviationSchema,
  SourceDataSchema,
} from './domains';

export const PublicationStatusSchema = z
  .enum(['draft', 'review', 'published', 'archived', 'retracted'])
  .describe('Lifecycle/publication state of an observation record.');

export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

/**
 * Open extension seam for cross-package slots.
 *
 * `records` declares this empty. The layer packages `@disclosureos/observables`
 * and `@disclosureos/origins` augment it via `declare module '@disclosureos/records'`
 * so that **importing a layer package automatically types its slot on
 * `Observation`** — no manual intersection, no `unknown` casts. (`@disclosureos/scoring`
 * does NOT augment — it only *consumes* these slots.) Slots are absent on the
 * type until their owning package is imported into the compilation. They are
 * intentionally NOT part of `ObservationSchema` (records can't import its
 * satellites); JSON-Schema composition of the slots happens at the all-packages
 * bundling step.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ObservationExtensions {}

/**
 * Core observation record schema — the single source of truth for the record
 * lexicon. Satellite slots (`observableAssessments`, `origin`, …) attach via
 * module augmentation of {@link ObservationExtensions}, not this schema.
 *
 * ⚠️ STRIP HAZARD: because the augmented slots are not part of this `z.object`,
 * `ObservationSchema.parse(record)` SILENTLY DROPS `observableAssessments` /
 * `origin` (Zod strips unknown keys by default). Use {@link validateObservation}
 * (which returns issues without stripping the caller's object) to validate, and
 * do NOT use a raw `.parse()` round-trip to "clean" an enriched record. The
 * non-stripping composed parse + JSON-Schema composition lands at the
 * all-packages bundling step (Phase 4 `composeObservationSchema`).
 */
export const ObservationSchema = z
  .object({
    // === REQUIRED ===
    id: z.string().min(1).describe('Stable unique identifier for this observation.'),
    temporal: TemporalDataSchema,
    location: LocationDataSchema,
    status: PublicationStatusSchema,
    createdAt: z.string().describe('ISO timestamp when the record was created.'),
    updatedAt: z.string().describe('ISO timestamp when the record was last updated.'),

    // === DESCRIPTIVE ===
    summary: z.string().optional().describe('One-or-two sentence summary of the observation.'),
    description: z.string().optional().describe('Full narrative account of the observation.'),
    objectCharacteristics: ObjectCharacteristicsSchema.optional(),
    eventType: z
      .string()
      .optional()
      .describe(
        'Local event-type tag (e.g. "multi-sensor military encounter"). The word "classification" is reserved for the origin taxonomy in @disclosureos/origins; this is just a free-text descriptor.',
      ),
    sourceData: SourceDataSchema.optional(),
    investigation: InvestigationSchema.optional(),

    // === DETAILED ===
    movement: MovementSchema.optional(),
    witnesses: WitnessesSchema.optional(),
    sensorEvidence: SensorEvidenceDataSchema.optional(),
    responseImpact: ResponseImpactSchema.optional(),
    environment: EnvironmentSchema.optional(),
    relations: RelationsSchema.optional(),
    aviation: AviationSchema.optional(),

    // === MEDIA ===
    media: z.array(MediaAttachmentSchema).optional(),
    featuredMedia: MediaAttachmentSchema.optional(),

    // === RECORDS-OWNED EXTENSION SLOTS ===
    // Optional, off-the-hot-path forensic/clerical surfaces. Their schemas live
    // under @disclosureos/records/extensions/* (subpath-only) and attach here as
    // plain optional fields (cross-package slots use module augmentation instead).
    provenance: ProvenanceSchema.optional(),
    identifiers: CrossReferencesSchema.optional(),
    testimony: z.array(TestimonyStatementSchema).optional(),
    physicalEvidence: z.array(PhysicalEvidenceItemSchema).optional(),
    documents: z.array(DocumentMetadataSchema).optional(),

    // === METADATA ===
    dataSourceId: z
      .string()
      .optional()
      .describe('Identifier of the dataset or pipeline this record came from.'),
    schemaVersion: z
      .string()
      .optional()
      .describe('Version of the records schema this record was authored against.'),
    extensions: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Third-party extension bag for slots not owned by a first-party package.'),
    internalNotes: z
      .string()
      .optional()
      .describe('Private working notes for maintainers — not part of the public record.'),
  })
  .meta({ id: 'Observation' })
  .describe('A single UAP observation record — the core unit of the DisclosureOS lexicon.');

/**
 * The primary record type. Core fields come from {@link ObservationSchema};
 * cross-package slots merge in via {@link ObservationExtensions} augmentation.
 */
export type Observation = z.infer<typeof ObservationSchema> & ObservationExtensions;

export type ObservationInput = Omit<Partial<Observation>, 'temporal' | 'location'> & {
  temporal: TemporalData;
  location: Partial<LocationData> & {
    name: string;
    country: string;
    longitude: number;
    latitude: number;
    siteType: LocationData['siteType'];
  };
};
