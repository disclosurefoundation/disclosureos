import { z } from 'zod';

export const WitnessCategorySchema = z
  .enum([
    'military_pilot',
    'military_aircrew',
    'military_ground',
    'military_naval',
    'military_radar_operator',
    'military_other',
    'commercial_pilot',
    'commercial_aircrew',
    'private_pilot',
    'air_traffic_controller',
    'aviation_other',
    'government_official',
    'elected_official',
    'intelligence_officer',
    'law_enforcement',
    'scientist',
    'astronomer',
    'meteorologist',
    'engineer',
    'medical_professional',
    'maritime',
    'civilian',
    'civilian_group',
    'anonymous',
    'unknown',
  ])
  .describe('Professional/role category of a witness.');

export type WitnessCategory = z.infer<typeof WitnessCategorySchema>;
