import { z } from 'zod';

export const OriginDomainSchema = z
  .enum(['physical', 'psychosocial', 'metaphysical'])
  .describe('Top-level OCS origin domain.');

export type OriginDomain = z.infer<typeof OriginDomainSchema>;

export const PhysicalSubdomainSchema = z
  .enum(['intradimensional', 'extradimensional', 'interdimensional'])
  .describe('Subdomain of the physical origin domain.');

export type PhysicalSubdomain = z.infer<typeof PhysicalSubdomainSchema>;

export const PsychosocialSubdomainSchema = z
  .enum(['sociological', 'psychological', 'neurological'])
  .describe('Subdomain of the psychosocial origin domain.');

export type PsychosocialSubdomain = z.infer<typeof PsychosocialSubdomainSchema>;

export const MetaphysicalSubdomainSchema = z
  .enum(['paranormal', 'occult', 'transcendental'])
  .describe('Subdomain of the metaphysical origin domain.');

export type MetaphysicalSubdomain = z.infer<typeof MetaphysicalSubdomainSchema>;

export const OriginSubdomainSchema = z
  .union([PhysicalSubdomainSchema, PsychosocialSubdomainSchema, MetaphysicalSubdomainSchema])
  .describe('Any OCS subdomain across the three origin domains.');

export type OriginSubdomain = z.infer<typeof OriginSubdomainSchema>;

/**
 * A single node in the Origin Classification System (OCS) taxonomy. Nodes form a
 * tree via `id`/`parentId`/`children` (children referenced by id, not nested).
 */
export const OCSNodeSchema = z
  .object({
    id: z.string().min(1).describe('Numeric dot-path identifier (e.g., "1.1.2.1").'),
    label: z.string().min(1).describe('Human-readable name for this OCS hypothesis node.'),
    description: z.string().describe('Plain-language explanation of what this hypothesis node covers.'),
    domain: OriginDomainSchema.describe('Top-level domain this node belongs to.'),
    depth: z
      .number()
      .int()
      .min(0)
      .describe('Tree depth: 0=domain, 1=subdomain, 2=category, 3=subcategory, 4=leaf.'),
    parentId: z.string().nullable().describe('Parent node id, or null for a domain root.'),
    children: z.array(z.string()).describe('Child node ids, referenced by id rather than nested inline.'),
    scientificallyTestable: z
      .boolean()
      .describe('Whether this hypothesis can be empirically falsified.'),
    aliases: z.array(z.string()).optional().describe('Alternative names (e.g., "ETH", "CTH").'),
  })
  .meta({ id: 'OCSNode' })
  .describe('A node in the OCS origin-hypothesis taxonomy.');

export type OCSNode = z.infer<typeof OCSNodeSchema>;
