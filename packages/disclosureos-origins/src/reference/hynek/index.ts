import { z } from 'zod';

export const HynekCategorySchema = z
  .enum(['NL', 'DD', 'RV', 'CE1', 'CE2', 'CE3', 'CE4', 'CE5', 'CE6', 'CE7'])
  .describe('Hynek close-encounter classification category.');

export type HynekCategory = z.infer<typeof HynekCategorySchema>;

export const HynekClassificationSchema = z
  .object({
    category: HynekCategorySchema,
    label: z.string(),
    description: z.string(),
    distanceThreshold: z.string().optional(),
  })
  .meta({ id: 'HynekClassification' })
  .describe('A single entry in the Hynek classification system.');

export type HynekClassification = z.infer<typeof HynekClassificationSchema>;

export const HYNEK_SYSTEM: Record<HynekCategory, HynekClassification> = {
  NL: { category: 'NL', label: 'Nocturnal Light', description: 'Anomalous light seen at night, too distant for detail.', distanceThreshold: '>500ft' },
  DD: { category: 'DD', label: 'Daylight Disc', description: 'Anomalous object seen during daytime, typically disc-shaped.', distanceThreshold: '>500ft' },
  RV: { category: 'RV', label: 'Radar-Visual', description: 'Anomaly confirmed on radar and simultaneously by visual observation.' },
  CE1: { category: 'CE1', label: 'Close Encounter of the First Kind', description: 'Visual sighting at close range (<500ft) with no physical interaction.', distanceThreshold: '<500ft' },
  CE2: { category: 'CE2', label: 'Close Encounter of the Second Kind', description: 'Physical effects on environment — ground traces, radiation, vehicle interference.', distanceThreshold: '<500ft' },
  CE3: { category: 'CE3', label: 'Close Encounter of the Third Kind', description: 'Observation of entities associated with the UAP.', distanceThreshold: '<500ft' },
  CE4: { category: 'CE4', label: 'Close Encounter of the Fourth Kind', description: 'Abduction or direct interaction with entities.' },
  CE5: { category: 'CE5', label: 'Close Encounter of the Fifth Kind', description: 'Bilateral communication or initiated contact with NHI.' },
  CE6: { category: 'CE6', label: 'Close Encounter of the Sixth Kind', description: 'Encounter resulting in death of witness or permanent injury.' },
  CE7: { category: 'CE7', label: 'Close Encounter of the Seventh Kind', description: 'Creation of human-alien hybrid (proposed extension).' },
};

export const HYNEK_CATEGORIES = HynekCategorySchema.options;
