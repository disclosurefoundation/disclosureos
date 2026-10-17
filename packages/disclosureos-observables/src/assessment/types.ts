import { z } from 'zod';
import { ClaimSchema, ConfidenceSchema } from '@disclosureos/records/shared';

export const AssessmentLevelSchema = z
  .enum(['not_indicated', 'reported', 'documented', 'measured', 'confirmed'])
  .describe('Support tier describing the available information about a characteristic. It is separate from a V2 claim outcome and does not establish anomalous behavior.');

export type AssessmentLevel = z.infer<typeof AssessmentLevelSchema>;

export const ObservableCategorySchema = z
  .enum(['technology', 'biologics'])
  .describe('Top-level observable domain.');

export type ObservableCategory = z.infer<typeof ObservableCategorySchema>;

/**
 * Shared structural base for all observable domain definitions. Domain schemas
 * (`TechnologyObservable`, `BiologicsObservable`) extend this.
 */
export const ObservableBaseSchema = z
  .object({
    id: z.string().describe('Stable observable identifier used in data (e.g., "abrupt_motion").'),
    code: z.string().describe('Short display code for the observable (e.g., "OC-T02" or "OC-B01").'),
    label: z.string().describe('Human-readable observable name.'),
    description: z.string().describe('Plain-language description of what the observable captures.'),
    scientificBasis: z
      .string()
      .describe('Measurement rationale and limits for investigating this characteristic; not proof of a mechanism or origin.'),
    caveat: z
      .string()
      .optional()
      .describe(
        'Interpretation limits for the characteristic, including contested methods, observation limits and distinctions from causal or origin claims.',
      ),
    caveatLabel: z
      .string()
      .optional()
      .describe(
        'Short heading for the caveat banner. The heading describes the specific interpretation limit.',
      ),
    detectionSignals: z
      .array(z.string())
      .describe('Reports or measurements relevant to investigating the characteristic; not sufficient confirmation criteria.'),
    methods: z.array(z.string()).describe('Methods or instruments used to detect or evaluate the observable.'),
    references: z.array(z.string()).optional().describe('Published or public references supporting the definition.'),
  })
  .meta({ id: 'ObservableBase' })
  .describe('Definition of a single observable: what it is, its scientific basis, and how to detect it.');

export type ObservableBase = z.infer<typeof ObservableBaseSchema>;

export const ObservableDefinitionSchema = ObservableBaseSchema.extend({
  category: ObservableCategorySchema,
})
  .meta({ id: 'ObservableDefinition' })
  .describe('Fully-resolved observable definition including its category.');

export type ObservableDefinition = z.infer<typeof ObservableDefinitionSchema>;

/**
 * An assessment of one observable for a given observation. Composes the shared
 * {@link ClaimSchema} envelope (`evaluatedAt`/`evaluatedBy`/`rationale` +
 * `evidenceRefs`) and the shared `Confidence` scale.
 */
export const ObservableAssessmentSchema = ClaimSchema.extend({
  observableId: z.string(),
  level: AssessmentLevelSchema,
  confidence: ConfidenceSchema.optional().describe(
    'Confidence in the assessment, in [0,1]. 0 = none, 1 = absolute.',
  ),
})
  .meta({ id: 'ObservableAssessment' })
  .describe('An assessment of one observable for an observation.');

export type ObservableAssessment = z.infer<typeof ObservableAssessmentSchema>;

/**
 * A single attributed claim about one observable, with the redundant
 * `observableId` removed (the map key supplies it). The
 * `observableAssessments.{technology,biologics}[id]` slot holds an *array* of
 * these — competing verdicts from different evaluators coexist. Build with
 * `createObservableClaim` or write as a plain literal.
 */
export const ObservableClaimSchema = ObservableAssessmentSchema.omit({
  observableId: true,
})
  .meta({ id: 'ObservableClaim' })
  .describe('An attributed observable claim, keyed by its map position (no observableId).');

export type ObservableClaim = z.infer<typeof ObservableClaimSchema>;
