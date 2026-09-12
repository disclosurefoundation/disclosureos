import { z } from 'zod';
import {
  parseCaseRecord,
  parseCaseClaimHistory,
  parseCaseLinks,
  parseExperimentalObservation,
  caseSnapshotKey,
  type DocumentSnapshotRef,
  type CaseHistoricalClaim,
} from '@disclosureos/records/experimental/v2';
import { evaluateCaseRecord } from './case-review';
import { evaluateCaseClaimHistory } from './case-history-review';
import { evaluateCaseLinks } from './case-links-review';

// Schemas are owned here. Records contributes parsers and plain data, never Zod objects.
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const text = z.string().min(1).max(20000).regex(/\S/);
const short = text.max(500);
const sha256 = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const snapshot = z.strictObject({ documentId: id, schemaId: short, sha256 });
const caseRef = snapshot.extend({
  schemaId: z.literal('urn:disclosureos:experimental:case-record:0.1.0'),
});
const historyRef = snapshot.extend({
  schemaId: z.literal('urn:disclosureos:experimental:case-claim-history:0.1.0'),
});
const linksRef = snapshot.extend({
  schemaId: z.literal('urn:disclosureos:experimental:case-links:0.1.0'),
});
const artifactRef = z.string().regex(/^(source|product):[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const instant = z.iso
  .datetime({ offset: true })
  .regex(/^(?!0000)/)
  .regex(/T[0-9]{2}:[0-9]{2}:[0-9]{2}/);
const citations = z.array(id).min(1);
const citation = z.strictObject({
  id,
  label: short,
  description: text.optional(),
  target: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('case') }),
    z.strictObject({ kind: z.literal('artifact'), observationId: id, ref: artifactRef }),
    z.strictObject({ kind: z.literal('supplement'), linkId: id }),
  ]),
});
const attachment = z.strictObject({
  id,
  kind: z.enum(['image', 'video', 'audio', 'document', 'data']),
  role: z.enum(['primary', 'supporting', 'thumbnail']),
  observationId: id,
  ref: artifactRef,
  sha256,
  caption: text,
  credit: short,
  rights: text,
  alt: short.optional(),
  dimensions: z
    .strictObject({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
  durationSeconds: z.number().nonnegative().optional(),
  citationIds: citations,
  mimeType: short.optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  thumbnailAttachmentId: id.optional(),
});
export const CASE_PRESENTATION_SCHEMA_ID = 'urn:disclosureos:experimental:case-presentation:0.1.0';
/** An editorial selection, not a public-safe research document or an access grant. */
export const CasePresentationSchema = z.strictObject({
  kind: z.literal('case_presentation'),
  schemaVersion: z.literal('0.1.0'),
  publicId: id,
  caseRef,
  linksRef: linksRef.optional(),
  title: short,
  summary: text,
  updatedAt: instant,
  status: z.enum(['draft', 'published', 'archived', 'withdrawn']),
  citations: z.array(citation),
  blocks: z.array(z.strictObject({ id, heading: short.optional(), text, citationIds: citations })),
  findings: z.array(
    z.strictObject({
      id,
      historyRef,
      claimId: id,
      title: short,
      summary: text,
      reviewerLabel: short,
      citationIds: citations,
    }),
  ),
  attachments: z.array(attachment),
  featuredAttachmentId: id.optional(),
  notices: z.array(
    z.strictObject({
      id,
      kind: z.enum(['scope', 'correction', 'archive', 'withdrawal', 'rights']),
      text,
    }),
  ),
});
export type CasePresentation = z.infer<typeof CasePresentationSchema>;
export function casePresentationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(CasePresentationSchema, { target: 'draft-2020-12', reused: 'ref' }),
    $id: CASE_PRESENTATION_SCHEMA_ID,
  };
}
export function parseCasePresentation(input: unknown) {
  const parsed = CasePresentationSchema.safeParse(input);
  if (!parsed.success) return { success: false as const };
  const d = parsed.data;
  const unique = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;
  if (![d.citations, d.blocks, d.findings, d.attachments, d.notices].every(unique))
    return { success: false as const };
  const ids = new Set(d.citations.map((c) => c.id));
  for (const item of [...d.blocks, ...d.findings, ...d.attachments]) {
    if (
      new Set(item.citationIds).size !== item.citationIds.length ||
      item.citationIds.some((i) => !ids.has(i))
    )
      return { success: false as const };
  }
  if (d.citations.some((c) => c.target.kind === 'supplement') && !d.linksRef)
    return { success: false as const };
  if (d.featuredAttachmentId && !d.attachments.some((a) => a.id === d.featuredAttachmentId))
    return { success: false as const };
  if (d.status === 'archived' && !d.notices.some((n) => n.kind === 'archive'))
    return { success: false as const };
  if (d.status === 'withdrawn' && !d.notices.some((n) => n.kind === 'withdrawal'))
    return { success: false as const };
  for (const a of d.attachments) {
    if (
      a.thumbnailAttachmentId &&
      (a.role === 'thumbnail' ||
        !d.attachments.some(
          (t) => t.id === a.thumbnailAttachmentId && t.kind === 'image' && t.role === 'thumbnail',
        ))
    )
      return { success: false as const };
    if ((a.kind === 'image' && !a.alt) || (a.role === 'thumbnail' && a.kind !== 'image'))
      return { success: false as const };
    if (a.dimensions && !['image', 'video'].includes(a.kind)) return { success: false as const };
    if (a.durationSeconds !== undefined && !['audio', 'video'].includes(a.kind))
      return { success: false as const };
  }
  return { success: true as const, data: d };
}

/** Trusted server decision, supplied separately after reviewing exact presentation and media bytes.
 * Never accept this object from an anonymous request, a record, or its access labels. */
export interface CasePublicationApproval {
  presentationSha256: string;
  policyVersion: string;
}
export interface PublicCasePayload {
  kind: 'public_case';
  schemaVersion: '0.1.0';
  publicId: string;
  title: string;
  summary: string;
  updatedAt: string;
  status: 'published' | 'archived';
  citations: Array<{ id: string; label: string; description?: string }>;
  blocks: Array<{ id: string; heading?: string; text: string; citationIds: string[] }>;
  findings: Array<{
    id: string;
    title: string;
    summary: string;
    reviewerLabel: string;
    citationIds: string[];
    status: 'assessed' | 'unassessed';
    outcome?: 'reported' | 'confirmed' | 'absent' | 'inconclusive';
    revision: 'current' | 'superseded';
  }>;
  attachments: Array<{
    id: string;
    kind: CasePresentation['attachments'][number]['kind'];
    role: CasePresentation['attachments'][number]['role'];
    href: string;
    caption: string;
    credit: string;
    rights: string;
    alt?: string;
    dimensions?: { width: number; height: number };
    durationSeconds?: number;
    mimeType?: string;
    fileSizeBytes?: number;
    thumbnailAttachmentId?: string;
    citationIds: string[];
  }>;
  featuredAttachmentId?: string;
  assessmentNotice?: string;
  notices: Array<{ id: string; kind: CasePresentation['notices'][number]['kind']; text: string }>;
}
export type PublicCaseResult =
  | { success: true; data: PublicCasePayload }
  | {
      success: false;
      code: 'APPROVAL_REQUIRED' | 'INVALID_PRESENTATION' | 'NOT_PUBLISHED' | 'INVALID_REFERENCES';
    };
const approvalSchema = z.strictObject({ presentationSha256: sha256, policyVersion: short });
async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
const decode = (bytes: Uint8Array): unknown =>
  JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

/** Fail-closed public projection. It never returns source documents or diagnostic values.
 * Approval authenticity, publication revocation, cache invalidation and asset delivery remain server responsibilities. */
export async function buildPublicCase(
  presentationBytes: Uint8Array,
  options: { documents: ReadonlyMap<string, Uint8Array>; approval?: CasePublicationApproval },
): Promise<PublicCaseResult> {
  const approved = approvalSchema.safeParse(options.approval);
  if (!approved.success) return { success: false, code: 'APPROVAL_REQUIRED' };
  const bytes = Uint8Array.from(presentationBytes);
  let parsed: ReturnType<typeof parseCasePresentation>;
  try {
    parsed = parseCasePresentation(decode(bytes));
  } catch {
    return { success: false, code: 'INVALID_PRESENTATION' };
  }
  if (!parsed.success) return { success: false, code: 'INVALID_PRESENTATION' };
  const d = parsed.data;
  if (d.status === 'draft' || d.status === 'withdrawn')
    return { success: false, code: 'NOT_PUBLISHED' };

  // Capture declared dependencies before the first await; never copy unrelated entries.
  const copies = new Map<string, Uint8Array>();
  const copy = (hash: string) => {
    const b = options.documents.get(hash);
    if (b && !copies.has(hash)) copies.set(hash, Uint8Array.from(b));
  };
  const refs = [
    d.caseRef,
    ...(d.linksRef ? [d.linksRef] : []),
    ...d.findings.map((f) => f.historyRef),
  ];
  refs.forEach((r) => copy(r.sha256));
  try {
    const c = copies.get(d.caseRef.sha256);
    if (c) {
      const p = parseCaseRecord(decode(c));
      if (p.success) p.data.observationRefs.forEach((r) => copy(r.sha256));
    }
    for (const f of d.findings) {
      const b = copies.get(f.historyRef.sha256);
      if (!b) continue;
      const h = parseCaseClaimHistory(decode(b));
      if (h.success)
        for (const r of h.data.caseRefs) {
          copy(r.sha256);
          const cb = copies.get(r.sha256);
          if (cb) {
            const p = parseCaseRecord(decode(cb));
            if (p.success) p.data.observationRefs.forEach((o) => copy(o.sha256));
          }
        }
    }
    if (d.linksRef) {
      const b = copies.get(d.linksRef.sha256);
      if (b) {
        const links = parseCaseLinks(decode(b));
        if (links.success)
          links.data.links.forEach((l) =>
            copy(l.kind === 'intake' ? l.document.sha256 : l.reference.document.sha256),
          );
      }
    }
  } catch {
    return { success: false, code: 'INVALID_REFERENCES' };
  }
  if ((await digest(bytes)) !== approved.data.presentationSha256)
    return { success: false, code: 'APPROVAL_REQUIRED' };
  const load = async (ref: DocumentSnapshotRef) => {
    const b = copies.get(ref.sha256);
    if (!b || (await digest(b)) !== ref.sha256) throw new Error('reference');
    const raw = decode(b);
    if (!raw || typeof raw !== 'object' || !('id' in raw) || raw.id !== ref.documentId)
      throw new Error('reference');
    return raw;
  };
  const invalid = (): PublicCaseResult => ({ success: false, code: 'INVALID_REFERENCES' });
  try {
    const owner = parseCaseRecord(await load(d.caseRef));
    if (!owner.success || !(await evaluateCaseRecord(owner.data, { documents: copies })).success)
      return invalid();
    const observations = new Map(
      owner.data.observationRefs.map((r) => {
        const p = parseExperimentalObservation(decode(copies.get(r.sha256)!));
        if (!p.success) throw new Error('reference');
        return [r.documentId, p.data] as const;
      }),
    );
    const artifact = (observationId: string, ref: string) => {
      const o = observations.get(observationId);
      const [kind, id] = ref.split(':');
      return (kind === 'source' ? o?.sources : o?.products)?.find((a) => a.id === id);
    };
    const linkedIds = new Set<string>();
    if (d.linksRef) {
      const links = parseCaseLinks(await load(d.linksRef));
      if (!links.success || caseSnapshotKey(links.data.caseRef) !== caseSnapshotKey(d.caseRef))
        return invalid();
      const result = await evaluateCaseLinks(links.data, { documents: copies });
      if (!result.success) return invalid();
      result.resolvedLinkIds.forEach((id) => linkedIds.add(id));
    }
    for (const c of d.citations) {
      if (c.target.kind === 'artifact' && !artifact(c.target.observationId, c.target.ref))
        return invalid();
      if (c.target.kind === 'supplement' && !linkedIds.has(c.target.linkId)) return invalid();
    }
    for (const a of d.attachments) {
      const value = artifact(a.observationId, a.ref);
      if (!value?.digest || value.digest.value !== a.sha256) return invalid();
    }
    const findings: PublicCasePayload['findings'] = [];
    const histories = new Map<string, { claims: CaseHistoricalClaim[]; current: Set<string> }>();
    for (const f of d.findings) {
      const key = caseSnapshotKey(f.historyRef);
      let h = histories.get(key);
      if (!h) {
        const parsed = parseCaseClaimHistory(await load(f.historyRef));
        if (!parsed.success) return invalid();
        const result = await evaluateCaseClaimHistory(parsed.data, { documents: copies });
        if (!result.success) return invalid();
        h = { claims: parsed.data.claims, current: new Set(result.currentClaimRefs) };
        histories.set(key, h);
      }
      const c = h.claims.find((c) => c.id === f.claimId);
      if (!c || c.kind !== 'assessment') return invalid();
      const subjectCases =
        c.subject.kind === 'case'
          ? [c.subject.document]
          : c.subject.kind === 'case_entity'
            ? [c.subject.reference.document]
            : [c.subject.from.case, c.subject.to.case];
      if (subjectCases.some((r) => caseSnapshotKey(r) !== caseSnapshotKey(d.caseRef)))
        return invalid();
      findings.push({
        id: f.id,
        title: f.title,
        summary: f.summary,
        reviewerLabel: f.reviewerLabel,
        citationIds: [...f.citationIds],
        status: c.status,
        ...(c.status === 'assessed' ? { outcome: c.outcome } : {}),
        revision: h.current.has(`claim:${c.id}`) ? 'current' : 'superseded',
      });
    }
    // Deliberate field allowlist: no spreading of research records, references or approval data.
    return {
      success: true,
      data: {
        kind: 'public_case',
        schemaVersion: '0.1.0',
        publicId: d.publicId,
        title: d.title,
        summary: d.summary,
        updatedAt: d.updatedAt,
        status: d.status,
        citations: d.citations.map((c) => ({
          id: c.id,
          label: c.label,
          ...(c.description !== undefined ? { description: c.description } : {}),
        })),
        blocks: d.blocks.map((b) => ({
          id: b.id,
          text: b.text,
          citationIds: [...b.citationIds],
          ...(b.heading !== undefined ? { heading: b.heading } : {}),
        })),
        findings,
        ...(findings.length
          ? {
              assessmentNotice:
                'These are attributed assessments. Reference checks do not independently verify their conclusions.',
            }
          : {}),
        attachments: d.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          role: a.role,
          href: `/case-assets/${d.publicId}/${a.id}`,
          caption: a.caption,
          credit: a.credit,
          rights: a.rights,
          citationIds: [...a.citationIds],
          ...(a.alt !== undefined ? { alt: a.alt } : {}),
          ...(a.dimensions
            ? { dimensions: { width: a.dimensions.width, height: a.dimensions.height } }
            : {}),
          ...(a.durationSeconds !== undefined ? { durationSeconds: a.durationSeconds } : {}),
          ...(a.mimeType !== undefined ? { mimeType: a.mimeType } : {}),
          ...(a.fileSizeBytes !== undefined ? { fileSizeBytes: a.fileSizeBytes } : {}),
          ...(a.thumbnailAttachmentId ? { thumbnailAttachmentId: a.thumbnailAttachmentId } : {}),
        })),
        ...(d.featuredAttachmentId ? { featuredAttachmentId: d.featuredAttachmentId } : {}),
        notices: d.notices.map((n) => ({ id: n.id, kind: n.kind, text: n.text })),
      },
    };
  } catch {
    return invalid();
  }
}

/** One projection supplies all text outputs. Use data for text-node rendering;
 * never interpolate these strings into raw HTML, script tags or Markdown. */
export async function buildPublicCaseOutputs(
  presentationBytes: Uint8Array,
  options: Parameters<typeof buildPublicCase>[1],
) {
  const result = await buildPublicCase(presentationBytes, options);
  if (!result.success) return result;
  const d = result.data;
  const escape = (s: string) => s.replace(/[!-/:-@\[-`{-~]/g, '\\$&');
  const lines = [`# ${escape(d.title)}`, '', escape(d.summary), ''];
  if (d.assessmentNotice) lines.push(escape(d.assessmentNotice), '');
  for (const n of d.notices) lines.push(`**${escape(n.kind)}:** ${escape(n.text)}`, '');
  for (const b of d.blocks) {
    if (b.heading) lines.push(`## ${escape(b.heading)}`, '');
    lines.push(escape(b.text), '', `Sources: ${b.citationIds.map(escape).join(', ')}`, '');
  }
  for (const f of d.findings)
    lines.push(
      `## ${escape(f.title)}`,
      '',
      escape(f.summary),
      '',
      `${escape(f.reviewerLabel)} · ${f.status}${f.outcome ? ` / ${f.outcome}` : ''} · ${f.revision}`,
      '',
      `Sources: ${f.citationIds.map(escape).join(', ')}`,
      '',
    );
  for (const a of d.attachments)
    lines.push(
      `[${escape(a.caption)}](${a.href})`,
      '',
      `${escape(a.credit)}. ${escape(a.rights)}`,
      '',
      `Sources: ${a.citationIds.map(escape).join(', ')}`,
      '',
    );
  if (d.citations.length) lines.push('## Sources', '');
  for (const c of d.citations)
    lines.push(
      `${escape(c.id)}: ${escape(c.label)}${c.description ? ` — ${escape(c.description)}` : ''}`,
      '',
    );
  return {
    success: true as const,
    data: d,
    json: JSON.stringify(d, null, 2) + '\n',
    markdown: lines.join('\n'),
    search: {
      publicId: d.publicId,
      title: d.title,
      text: [
        d.summary,
        ...(d.assessmentNotice ? [d.assessmentNotice] : []),
        ...d.blocks.map((b) => b.text),
        ...d.findings.map((f) => `${f.summary} ${f.status} ${f.outcome ?? ''} ${f.revision}`),
        ...d.notices.map((n) => n.text),
      ].join('\n'),
    },
    metadata: { title: d.title, description: d.summary },
  };
}
