import { z } from 'zod';

export const ValleeBehaviorSchema = z
  .enum(['AN', 'FB', 'MA', 'CE'])
  .describe('Vallée behavior class (Anomaly / Fly-By / Maneuver / Close Encounter).');

export type ValleeBehavior = z.infer<typeof ValleeBehaviorSchema>;

export const ValleeInteractionSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
  .describe('Vallée interaction level (1=Sighting … 5=Injury/Death).');

export type ValleeInteraction = z.infer<typeof ValleeInteractionSchema>;

export const ValleeClassificationSchema = z
  .object({
    behavior: ValleeBehaviorSchema,
    interaction: ValleeInteractionSchema,
    code: z.string(),
  })
  .meta({ id: 'ValleeClassification' })
  .describe('A Vallée behavior + interaction classification.');

export type ValleeClassification = z.infer<typeof ValleeClassificationSchema>;

const SVPRatingSchema = z
  .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
  .describe('SVP rating from 0 to 4.');

export const ValleeSVPSchema = z
  .object({
    source: SVPRatingSchema.describe('Source reliability (0=unreliable, 4=highly reliable).'),
    visit: SVPRatingSchema.describe('Site visit quality (0=no visit, 4=immediate investigation).'),
    probability: SVPRatingSchema.describe(
      'Probability of natural explanation (0=certain natural, 4=no known explanation).',
    ),
  })
  .meta({ id: 'ValleeSVP' })
  .describe('Vallée Source-Visit-Probability credibility rating.');

export type ValleeSVP = z.infer<typeof ValleeSVPSchema>;

export const VALLEE_BEHAVIORS: Record<ValleeBehavior, { label: string; description: string }> = {
  AN: { label: 'Anomaly', description: 'Anomalous observation that does not fit standard categories.' },
  FB: { label: 'Fly-By', description: 'Object observed in continuous flight through atmosphere.' },
  MA: { label: 'Maneuver', description: 'Object observed performing discontinuous or unusual trajectory.' },
  CE: { label: 'Close Encounter', description: 'Observation within 500 feet with associated effects.' },
};

export const VALLEE_INTERACTIONS: Record<ValleeInteraction, { label: string; description: string }> = {
  1: { label: 'Sighting', description: 'Visual observation without physical effects.' },
  2: { label: 'Physical Effects', description: 'Observation with physical evidence left behind.' },
  3: { label: 'Entities', description: 'Observation of living beings in association with phenomenon.' },
  4: { label: 'Transformation', description: 'Witness experiences altered reality or time distortion.' },
  5: { label: 'Injury/Death', description: 'Observation resulting in lasting physical or psychological harm.' },
};

export const VALLEE_BEHAVIOR_CODES = ValleeBehaviorSchema.options;
export const VALLEE_INTERACTION_LEVELS: readonly ValleeInteraction[] = [1, 2, 3, 4, 5] as const;
