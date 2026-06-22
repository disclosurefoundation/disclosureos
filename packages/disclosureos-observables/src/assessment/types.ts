import { z } from 'zod';
import { ClaimSchema, ConfidenceSchema } from '@disclosureos/records/shared';

export const AssessmentLevelSchema = z
  .enum(['not_indicated', 'reported', 'documented', 'measured', 'confirmed'])
  .describe('Evidentiary tier of an observable assessment — how strongly the signal is established.');

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
    id: z.string().describe('Stable observable identifier used in data (e.g., "instantaneous_acceleration").'),
    code: z.string().describe('Short display code for the observable (e.g., "TO-2" or "BO-1").'),
    label: z.string().describe('Human-readable observable name.'),
    description: z.string().describe('Plain-language description of what the observable captures.'),
    scientificBasis: z
      .string()
      .describe('Why this observable may be scientifically meaningful, including the evidentiary basis and limitations.'),
    caveat: z
      .string()
      .optional()
      .describe(
        'Qualifier shown when the basis rests on a contested framework or a weaker class of evidence (e.g. testimony rather than sensor data). Present only when the observable warrants extra caution.',
      ),
    caveatLabel: z
      .string()
      .optional()
      .describe(
        'Short heading for the caveat banner. Defaults to "Contested basis" when omitted; set explicitly when the caution is about evidence type or interpretation rather than disputed science.',
      ),
    detectionSignals: z
      .array(z.string())
      .describe('Observable signs or measurements that would indicate this signal may be present.'),
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
