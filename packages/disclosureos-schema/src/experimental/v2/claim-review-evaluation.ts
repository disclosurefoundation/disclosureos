import { z } from 'zod';
import {
  OBSERVATION_CLAIM_HISTORY_SCHEMA_ID, CASE_CLAIM_HISTORY_V02_SCHEMA_ID,
  parseObservationClaimHistory, parseCaseClaimHistoryV02,
} from '@disclosureos/records/experimental/v2';
import { evaluateObservationClaimDocumentation } from './assessment-documentation';
import { evaluateCaseClaimHistoryV02 } from './case-history-review';

export const CLAIM_REVIEW_EVALUATION_SCHEMA_ID = 'urn:disclosureos:experimental:claim-review-evaluation:0.1.0';
export const CLAIM_REVIEW_RECEIPT_SCHEMA_ID = 'urn:disclosureos:experimental:claim-review-receipt:0.1.0';
export const CLAIM_REVIEW_EVALUATION_POLICY = Object.freeze({
  id: 'urn:disclosureos:experimental:policy:claim-review-evaluation', version: '0.1.0',
  scope: 'declared_claims_documentary_support_and_snapshot_identity',
} as const);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const pin = z.strictObject({ sha256: digest, byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export const ClaimReviewEvaluationSchema = z.strictObject({
  kind: z.literal('claim_review_evaluation'), schemaVersion: z.literal('0.1.0'),
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
  review: z.strictObject({
    documentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
    schemaId: z.enum([OBSERVATION_CLAIM_HISTORY_SCHEMA_ID, CASE_CLAIM_HISTORY_V02_SCHEMA_ID]),
    sha256: digest,
  }),
});
export type ClaimReviewEvaluation = z.infer<typeof ClaimReviewEvaluationSchema>;
export const ClaimReviewReceiptSchema = z.strictObject({
  kind: z.literal('claim_review_receipt'), schemaVersion: z.literal('0.1.0'),
  policy: z.strictObject({ id: z.literal(CLAIM_REVIEW_EVALUATION_POLICY.id), version: z.literal('0.1.0'), scope: z.literal(CLAIM_REVIEW_EVALUATION_POLICY.scope) }),
  serialization: z.literal('sorted-json-utf8:0.1.0'),
  input: pin, output: pin, inputJson: z.string().min(1), outputJson: z.string().min(1),
});
export type ClaimReviewReceipt = z.infer<typeof ClaimReviewReceiptSchema>;
export function claimReviewEvaluationJsonSchema() {
  return { ...z.toJSONSchema(ClaimReviewEvaluationSchema, { target: 'draft-2020-12' }), $id: CLAIM_REVIEW_EVALUATION_SCHEMA_ID };
}
export function claimReviewReceiptJsonSchema() {
  return { ...z.toJSONSchema(ClaimReviewReceiptSchema, { target: 'draft-2020-12' }), $id: CLAIM_REVIEW_RECEIPT_SCHEMA_ID };
}
export interface ClaimReviewEvaluationOptions {
  /** Exact review document bytes, not a parsed/re-serialized substitute. */
  reviewBytes?: Uint8Array;
  /** Exact case and observation snapshots keyed by SHA-256. */
  documents?: ReadonlyMap<string, Uint8Array>;
  /** Source/product bytes keyed by their local reference in an observation history. */
  assets?: ReadonlyMap<string, Uint8Array>;
}
type ReviewOutput = Awaited<ReturnType<typeof evaluateObservationClaimDocumentation>> | Awaited<ReturnType<typeof evaluateCaseClaimHistoryV02>>;
export interface ClaimReviewEvaluationResult {
  success: boolean;
  checks: { structural: 'passed' | 'failed'; external: 'passed' | 'failed' | 'not_checked'; evaluation: 'passed' | 'failed' | 'not_checked' };
  issues: { code: string; pointer: string; message: string }[];
  output: ReviewOutput | null; receipt: ClaimReviewReceipt | null;
  scientificEligibility: 'not_checked'; processingChronology: 'not_checked'; publicationPolicy: 'not_checked';
}
const bytes = (s: string) => new TextEncoder().encode(s);
const hash = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(b)))].map(n => n.toString(16).padStart(2, '0')).join('');
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => JSON.stringify(k) + ':' + canonical(x)).join(',') + '}';
  const value = JSON.stringify(v);
  if (value === undefined) throw new Error('Receipt contains a non-JSON value.');
  return value;
}
const copy = (map?: ReadonlyMap<string, Uint8Array>) => new Map([...map ?? []].map(([k, v]) => [k, Uint8Array.from(v)]));
/** Offline, deterministic evaluation. Receipts record inputs/results, not an attestation or public projection. */
export async function evaluateClaimReview(input: unknown, options: ClaimReviewEvaluationOptions = {}): Promise<ClaimReviewEvaluationResult> {
  const parsed = ClaimReviewEvaluationSchema.safeParse(input);
  const result: ClaimReviewEvaluationResult = {
    success: false, checks: { structural: parsed.success ? 'passed' : 'failed', external: 'not_checked', evaluation: 'not_checked' }, issues: [], output: null, receipt: null,
    scientificEligibility: 'not_checked', processingChronology: 'not_checked', publicationPolicy: 'not_checked',
  };
  if (!parsed.success) {
    result.issues = parsed.error.issues.map(i => ({ code: 'STRUCT.VALUE', pointer: '/' + i.path.join('/'), message: i.message }));
    return result;
  }
  // Capture every caller-owned buffer before any await, including later snapshots.
  const reviewBytes = options.reviewBytes ? Uint8Array.from(options.reviewBytes) : undefined;
  const documents = copy(options.documents), assets = copy(options.assets), request = parsed.data;
  const fail = (code: string, message: string) => {
    result.checks.external = 'failed'; result.issues.push({ code, pointer: '/review', message }); return result;
  };
  if (!reviewBytes) return fail('SNAPSHOT.UNAVAILABLE', 'Supply the exact review snapshot bytes.');
  if (await hash(reviewBytes) !== request.review.sha256) return fail('SNAPSHOT.DIGEST', 'Review bytes differ from the declared digest.');
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(reviewBytes)); }
  catch { return fail('SNAPSHOT.JSON', 'Review must be a UTF-8 JSON document.'); }
  const review = request.review.schemaId === OBSERVATION_CLAIM_HISTORY_SCHEMA_ID ? parseObservationClaimHistory(raw) : parseCaseClaimHistoryV02(raw);
  if (!review.success) return fail('SNAPSHOT.CONTRACT', 'Review does not satisfy its pinned contract and local semantics.');
  if (review.data.id !== request.review.documentId) return fail('SNAPSHOT.IDENTITY', 'Review ID differs from the snapshot reference.');
  result.checks.external = 'passed';
  result.output = request.review.schemaId === OBSERVATION_CLAIM_HISTORY_SCHEMA_ID
    ? await evaluateObservationClaimDocumentation(raw, { assets })
    : await evaluateCaseClaimHistoryV02(raw, { documents });
  result.checks.evaluation = result.output.success ? 'passed' : 'failed';
  result.success = result.output.success;
  const inventory = async (map: Map<string, Uint8Array>) => Promise.all([...map].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(async ([ref, value]) => ({ ref, sha256: await hash(value), byteLength: value.length })));
  const inputJson = canonical({ request, review: { sha256: request.review.sha256, byteLength: reviewBytes.length }, documents: await inventory(documents), assets: await inventory(assets) });
  const outputJson = canonical({ policy: CLAIM_REVIEW_EVALUATION_POLICY, output: result.output, scientificEligibility: result.scientificEligibility, processingChronology: result.processingChronology, publicationPolicy: result.publicationPolicy });
  result.receipt = {
    kind: 'claim_review_receipt', schemaVersion: '0.1.0', policy: CLAIM_REVIEW_EVALUATION_POLICY, serialization: 'sorted-json-utf8:0.1.0',
    input: { sha256: await hash(bytes(inputJson)), byteLength: bytes(inputJson).length },
    output: { sha256: await hash(bytes(outputJson)), byteLength: bytes(outputJson).length }, inputJson, outputJson,
  };
  return result;
}
/** Integrity of the receipt's serialized strings only. Replay the evaluator with source bytes to verify the computation. */
export async function verifyClaimReviewReceipt(input: unknown): Promise<boolean> {
  const p = ClaimReviewReceiptSchema.safeParse(input);
  if (!p.success) return false;
  const r = p.data;
  try {
    const output = JSON.parse(r.outputJson);
    if (canonical(JSON.parse(r.inputJson)) !== r.inputJson || canonical(output) !== r.outputJson || canonical(output.policy) !== canonical(r.policy)) return false;
  } catch { return false; }
  return r.input.byteLength === bytes(r.inputJson).length && r.output.byteLength === bytes(r.outputJson).length
    && r.input.sha256 === await hash(bytes(r.inputJson)) && r.output.sha256 === await hash(bytes(r.outputJson));
}
