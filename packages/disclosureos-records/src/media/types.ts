import { z } from 'zod';

export const MediaTypeSchema = z
  .enum(['image', 'video', 'document', 'audio'])
  .describe('Kind of media attachment.');

export type MediaType = z.infer<typeof MediaTypeSchema>;
