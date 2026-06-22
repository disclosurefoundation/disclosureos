import { z } from 'zod';

export const GeoBoundsSchema = z
  .object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  })
  .meta({ id: 'GeoBounds' })
  .describe('An axis-aligned geographic bounding box (query/vocabulary helper).');

export type GeoBounds = z.infer<typeof GeoBoundsSchema>;

export const GeoPolygonSchema = z
  .object({
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  })
  .meta({ id: 'GeoPolygon' })
  .describe('A polygon defined by [longitude, latitude] coordinate pairs.');

export type GeoPolygon = z.infer<typeof GeoPolygonSchema>;
