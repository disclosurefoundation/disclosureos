import { z } from 'zod';
import { MediaTypeSchema } from './types';

export const MediaAttachmentSchema = z
  .object({
    id: z.string().min(1).describe('Stable id, addressable by a claim `evidenceRef` ("media:<id>").'),
    type: MediaTypeSchema,
    url: z.string().describe('Where the media file is hosted.'),
    thumbnailUrl: z.string().optional().describe('Preview/thumbnail image for the media.'),
    caption: z.string().optional().describe('Human-readable caption describing what the media shows.'),
    credit: z.string().optional().describe('Attribution for who captured or owns the media.'),
    mimeType: z.string().optional().describe('MIME type of the file (e.g. "video/mp4").'),
    fileSize: z.number().optional().describe('File size, in bytes.'),
    duration: z.number().optional().describe('Playback duration for video/audio, in seconds.'),
    width: z.number().optional().describe('Pixel width for images and video.'),
    height: z.number().optional().describe('Pixel height for images and video.'),
  })
  .meta({ id: 'MediaAttachment' })
  .describe('A media file associated with an observation (image, video, document, or audio).');

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;
